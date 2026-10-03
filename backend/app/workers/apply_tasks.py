import asyncio
import logging
import random
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.workers.celery_app import celery_app
from app.database import AsyncSessionLocal
from app.models.user import User
from app.models.preference import JobPreference
from app.models.profile import MasterProfile
from app.models.job import Job, JobMatch
from app.models.application import Application, TailoredResume, ApplicationEvent
from app.services.apply_service import apply_service
from app.services.tailoring_service import tailoring_service
from app.services.event_stream import event_stream

logger = logging.getLogger(__name__)


async def async_apply_job(
    user_id: uuid.UUID,
    match_id: uuid.UUID,
    is_dry_run: bool = True
) -> Dict[str, Any]:
    """
    Core business logic for automated job application:
    - Enforces emergency kill-switch
    - Enforces daily application cap
    - Applies randomized human jitter delay
    - Auto-tailors resume if needed
    - Fills form with Playwright adapter & captures screenshot proof
    - Emits live WebSocket / SSE telemetry
    """
    user_id_str = str(user_id)
    async with AsyncSessionLocal() as db:
        # 1. Fetch user preferences & profile
        pref_res = await db.execute(select(JobPreference).where(JobPreference.user_id == user_id))
        prefs = pref_res.scalar_one_or_none()
        if not prefs:
            return {"status": "error", "message": "User preferences not found"}

        # Kill Switch Check
        if prefs.kill_switch:
            msg = "Emergency Kill Switch is ACTIVE. Halting all automated application operations."
            logger.warning(f"User {user_id_str}: {msg}")
            await event_stream.emit_event(
                user_id=user_id_str,
                event_type="KILL_SWITCH_ACTIVE",
                message=msg,
                payload={"kill_switch": True}
            )
            return {"status": "aborted", "reason": "kill_switch_active", "message": msg}

        # 2. Daily Application Quota Check
        now = datetime.now(timezone.utc)
        start_of_day = datetime(now.year, now.month, now.day)
        
        count_res = await db.execute(
            select(func.count(Application.id))
            .where(
                Application.user_id == user_id,
                Application.status.in_(["applied", "review_ready"]),
                Application.created_at >= start_of_day
            )
        )
        applied_today = count_res.scalar() or 0
        daily_cap = prefs.daily_cap or 15

        if applied_today >= daily_cap:
            msg = f"Daily application cap ({daily_cap}) reached for today ({applied_today} applied). Resting agent until tomorrow."
            logger.info(f"User {user_id_str}: {msg}")
            await event_stream.emit_event(
                user_id=user_id_str,
                event_type="DAILY_CAP_REACHED",
                message=msg,
                payload={"applied_today": applied_today, "daily_cap": daily_cap}
            )
            return {"status": "aborted", "reason": "daily_cap_reached", "message": msg}

        # 3. Fetch Match & Job Details
        match_res = await db.execute(
            select(JobMatch)
            .options(selectinload(JobMatch.job), selectinload(JobMatch.tailored_resume))
            .where(JobMatch.id == match_id, JobMatch.user_id == user_id)
        )
        match = match_res.scalar_one_or_none()
        if not match:
            # Fallback: match_id may be a direct Job ID pushed from discovery
            job_res = await db.execute(select(Job).where(Job.id == match_id))
            fallback_job = job_res.scalar_one_or_none()
            if fallback_job:
                # Check if a match for this user & job already exists
                existing_m_res = await db.execute(
                    select(JobMatch)
                    .options(selectinload(JobMatch.job), selectinload(JobMatch.tailored_resume))
                    .where(JobMatch.user_id == user_id, JobMatch.job_id == fallback_job.id)
                )
                match = existing_m_res.scalar_one_or_none()
                if not match:
                    match = JobMatch(
                        id=uuid.uuid4(),
                        user_id=user_id,
                        job_id=fallback_job.id,
                        match_score=75,
                        status="queued",
                        matched_skills=[],
                        missing_skills=[],
                        match_rationale="Queued via discovery"
                    )
                    db.add(match)
                    await db.commit()
                    await db.refresh(match)
                match.job = fallback_job
            else:
                return {"status": "error", "message": "Job match not found"}

        job = match.job

        # 4. Human-like Jitter Pause (5 to 12 seconds) to avoid bot-detection heuristics
        jitter_delay = round(random.uniform(4.0, 9.0), 1)
        await event_stream.emit_event(
            user_id=user_id_str,
            event_type="AGENT_STATUS",
            message=f"Human behavioral pause ({jitter_delay}s) before navigating to {job.company_name} ATS portal...",
            payload={"delay_seconds": jitter_delay, "job_title": job.title, "company": job.company_name}
        )
        await asyncio.sleep(jitter_delay)

        # 5. Check if Resume is Tailored; if not, tailor automatically
        prof_res = await db.execute(
            select(MasterProfile).where(MasterProfile.user_id == user_id, MasterProfile.is_primary == True)
        )
        profile = prof_res.scalar_one_or_none()

        if not match.tailored_resume and profile:
            await event_stream.emit_event(
                user_id=user_id_str,
                event_type="TAILORING_STARTED",
                message=f"Auto-tailoring ATS resume for {job.title} at {job.company_name}...",
                payload={"job_id": str(job.id), "title": job.title}
            )
            try:
                tailored = await tailoring_service.tailor_for_job(
                    db=db,
                    user_id=user_id,
                    job_match_id=match.id,
                    profile=profile,
                    job=job
                )
                await event_stream.emit_event(
                    user_id=user_id_str,
                    event_type="TAILORING_COMPLETED",
                    message=f"Tailored resume and custom cover letter ready for {job.company_name}.",
                    payload={"tailored_id": str(tailored.id), "ats_score": tailored.ats_score}
                )
            except Exception as e:
                logger.error(f"Tailoring failed during auto-apply: {e}")

        # 6. Stage Application
        application = await apply_service.get_or_create_application(
            db=db,
            user_id=user_id,
            job_match_id=match.id
        )

        # 7. Form-filling via Playwright (Dry-run proof)
        await event_stream.emit_event(
            user_id=user_id_str,
            event_type="DRY_RUN_STARTED",
            message=f"Playwright agent loading {job.ats_type} application form for {job.company_name}...",
            payload={"application_id": str(application.id), "ats_type": job.ats_type}
        )

        application = await apply_service.execute_dry_run(
            db=db,
            user_id=user_id,
            application_id=application.id
        )

        # 8. Check User's Apply Mode: Auto-submit vs Review
        if not is_dry_run or prefs.apply_mode in ["auto_apply", "auto_with_cap", "full_auto"]:
            application = await apply_service.approve_and_submit(
                db=db,
                user_id=user_id,
                application_id=application.id
            )
            msg = f"Auto-applied successfully to {job.title} at {job.company_name}!"
            await event_stream.emit_event(
                user_id=user_id_str,
                event_type="APPLICATION_SUBMITTED",
                message=msg,
                payload={
                    "application_id": str(application.id),
                    "job_title": job.title,
                    "company": job.company_name,
                    "status": "applied"
                }
            )
        else:
            msg = f"Dry-run proof captured for {job.title} at {job.company_name}. Ready for 1-click review."
            await event_stream.emit_event(
                user_id=user_id_str,
                event_type="DRY_RUN_COMPLETED",
                message=msg,
                payload={
                    "application_id": str(application.id),
                    "job_title": job.title,
                    "company": job.company_name,
                    "status": "review_ready",
                    "has_proof": bool(application.submission_proof_screenshot)
                }
            )

        return {
            "status": "success",
            "application_id": str(application.id),
            "application_status": application.status,
            "job_title": job.title,
            "company": job.company_name
        }


async def async_batch_apply(
    user_id: uuid.UUID,
    match_ids: List[uuid.UUID],
    is_dry_run: bool = True
) -> List[Dict[str, Any]]:
    """Runs a batch sequence of job applications with rate-limits and safety checks"""
    results = []
    for match_id in match_ids:
        # Re-check kill switch before each job
        res = await async_apply_job(user_id=user_id, match_id=match_id, is_dry_run=is_dry_run)
        results.append(res)
        if res.get("status") == "aborted":
            break
        # Inter-job cooldown pause (3-6s)
        await asyncio.sleep(random.uniform(3.0, 6.0))
    return results


# Celery Task Wrappers
@celery_app.task(name="app.workers.apply_tasks.run_auto_apply_job")
def run_auto_apply_job(user_id_str: str, match_id_str: str, is_dry_run: bool = True):
    """Celery worker task for single job auto-apply"""
    return asyncio.run(async_apply_job(
        user_id=uuid.UUID(user_id_str),
        match_id=uuid.UUID(match_id_str),
        is_dry_run=is_dry_run
    ))


@celery_app.task(name="app.workers.apply_tasks.run_batch_apply_jobs")
def run_batch_apply_jobs(user_id_str: str, match_ids_strs: List[str], is_dry_run: bool = True):
    """Celery worker task for batch auto-apply"""
    return asyncio.run(async_batch_apply(
        user_id=uuid.UUID(user_id_str),
        match_ids=[uuid.UUID(m) for m in match_ids_strs],
        is_dry_run=is_dry_run
    ))
