import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.preference import JobPreference
from app.schemas.preference import (
    JobPreferenceBase,
    JobPreferenceUpdate,
    JobPreferenceResponse,
)
from app.api.deps import get_current_user

router = APIRouter(prefix="/preferences", tags=["Job Preferences"])


@router.get("", response_model=JobPreferenceResponse)
@router.get("/", response_model=JobPreferenceResponse, include_in_schema=False)
async def get_job_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(JobPreference).where(JobPreference.user_id == current_user.id)
    )
    prefs = result.scalar_one_or_none()
    if not prefs:
        prefs = JobPreference(
            id=uuid.uuid4(),
            user_id=current_user.id,
            target_roles=["Full-Stack Developer", "Frontend Developer"],
            locations=["Remote"],
            apply_mode="review_then_apply",
            daily_cap=20,
            match_threshold=70,
        )
        db.add(prefs)
        await db.commit()
        await db.refresh(prefs)
    return prefs


@router.put("", response_model=JobPreferenceResponse)
@router.put("/", response_model=JobPreferenceResponse, include_in_schema=False)
async def update_job_preferences(
    body: JobPreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(JobPreference).where(JobPreference.user_id == current_user.id)
    )
    prefs = result.scalar_one_or_none()
    if not prefs:
        prefs = JobPreference(
            id=uuid.uuid4(),
            user_id=current_user.id,
        )
        db.add(prefs)

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if value is not None:
            setattr(prefs, key, value)

    # Persist last_completed_step server-side (Step 3 completed)
    current_user.last_completed_step = max(current_user.last_completed_step or 0, 3)

    await db.commit()
    await db.refresh(prefs)
    return prefs
