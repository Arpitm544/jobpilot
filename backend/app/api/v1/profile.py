import os
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
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
        parsed_data, raw_text, parsing_mode = await resume_parser_service.parse_resume_file(
            file_bytes=content,
            filename=file.filename or "resume.pdf"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to parse resume: {str(e)}"
        )

    # Upsert primary Master Profile in database
    result = await db.execute(
        select(MasterProfile).where(
            MasterProfile.user_id == current_user.id,
            MasterProfile.is_primary == True
        )
    )
    profile = result.scalar_one_or_none()

    profile_dict = parsed_data.model_dump()

    if profile:
        profile.contact_info = profile_dict.get("contact_info", {})
        profile.summary = profile_dict.get("summary", "")
        profile.skills = profile_dict.get("skills", {})
        profile.experience = profile_dict.get("experience", [])
        profile.projects = profile_dict.get("projects", [])
        profile.education = profile_dict.get("education", [])
        profile.certifications = profile_dict.get("certifications", [])
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
            links=profile_dict.get("links", []),
            original_filename=file.filename,
            raw_extracted_text=raw_text
        )
        db.add(profile)

    # If contact info contains name and user hasn't set their full name, update user
    if parsed_data.contact_info.full_name and not current_user.full_name:
        current_user.full_name = parsed_data.contact_info.full_name

    await db.commit()

    return ResumeParseResponse(
        success=True,
        parsed_profile=parsed_data,
        raw_text=raw_text[:2000],  # preview
        detected_name=parsed_data.contact_info.full_name,
        detected_email=parsed_data.contact_info.email,
        confidence_score=0.98 if parsing_mode == "gemini_ai" else 0.85,
        parsing_mode=parsing_mode
    )


@router.get("/master", response_model=MasterProfileResponse)
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
                "soft_skills": []
            },
            experience=[],
            projects=[],
            education=[],
            certifications=[],
            links=[]
        )
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
    return profile


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
        # Create empty profile to allow direct editing
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
            links=[]
        )
        db.add(profile)

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if value is not None:
            setattr(profile, key, value)

    await db.commit()
    await db.refresh(profile)
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

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(qb, field, value)

    await db.commit()
    await db.refresh(qb)
    return qb
