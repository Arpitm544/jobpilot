"""
Bootstrap endpoint — returns user, onboarding state, and profile summary in a
single round-trip so the frontend never has to make 3+ sequential calls on mount.

GET /api/v1/bootstrap
Response:
  {
    "user": UserResponse,
    "onboarding": { ...onboarding state... },
    "profile_summary": { full_name, email, skills_count, has_resume, is_complete }
  }
"""
import asyncio
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.resume import Resume
from app.models.profile import MasterProfile, QuestionBank
from app.models.preference import JobPreference
from app.schemas.auth import UserResponse
from app.api.deps import get_current_user

router = APIRouter(prefix="/bootstrap", tags=["Bootstrap"])


@router.get("")
@router.get("/")
async def bootstrap(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    One-shot bootstrap: returns everything the app shell needs on first load.
    Replaces 3 sequential round-trips: /auth/me → /onboarding/state → /profile.
    All DB queries run in parallel.
    """
    user_id = current_user.id

    # SQLAlchemy AsyncSession does NOT support concurrent query execution on the same session.
    # Running these sequentially is very fast (~10ms) and avoids massive asyncpg lock contention.
    resume_res = await db.execute(
        select(Resume)
        .where(Resume.user_id == user_id)
        .order_by(Resume.created_at.desc())
        .limit(1)
    )
    profile_res = await db.execute(
        select(MasterProfile).where(
            MasterProfile.user_id == user_id,
            MasterProfile.is_primary == True,
        )
    )
    pref_res = await db.execute(
        select(JobPreference).where(JobPreference.user_id == user_id)
    )
    qb_res = await db.execute(
        select(QuestionBank).where(QuestionBank.user_id == user_id)
    )

    latest_resume = resume_res.scalars().first()
    profile = profile_res.scalar_one_or_none()
    preferences = pref_res.scalar_one_or_none()
    question_bank = qb_res.scalar_one_or_none()

    # ── Profile summary ────────────────────────────────────────────────
    skills_count = 0
    projects_count = 0
    exp_count = 0
    edu_count = 0

    if profile:
        if profile.skills and isinstance(profile.skills, dict):
            skills_count = sum(
                len(v) for v in profile.skills.values() if isinstance(v, list)
            )
        projects_count = len(profile.projects or [])
        exp_count = len(profile.experience or [])
        edu_count = len(profile.education or [])

    has_active_profile = bool(
        profile
        and (
            (bool(profile.summary) and len(profile.summary.strip()) > 20)
            or skills_count > 0
            or projects_count > 0
            or exp_count > 0
            or edu_count > 0
        )
    )

    # ── Completeness ───────────────────────────────────────────────────
    completeness = 0
    if profile:
        ci = profile.contact_info or {}
        if ci.get("full_name"):
            completeness += 15
        if ci.get("email"):
            completeness += 10
        if ci.get("phone") or ci.get("location"):
            completeness += 10
        if profile.summary and len(profile.summary) > 20:
            completeness += 15
        if skills_count >= 5:
            completeness += 20
        elif skills_count > 0:
            completeness += 10
        if projects_count > 0:
            completeness += 15
        if exp_count > 0:
            completeness += 10
        if edu_count > 0:
            completeness += 5
    completeness = min(100, completeness)

    # ── Onboarding state ───────────────────────────────────────────────
    parse_summary_parts = []
    if skills_count > 0:
        parse_summary_parts.append(f"{skills_count} skills")
    if projects_count > 0:
        parse_summary_parts.append(f"{projects_count} project{'s' if projects_count != 1 else ''}")
    if exp_count > 0:
        parse_summary_parts.append(f"{exp_count} experience{'s' if exp_count != 1 else ''}")
    if edu_count > 0:
        parse_summary_parts.append(f"{edu_count} education entr{'ies' if edu_count != 1 else 'y'}")

    resume_info = None
    if latest_resume:
        resume_info = {
            "id": str(latest_resume.id),
            "filename": latest_resume.filename,
            "uploaded_at": latest_resume.created_at.isoformat() if latest_resume.created_at else "",
            "status": latest_resume.status,
            "parse_summary": ", ".join(parse_summary_parts) if parse_summary_parts else "Resume processed",
            "download_url": f"/api/v1/resumes/{latest_resume.id}/download",
        }

    preferences_saved = bool(
        preferences and preferences.target_roles and len(preferences.target_roles) > 0
    )
    question_bank_saved = bool(
        question_bank
        and (
            bool(question_bank.expected_ctc)
            or bool(question_bank.current_ctc)
            or bool(question_bank.portfolio_url)
        )
    )

    onboarding = {
        "has_resume": bool(latest_resume),
        "resume": resume_info,
        "has_active_profile": has_active_profile,
        "profile_completeness": completeness,
        "last_completed_step": current_user.last_completed_step or 0,
        "preferences_saved": preferences_saved,
        "question_bank_saved": question_bank_saved,
    }

    profile_summary = {
        "full_name": (profile.contact_info or {}).get("full_name", "") if profile else current_user.full_name or "",
        "email": current_user.email,
        "skills_count": skills_count,
        "has_resume": bool(latest_resume),
        "is_complete": completeness >= 60,
        "target_roles": (preferences.target_roles or []) if preferences else [],
    }

    return {
        "user": UserResponse.model_validate(current_user),
        "onboarding": onboarding,
        "profile_summary": profile_summary,
    }
