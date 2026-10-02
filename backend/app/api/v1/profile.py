import os
import uuid
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.profile import MasterProfile, QuestionBank
from app.schemas.profile import (
    MasterProfileData,
    MasterProfileCreate,
    MasterProfileUpdate,
    MasterProfileResponse,
    ResumeParseResponse,
    QuestionBankData,
    QuestionBankResponse,
)
from app.api.deps import get_current_user
from app.services.resume_parser import resume_parser_service
from app.services.resume_verifier import resume_verifier
from app.services.github_service import github_repo_suggester
from app.services.gemini_service import gemini_service
from app.config import settings

router = APIRouter(prefix="/profile", tags=["Profile & Resume"])


@router.post("/upload-resume", response_model=ResumeParseResponse)
async def upload_and_parse_resume(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Accepts PDF, DOCX, or TXT resume.
    Parses via pdfplumber/python-docx and structures with Gemini into Master Profile schema.
    Persists to database as user's primary Master Profile.
    """
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")

    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_MB}MB."
        )

    # Save physical copy for audit/history
    user_upload_dir = os.path.join(settings.UPLOAD_DIR, str(current_user.id))
    os.makedirs(user_upload_dir, exist_ok=True)
    safe_filename = f"{uuid.uuid4().hex[:8]}_{file.filename}"
    file_path = os.path.join(user_upload_dir, safe_filename)
    with open(file_path, "wb") as f:
        f.write(content)

    # Run parsing
    try:
        parsed_data, raw_text, extracted_links, ocr_used, parsing_mode = await resume_parser_service.parse_resume_file(
            file_bytes=content,
            filename=file.filename or "resume.pdf"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to parse resume: {str(e)}"
        )

    # Zero-hallucination verification
    verified_data, _, _ = resume_verifier.verify_profile(
        profile=parsed_data,
        raw_text=raw_text,
        extracted_links=extracted_links
    )

    # Upsert primary Master Profile in database
    result = await db.execute(
        select(MasterProfile).where(
            MasterProfile.user_id == current_user.id,
            MasterProfile.is_primary == True
        )
    )
    profile = result.scalar_one_or_none()

    profile_dict = verified_data.model_dump()

    if profile:
        profile.contact_info = profile_dict.get("contact_info", {})
        profile.summary = profile_dict.get("summary", "")
        profile.skills = profile_dict.get("skills", {})
        profile.experience = profile_dict.get("experience", [])
        profile.projects = profile_dict.get("projects", [])
        profile.education = profile_dict.get("education", [])
        profile.certifications = profile_dict.get("certifications", [])
        profile.achievements = profile_dict.get("achievements", [])
        profile.links = profile_dict.get("links", [])
        profile.original_filename = file.filename
        profile.raw_extracted_text = raw_text
    else:
        profile = MasterProfile(
            id=uuid.uuid4(),
            user_id=current_user.id,
            version_name="Primary Master Profile",
            is_primary=True,
            contact_info=profile_dict.get("contact_info", {}),
            summary=profile_dict.get("summary", ""),
            skills=profile_dict.get("skills", {}),
            experience=profile_dict.get("experience", []),
            projects=profile_dict.get("projects", []),
            education=profile_dict.get("education", []),
            certifications=profile_dict.get("certifications", []),
            achievements=profile_dict.get("achievements", []),
            links=profile_dict.get("links", []),
            original_filename=file.filename,
            raw_extracted_text=raw_text
        )
        db.add(profile)

    # If contact info contains name and user hasn't set their full name, update user
    if verified_data.contact_info.full_name and not current_user.full_name:
        current_user.full_name = verified_data.contact_info.full_name

    current_user.last_completed_step = max(current_user.last_completed_step or 0, 1)

    await db.commit()

    return ResumeParseResponse(
        success=True,
        parsed_profile=verified_data,
        raw_text=raw_text[:2000],  # preview
        detected_name=verified_data.contact_info.full_name,
        detected_email=verified_data.contact_info.email,
        confidence_score=0.98 if parsing_mode == "gemini_ai" else 0.85,
        parsing_mode=parsing_mode
    )


def _normalize_projects_list(projects: List[Any]) -> List[Dict[str, Any]]:
    normalized = []
    for p in projects or []:
        p_dict = dict(p) if isinstance(p, dict) else (p.model_dump() if hasattr(p, "model_dump") else {})
        links = p_dict.get("links") or {}
        gh = p_dict.get("github_url") or links.get("github_repo")
        demo = p_dict.get("demo_url") or links.get("live_demo")
        raw_link = p_dict.get("link")
        if raw_link:
            if "github.com" in str(raw_link) and not gh:
                gh = raw_link
            elif "github.com" not in str(raw_link) and not demo:
                demo = raw_link
        p_dict["github_url"] = gh
        p_dict["demo_url"] = demo
        p_dict["link"] = demo or gh or raw_link
        p_dict["links"] = {"github_repo": gh, "live_demo": demo}
        normalized.append(p_dict)
    return normalized


@router.get("", response_model=MasterProfileResponse)
@router.get("/", response_model=MasterProfileResponse)
@router.get("/master", response_model=MasterProfileResponse)
@router.get("/primary", response_model=MasterProfileResponse)
async def get_master_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve user's primary Master Profile, creating an initial template if none exists yet"""
    result = await db.execute(
        select(MasterProfile).where(
            MasterProfile.user_id == current_user.id,
            MasterProfile.is_primary == True
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
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
                "concepts": [],
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

    if profile and profile.projects:
        profile.projects = _normalize_projects_list(profile.projects)

    return profile


@router.put("", response_model=MasterProfileResponse)
@router.put("/", response_model=MasterProfileResponse)
@router.put("/master", response_model=MasterProfileResponse)
async def update_master_profile(
    body: MasterProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update Master Profile fields after user review & editing"""
    result = await db.execute(
        select(MasterProfile).where(
            MasterProfile.user_id == current_user.id,
            MasterProfile.is_primary == True
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        profile = MasterProfile(
            id=uuid.uuid4(),
            user_id=current_user.id,
            version_name="Primary Master Profile",
            is_primary=True,
            contact_info={},
            skills={},
            experience=[],
            projects=[],
            education=[],
            certifications=[],
            achievements=[],
            links=[]
        )
        db.add(profile)

    update_data = body.model_dump(exclude_unset=True)
    if "projects" in update_data and update_data["projects"] is not None:
        update_data["projects"] = _normalize_projects_list(update_data["projects"])

    for key, value in update_data.items():
        if value is not None:
            setattr(profile, key, value)

    # Persist last_completed_step server-side (Step 2 completed)
    current_user.last_completed_step = max(current_user.last_completed_step or 0, 2)

    await db.commit()
    await db.refresh(profile)
    if profile.projects:
        profile.projects = _normalize_projects_list(profile.projects)
    return profile


@router.get("/question-bank", response_model=QuestionBankResponse)
async def get_question_bank(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve user's common questions bank"""
    result = await db.execute(
        select(QuestionBank).where(QuestionBank.user_id == current_user.id)
    )
    qb = result.scalar_one_or_none()
    if not qb:
        qb = QuestionBank(
            id=uuid.uuid4(),
            user_id=current_user.id,
        )
        db.add(qb)
        await db.commit()
        await db.refresh(qb)
    return qb


@router.put("/question-bank", response_model=QuestionBankResponse)
async def update_question_bank(
    body: QuestionBankData,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Save or update answers to common application questions"""
    result = await db.execute(
        select(QuestionBank).where(QuestionBank.user_id == current_user.id)
    )
    qb = result.scalar_one_or_none()
    if not qb:
        qb = QuestionBank(
            id=uuid.uuid4(),
            user_id=current_user.id,
        )
        db.add(qb)

    data_dict = body.model_dump(exclude_unset=True)
    for field, value in data_dict.items():
        setattr(qb, field, value)

    # Sync country and location preferences to User
    if "home_country" in data_dict and data_dict["home_country"]:
        current_user.home_country = data_dict["home_country"].strip().upper()
    if "home_city" in data_dict:
        current_user.home_city = data_dict["home_city"]
    if "preferred_cities" in data_dict:
        current_user.preferred_cities = data_dict["preferred_cities"]
    if "citizenship" in data_dict:
        current_user.citizenship = data_dict["citizenship"]
    if "work_authorization_countries" in data_dict:
        current_user.work_authorization_countries = data_dict["work_authorization_countries"]
    if "needs_sponsorship" in data_dict:
        current_user.needs_visa_sponsorship = data_dict["needs_sponsorship"]
    if "willing_to_relocate" in data_dict:
        current_user.willing_to_relocate = data_dict["willing_to_relocate"]
    if "open_to_international" in data_dict:
        current_user.open_to_international = data_dict["open_to_international"]

    # Persist last_completed_step server-side (Step 4 completed)
    current_user.last_completed_step = max(current_user.last_completed_step or 0, 4)

    await db.commit()
    await db.refresh(qb)
    return qb


@router.get("/projects/github-suggestions")
async def get_github_repo_suggestions(
    username: Optional[str] = Query(None),
    project_name: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Opt-in suggestion flow: Discovers user's GitHub repositories and returns fuzzy-matched candidates
    for projects without auto-filling or fabricating data.
    """
    gh_user = username
    if not gh_user:
        # Check active master profile contact_info
        result = await db.execute(
            select(MasterProfile).where(
                MasterProfile.user_id == current_user.id,
                MasterProfile.is_primary == True
            )
        )
        profile = result.scalar_one_or_none()
        if profile and profile.contact_info:
            gh_link = profile.contact_info.get("github") or ""
            if "github.com" in gh_link:
                gh_user = gh_link.rstrip("/").split("/")[-1]

    if not gh_user:
        return {
            "status": "no_username",
            "message": "No GitHub profile linked. Please provide your GitHub username.",
            "suggestions": {}
        }

    repos, err_msg = await github_repo_suggester.fetch_user_repositories(gh_user)
    if err_msg and not repos:
        return {
            "status": "error",
            "message": err_msg,
            "username": gh_user,
            "suggestions": {}
        }

    # Fetch projects to match against
    projects_to_match = []
    if project_name:
        projects_to_match = [{"title": project_name}]
    else:
        result = await db.execute(
            select(MasterProfile).where(
                MasterProfile.user_id == current_user.id,
                MasterProfile.is_primary == True
            )
        )
        profile = result.scalar_one_or_none()
        if profile and profile.projects:
            projects_to_match = profile.projects

    suggestions = github_repo_suggester.match_projects_to_repos(projects_to_match, repos, threshold=65.0)

    return {
        "status": "ok",
        "username": gh_user,
        "repo_count": len(repos),
        "suggestions": suggestions,
        "rate_limit_notice": err_msg if err_msg else None
    }


@router.post("/polish-summary")
async def polish_professional_summary(
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    """
    Refines and polishes a professional summary using Gemini AI.
    Focuses on action verbs, concrete technical expertise, and conciseness.
    Returns a suggestion that the user can review, accept, or reject.
    """
    raw_summary = payload.get("summary", "").strip()
    if not raw_summary:
        raise HTTPException(status_code=400, detail="Summary text is required for polishing.")

    system_instruction = (
        "You are an expert technical career coach and resume strategist. "
        "Your task is to refine and polish the candidate's professional summary. "
        "Rules:\n"
        "1. Keep it concise (2-4 sentences max).\n"
        "2. Do NOT hallucinate skills, metrics, or years of experience not mentioned or strongly implied.\n"
        "3. Emphasize engineering mindset, impact, and core technologies mentioned.\n"
        "4. Tone: Professional, punchy, confident, third-person or first-person implied (no 'I am...').\n"
        "5. Output ONLY the polished summary text, with no explanations, no greetings, and no markdown quotes."
    )

    prompt = f"Original Professional Summary:\n{raw_summary}\n\nPlease polish this summary following the instructions."

    polished = await gemini_service.generate_text(prompt, system_instruction=system_instruction)
    if not polished:
        # Fallback polish
        sentences = [s.strip() for s in raw_summary.split(".") if s.strip()]
        polished = ". ".join(sentences) + "." if sentences else raw_summary

    return {
        "original": raw_summary,
        "polished": polished
    }

