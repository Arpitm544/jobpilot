import os
import uuid
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from datetime import datetime, timezone
from sqlalchemy import select, desc, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.models.job import Job, JobMatch
from app.models.preference import JobPreference
from app.models.application import Application, TailoredResume, ApplicationEvent
from app.schemas.application import ApplicationResponse
from app.api.deps import get_current_user
from app.services.apply_service import apply_service
from app.services.task_runner import task_runner
from app.services.event_stream import event_stream

router = APIRouter(prefix="/apply", tags=["Auto-Apply & Pipeline Engine"])


class StageApplyRequest(BaseModel):
    job_match_id: uuid.UUID


@router.post("/stage/{job_match_id}", response_model=ApplicationResponse)
async def stage_application(
    job_match_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Stages an application for a match and its tailored resume"""
    try:
        application = await apply_service.get_or_create_application(
            db=db,
            user_id=current_user.id,
            job_match_id=job_match_id
        )
        return application
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{application_id}/dry-run", response_model=ApplicationResponse)
async def execute_dry_run_apply(
    application_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Executes dry-run Playwright form filler:
    Fills out the application form with tailored resume PDF, captures full-page screenshot proof,
    and sets status to 'review_ready' without submitting.
    """
    try:
        application = await apply_service.execute_dry_run(
            db=db,
            user_id=current_user.id,
            application_id=application_id
        )
        return application
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Dry run failed: {str(e)}")


@router.post("/{application_id}/approve", response_model=ApplicationResponse)
async def approve_application(
    application_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Approves application in review mode and records submission"""
    try:
        application = await apply_service.approve_and_submit(
            db=db,
            user_id=current_user.id,
            application_id=application_id
        )
        return application
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{application_id}/reject", response_model=ApplicationResponse)
async def reject_application(
    application_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Rejects or skips application"""
    result = await db.execute(
        select(Application).where(Application.id == application_id, Application.user_id == current_user.id)
    )
    application = result.scalar_one_or_none()
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    application.status = "rejected"
    await db.commit()
    await db.refresh(application)
    return application


@router.get("/pipeline")
async def get_pipeline_board(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns candidate applications & scored job matches aggregated by Kanban pipeline stages:
    'discovered', 'queued', 'tailored', 'review_ready', 'applied', 'interview', 'offer', 'rejected'
    """
    # 1. Fetch all applications
    app_res = await db.execute(
        select(Application)
        .options(
            selectinload(Application.job),
            selectinload(Application.tailored_resume)
        )
        .where(Application.user_id == current_user.id)
        .order_by(desc(Application.updated_at))
    )
    applications = app_res.scalars().all()

    # 2. Fetch all job matches (dismissed ones are permanently hidden)
    match_res = await db.execute(
        select(JobMatch)
        .options(
            selectinload(JobMatch.job),
            selectinload(JobMatch.tailored_resume)
        )
        .where(
            JobMatch.user_id == current_user.id,
            JobMatch.status != "dismissed"
        )
        .order_by(desc(JobMatch.match_score))
    )
    matches = match_res.scalars().all()

    # Group into pipeline stages
    pipeline: Dict[str, List[Dict[str, Any]]] = {
        "discovered": [],
        "queued": [],
        "tailored": [],
        "review_ready": [],
        "applied": [],
        "interview": [],
        "offer": [],
        "rejected": [],
    }

    # Map applied job IDs — applied/rejected jobs must NEVER reappear in discovered/queued
    applied_job_ids = set()
    for app in applications:
        applied_job_ids.add(app.job_id)
        item = {
            "application_id": str(app.id),
            "job_id": str(app.job.id),
            "title": app.job.title,
            "company_name": app.job.company_name,
            "location": app.job.location,
            "workplace_type": app.job.workplace_type,
            "ats_type": app.job.ats_type,
            "apply_url": app.job.apply_url,
            "status": app.status,
            "is_dry_run": app.is_dry_run,
            "has_proof": bool(app.submission_proof_screenshot),
            "proof_text": app.submission_proof_text,
            "tailored_resume_id": str(app.tailored_resume_id) if app.tailored_resume_id else None,
            "applied_at": app.applied_at.isoformat() if app.applied_at else None,
            "updated_at": app.updated_at.isoformat(),
        }
        if app.status in pipeline:
            pipeline[app.status].append(item)
        else:
            pipeline["applied"].append(item)

    # Add matches not yet staged as applications (applied jobs are permanently hidden)
    for m in matches:
        if m.job_id in applied_job_ids:
            continue  # Already applied to this job — never reappear
        item = {
            "match_id": str(m.id),
            "job_id": str(m.job.id),
            "title": m.job.title,
            "company_name": m.job.company_name,
            "location": m.job.location,
            "workplace_type": m.job.workplace_type,
            "ats_type": m.job.ats_type,
            "apply_url": m.job.apply_url,
            "match_score": m.match_score,
            "status": m.status,
            "has_proof": False,
            "tailored_resume_id": str(m.tailored_resume.id) if m.tailored_resume else None,
            "evaluated_at": m.evaluated_at.isoformat(),
        }
        if m.status in pipeline:
            pipeline[m.status].append(item)
        elif m.status == "tailored":
            pipeline["tailored"].append(item)
        else:
            pipeline["discovered"].append(item)

    return pipeline


@router.delete("/match/{match_id}")
async def delete_job_match(
    match_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Permanently removes a job match from the pipeline (marks as dismissed).
    Dismissed jobs never reappear in any pipeline view.
    """
    result = await db.execute(
        select(JobMatch).where(JobMatch.id == match_id, JobMatch.user_id == current_user.id)
    )
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job match not found")

    match.status = "dismissed"
    await db.commit()
    return {"success": True, "match_id": str(match_id), "message": "Job removed from pipeline"}


@router.delete("/application/{application_id}")
async def delete_application(
    application_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Removes a pre-submission application from the pipeline (marks as rejected).
    Cannot delete already-submitted applications.
    """
    result = await db.execute(
        select(Application).where(Application.id == application_id, Application.user_id == current_user.id)
    )
    application = result.scalar_one_or_none()
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    if application.status in ["applied", "interview", "offer"]:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete a submitted application. Archive it instead."
        )

    application.status = "rejected"
    await db.commit()
    return {"success": True, "application_id": str(application_id), "message": "Application removed from pipeline"}


class DailyCapRequest(BaseModel):
    daily_cap: int


@router.post("/daily-cap")
async def update_daily_cap(
    request: DailyCapRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Updates the user's daily application cap (range: 1-50)."""
    cap = max(1, min(50, request.daily_cap))
    pref_res = await db.execute(select(JobPreference).where(JobPreference.user_id == current_user.id))
    prefs = pref_res.scalar_one_or_none()
    if not prefs:
        prefs = JobPreference(user_id=current_user.id, daily_cap=cap)
        db.add(prefs)
    else:
        prefs.daily_cap = cap
    await db.commit()
    return {"daily_cap": cap, "message": f"Daily cap updated to {cap} applications/day"}


@router.get("/{application_id}/screenshot")
async def get_proof_screenshot(
    application_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Streams full-page proof screenshot from Playwright dry-run"""
    result = await db.execute(
        select(Application).where(Application.id == application_id, Application.user_id == current_user.id)
    )
    app = result.scalar_one_or_none()
    if not app or not app.submission_proof_screenshot or not os.path.exists(app.submission_proof_screenshot):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proof screenshot not found")

    return FileResponse(app.submission_proof_screenshot, media_type="image/png")


@router.get("/safety-status")
async def get_safety_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns safety metrics:
    - Daily application quota and applied count
    - Emergency Kill Switch state
    - Current apply mode (review_then_apply vs auto_apply)
    """
    pref_res = await db.execute(select(JobPreference).where(JobPreference.user_id == current_user.id))
    prefs = pref_res.scalar_one_or_none()

    daily_cap = prefs.daily_cap if prefs else 15
    kill_switch = prefs.kill_switch if prefs else False
    apply_mode = prefs.apply_mode if prefs else "review_then_apply"

    now = datetime.now(timezone.utc)
    start_of_day = datetime(now.year, now.month, now.day)

    count_res = await db.execute(
        select(func.count(Application.id))
        .where(
            Application.user_id == current_user.id,
            Application.status.in_(["applied", "review_ready"]),
            Application.created_at >= start_of_day
        )
    )
    applied_today = count_res.scalar() or 0
    remaining = max(0, daily_cap - applied_today)

    return {
        "daily_cap": daily_cap,
        "applied_today": applied_today,
        "remaining_today": remaining,
        "kill_switch_active": kill_switch,
        "apply_mode": apply_mode,
        "is_cap_reached": applied_today >= daily_cap
    }


class KillSwitchRequest(BaseModel):
    kill_switch: Optional[bool] = None  # None toggles, bool sets explicit state


@router.post("/kill-switch")
async def toggle_kill_switch(
    request: KillSwitchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Instant Emergency Kill Switch:
    Immediately halts all automated applying operations for the user.
    """
    pref_res = await db.execute(select(JobPreference).where(JobPreference.user_id == current_user.id))
    prefs = pref_res.scalar_one_or_none()
    if not prefs:
        prefs = JobPreference(user_id=current_user.id, kill_switch=True)
        db.add(prefs)
    else:
        if request.kill_switch is not None:
            prefs.kill_switch = request.kill_switch
        else:
            prefs.kill_switch = not prefs.kill_switch

    await db.commit()
    await db.refresh(prefs)

    status_str = "ACTIVE (ALL AGENTS STOPPED)" if prefs.kill_switch else "DISENGAGED (OPERATIONAL)"
    event_msg = f"Emergency Kill Switch is now {status_str}"

    # Broadcast event via WebSocket to user
    await event_stream.emit_event(
        user_id=str(current_user.id),
        event_type="KILL_SWITCH_UPDATED",
        message=event_msg,
        payload={"kill_switch_active": prefs.kill_switch}
    )

    return {
        "kill_switch_active": prefs.kill_switch,
        "message": event_msg
    }


class QueueAutoApplyRequest(BaseModel):
    match_ids: List[uuid.UUID]
    is_dry_run: bool = True


@router.post("/queue-auto")
async def queue_auto_apply(
    request: QueueAutoApplyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Dispatches matches to background application worker queue (Celery or Async task fleet)
    with human-like delays, quota checking, and kill-switch guardrails.
    """
    if not request.match_ids:
        raise HTTPException(status_code=400, detail="No match IDs provided to queue")

    # Safety Pre-check
    pref_res = await db.execute(select(JobPreference).where(JobPreference.user_id == current_user.id))
    prefs = pref_res.scalar_one_or_none()
    if prefs and prefs.kill_switch:
        raise HTTPException(
            status_code=400,
            detail="Cannot queue applications while Emergency Kill Switch is ACTIVE. Disengage kill switch first."
        )

    # Dispatch to background task runner
    result = task_runner.dispatch_batch_apply(
        user_id=current_user.id,
        match_ids=request.match_ids,
        is_dry_run=request.is_dry_run
    )

    return {
        "status": "queued",
        "count": len(request.match_ids),
        "execution_mode": result["mode"],
        "task_id": result["task_id"],
        "message": f"Queued {len(request.match_ids)} jobs for automated processing."
    }
