import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.models.job import Job, JobMatch, Source
from app.models.profile import MasterProfile
from app.models.preference import JobPreference
from app.schemas.job import JobResponse, JobMatchResponse, JobCreate
from app.api.deps import get_current_user
from app.services.discovery_service import discovery_service, compute_dedupe_hash
from app.services.scoring_service import scoring_service

router = APIRouter(prefix="/jobs", tags=["Job Discovery & Matching"])


class JobActionRequest(BaseModel):
    action: str  # "queue", "dismiss", "restore"


class ManualJobIngestRequest(BaseModel):
    company_name: str
    title: str
    location: str = "Remote"
    workplace_type: str = "Remote"
    job_type: str = "Full-time"
    salary_range: Optional[str] = None
    jd_text: str
    apply_url: str


async def _get_or_create_primary_profile(db: AsyncSession, current_user: User) -> MasterProfile:
    """Fetch primary master profile or fallback to any existing profile / default template"""
    prof_res = await db.execute(
        select(MasterProfile).where(
            MasterProfile.user_id == current_user.id,
            MasterProfile.is_primary == True
        )
    )
    profile = prof_res.scalar_one_or_none()
    if not profile:
        # Fallback to any profile belonging to user
        any_res = await db.execute(
            select(MasterProfile)
            .where(MasterProfile.user_id == current_user.id)
            .order_by(MasterProfile.version.desc())
        )
        profile = any_res.scalars().first()
        if profile:
            profile.is_primary = True
            await db.commit()
            await db.refresh(profile)

    if not profile:
        # Initialize default master profile template so user can discover jobs without crashing
        profile = MasterProfile(
            id=uuid.uuid4(),
            user_id=current_user.id,
            version_name="Primary Master Profile",
            version=1,
            is_primary=True,
            is_active=True,
            contact_info={
                "full_name": current_user.full_name or "",
                "email": current_user.email,
                "phone": "",
                "location": "",
                "linkedin": "",
                "github": "",
                "portfolio": ""
            },
            summary="",
            skills={
                "languages": [],
                "frameworks": [],
                "databases": [],
                "tools": [],
                "cloud_devops": [],
                "soft_skills": []
            },
            experience=[],
            projects=[],
            education=[],
            certifications=[],
            achievements=[],
            links=[]
        )
        db.add(profile)
        await db.commit()
        await db.refresh(profile)

    return profile


@router.post("/discover", response_model=List[JobMatchResponse])
async def trigger_discovery(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Triggers on-demand discovery across ATS boards (Greenhouse, Lever, Ashby),
    deduplicates against database, and scores all matching jobs against candidate profile.
    """
    # 1. Fetch user preferences
    pref_res = await db.execute(select(JobPreference).where(JobPreference.user_id == current_user.id))
    prefs = pref_res.scalar_one_or_none()
    if not prefs:
        prefs = JobPreference(user_id=current_user.id)
        db.add(prefs)
        await db.commit()
        await db.refresh(prefs)

    # 2. Fetch or initialize primary master profile
    profile = await _get_or_create_primary_profile(db, current_user)

    # 3. Run Discovery
    jobs = await discovery_service.discover_jobs_for_user(
        db=db,
        user_id=current_user.id,
        preferences=prefs
    )

    # 4. Score top discovered jobs efficiently
    import asyncio
    profile_skills = scoring_service.extract_profile_skill_pool(profile)
    profile_text = f"{profile.summary or ''} Skills: {', '.join(profile_skills)}"
    try:
        from app.services.gemini_service import gemini_service
        vec_profile = await asyncio.wait_for(gemini_service.get_embedding(profile_text), timeout=2.5)
    except Exception:
        vec_profile = [0.0] * 768

    top_jobs = jobs[:10]
    async def _embed_job(j):
        req = (j.jd_parsed_skills or {}).get("required_skills") or []
        summary = f"{j.title} at {j.company_name}. Required: {', '.join(req)}. {j.jd_text[:1000]}"
        try:
            return await asyncio.wait_for(gemini_service.get_embedding(summary), timeout=2.5)
        except Exception:
            return [0.0] * 768

    jd_vecs = await asyncio.gather(*[_embed_job(j) for j in top_jobs], return_exceptions=True)

    # Batch query existing matches for top jobs in a single roundtrip
    top_job_ids = [j.id for j in top_jobs]
    existing_matches_map = {}
    if top_job_ids:
        match_query = await db.execute(
            select(JobMatch).where(
                JobMatch.user_id == current_user.id,
                JobMatch.job_id.in_(top_job_ids)
            )
        )
        existing_matches_map = {m.job_id: m for m in match_query.scalars().all()}

    matches: List[JobMatch] = []
    for idx, job in enumerate(top_jobs):
        vec_jd = jd_vecs[idx] if idx < len(jd_vecs) and isinstance(jd_vecs[idx], list) else None
        match = await scoring_service.calculate_match(
            db=db,
            user_id=current_user.id,
            job=job,
            profile=profile,
            preferences=prefs,
            cached_profile_vec=vec_profile,
            cached_jd_vec=vec_jd,
            existing_match=existing_matches_map.get(job.id),
            use_ai_parse=False,
            auto_commit=False
        )
        match.job = job
        matches.append(match)

    await db.commit()
    # Sort matches by score descending
    matches.sort(key=lambda m: m.match_score, reverse=True)
    return matches


@router.get("/matches", response_model=List[JobMatchResponse])
async def list_job_matches(
    match_status: Optional[str] = Query(None, description="discovered, queued, tailored, applied, dismissed"),
    min_score: Optional[float] = Query(None, ge=0, le=100),
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List scored job matches with filtering by status and match threshold"""
    query = (
        select(JobMatch)
        .options(selectinload(JobMatch.job))
        .where(JobMatch.user_id == current_user.id)
        .order_by(desc(JobMatch.match_score))
    )

    if match_status and match_status != "all":
        query = query.where(JobMatch.status == match_status)
    if min_score is not None:
        query = query.where(JobMatch.match_score >= min_score)

    result = await db.execute(query)
    matches = result.scalars().all()

    if search:
        s_lower = search.lower()
        matches = [
            m for m in matches
            if s_lower in m.job.title.lower() or s_lower in m.job.company_name.lower() or s_lower in m.job.location.lower()
        ]

    return matches


@router.get("/{job_id}", response_model=JobResponse)
async def get_job_details(
    job_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve full job details including full JD text and requirements"""
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return job


@router.post("/{job_id}/action", response_model=JobMatchResponse)
async def update_job_match_status(
    job_id: uuid.UUID,
    body: JobActionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Move job match between states: 'queued' (ready for tailoring), 'dismissed', 'discovered'"""
    result = await db.execute(
        select(JobMatch)
        .options(selectinload(JobMatch.job))
        .where(JobMatch.job_id == job_id, JobMatch.user_id == current_user.id)
    )
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job match not found for user")

    valid_actions = {
        "queue": "queued",
        "dismiss": "dismissed",
        "restore": "discovered",
    }
    new_status = valid_actions.get(body.action)
    if not new_status:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid action '{body.action}'")

    match.status = new_status
    await db.commit()
    await db.refresh(match)
    return match


@router.post("/manual-add", response_model=JobMatchResponse)
@router.post("/manual", response_model=JobMatchResponse)
async def manually_add_job(
    body: ManualJobIngestRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Manually paste any Job Description or custom URL to parse, score, and queue instantly.
    """
    # Check Master Profile
    profile = await _get_or_create_primary_profile(db, current_user)

    pref_res = await db.execute(select(JobPreference).where(JobPreference.user_id == current_user.id))
    prefs = pref_res.scalar_one_or_none()
    if not prefs:
        prefs = JobPreference(user_id=current_user.id)
        db.add(prefs)
        await db.commit()

    dedupe_hash = compute_dedupe_hash(body.company_name, body.title, body.location)
    source = await discovery_service.get_or_create_source(db, "manual", source_type="manual")

    existing_job_res = await db.execute(select(Job).where(Job.dedupe_hash == dedupe_hash))
    job = existing_job_res.scalar_one_or_none()

    if not job:
        job = Job(
            id=uuid.uuid4(),
            source_id=source.id,
            company_name=body.company_name,
            title=body.title,
            location=body.location,
            workplace_type=body.workplace_type,
            job_type=body.job_type,
            salary_range=body.salary_range,
            jd_text=body.jd_text,
            apply_url=body.apply_url,
            ats_type="manual",
            dedupe_hash=dedupe_hash,
            is_active=True,
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)

    # Score job
    match = await scoring_service.calculate_match(
        db=db,
        user_id=current_user.id,
        job=job,
        profile=profile,
        preferences=prefs
    )
    match.job = job
    return match
