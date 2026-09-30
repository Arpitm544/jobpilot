import os
import uuid
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.models.job import Job, JobMatch
from app.models.application import Application, TailoredResume, ApplicationEvent
from app.schemas.application import ApplicationResponse
from app.api.deps import get_current_user
from app.services.apply_service import apply_service

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

    # 2. Fetch all job matches
    match_res = await db.execute(
        select(JobMatch)
        .options(
            selectinload(JobMatch.job),
            selectinload(JobMatch.tailored_resume)
        )
        .where(JobMatch.user_id == current_user.id)
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

    # Map applied job IDs
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

    # Add matches that haven't been staged into an application yet
    for m in matches:
        if m.job_id not in applied_job_ids:
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


@router.get("/{application_id}/screenshot")
async def get_proof_screenshot(
    application_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """Streams full-page proof screenshot from Playwright dry-run"""
    result = await db.execute(select(Application).where(Application.id == application_id))
    app = result.scalar_one_or_none()
    if not app or not app.submission_proof_screenshot or not os.path.exists(app.submission_proof_screenshot):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proof screenshot not found")

    return FileResponse(app.submission_proof_screenshot, media_type="image/png")
