import os
import uuid
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.resume import Resume
from app.models.profile import MasterProfile, QuestionBank
from app.models.preference import JobPreference
from app.api.deps import get_current_user

router = APIRouter(prefix="/onboarding", tags=["Onboarding"])


class StepUpdateRequest(BaseModel):
    step: int = Field(..., ge=0, le=4)


@router.get("/state")
async def get_onboarding_state(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns user's full onboarding state:
    - has_resume
    - resume details (id, filename, uploaded_at, status, parse_summary, download_url)
    - has_active_profile
    - profile_completeness (percentage 0-100)
    - last_completed_step (server-persisted)
    - preferences_saved
    - question_bank_saved
    """
    # 1. Fetch latest resume
    res_stmt = select(Resume).where(
        Resume.user_id == current_user.id
    ).order_by(Resume.created_at.desc())
    resume_res = await db.execute(res_stmt)
    latest_resume = resume_res.scalars().first()

    # 2. Fetch primary MasterProfile
    mp_stmt = select(MasterProfile).where(
        MasterProfile.user_id == current_user.id,
        MasterProfile.is_primary == True
    )
    mp_res = await db.execute(mp_stmt)
    profile = mp_res.scalar_one_or_none()

    # 3. Fetch Job Preferences
    pref_stmt = select(JobPreference).where(JobPreference.user_id == current_user.id)
    pref_res = await db.execute(pref_stmt)
    preferences = pref_res.scalar_one_or_none()

    # 4. Fetch Question Bank
    qb_stmt = select(QuestionBank).where(QuestionBank.user_id == current_user.id)
    qb_res = await db.execute(qb_stmt)
    question_bank = qb_res.scalar_one_or_none()

    # Determine has_resume & resume dict
    has_resume = bool(latest_resume)
    resume_info = None

    # Calculate summary text from profile data
    skills_count = 0
    projects_count = 0
    exp_count = 0
    edu_count = 0

    if profile:
        if profile.skills and isinstance(profile.skills, dict):
            skills_count = sum(len(v) for v in profile.skills.values() if isinstance(v, list))
        projects_count = len(profile.projects or [])
        exp_count = len(profile.experience or [])
        edu_count = len(profile.education or [])

    parse_summary_parts = []
    if skills_count > 0:
        parse_summary_parts.append(f"{skills_count} skills")
    if projects_count > 0:
        parse_summary_parts.append(f"{projects_count} project{'s' if projects_count != 1 else ''}")
    if exp_count > 0:
        parse_summary_parts.append(f"{exp_count} experience{'s' if exp_count != 1 else ''}")
    if edu_count > 0:
        parse_summary_parts.append(f"{edu_count} education entr{'ies' if edu_count != 1 else 'y'}")

    parse_summary = ", ".join(parse_summary_parts) if parse_summary_parts else "Resume processed"

    if latest_resume:
        resume_info = {
            "id": str(latest_resume.id),
            "filename": latest_resume.filename,
            "uploaded_at": latest_resume.created_at.isoformat() if latest_resume.created_at else "",
            "status": latest_resume.status,
            "parse_summary": parse_summary,
            "download_url": f"/api/v1/resumes/{latest_resume.id}/download",
        }

    # Determine has_active_profile (requires actual resume content: skills, projects, experience, education, or summary)
    has_active_profile = bool(
        profile and (
            (bool(profile.summary) and len(profile.summary.strip()) > 20) or
            skills_count > 0 or
            projects_count > 0 or
            exp_count > 0 or
            edu_count > 0
        )
    )

    # Calculate completeness
    completeness = 0
    if profile:
        ci = profile.contact_info or {}
        if ci.get("full_name"): completeness += 15
        if ci.get("email"): completeness += 10
        if ci.get("phone") or ci.get("location"): completeness += 10
        if profile.summary and len(profile.summary) > 20: completeness += 15
        if skills_count >= 5: completeness += 20
        elif skills_count > 0: completeness += 10
        if projects_count > 0: completeness += 15
        if exp_count > 0: completeness += 10
        if edu_count > 0: completeness += 5
    completeness = min(100, completeness)

    # Determine preferences_saved & question_bank_saved
    preferences_saved = bool(
        preferences and preferences.target_roles and len(preferences.target_roles) > 0
    )
    question_bank_saved = bool(
        question_bank and (
            bool(question_bank.expected_ctc) or
            bool(question_bank.current_ctc) or
            bool(question_bank.portfolio_url)
        )
    )

    # Server-persisted last_completed_step is the single source of truth
    last_step = current_user.last_completed_step or 0

    return {
        "has_resume": has_resume,
        "resume": resume_info,
        "has_active_profile": has_active_profile,
        "profile_completeness": completeness,
        "last_completed_step": last_step,
        "preferences_saved": preferences_saved,
        "question_bank_saved": question_bank_saved,
    }


@router.put("/step")
@router.post("/step")
async def update_onboarding_step(
    body: StepUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Explicitly persists the user's latest completed onboarding step server-side"""
    current_user.last_completed_step = max(current_user.last_completed_step or 0, body.step)
    await db.commit()
    return {"last_completed_step": current_user.last_completed_step}
