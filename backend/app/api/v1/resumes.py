import os
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, Response
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.resume import Resume, ProfileFieldMeta
from app.models.profile import MasterProfile
from app.schemas.resume import (
    ResumeStatus,
    ResumeUploadResponse,
    ResumeStatusResponse,
    ResumeDetailResponse,
)
from app.api.deps import get_current_user
from app.services.storage_service import storage_service, StorageValidationError
from app.workers.resume_tasks import dispatch_resume_parsing

router = APIRouter(prefix="/resumes", tags=["Resumes"])


STEP_MESSAGES = {
    ResumeStatus.QUEUED: ("Waiting to process...", 10),
    ResumeStatus.EXTRACTING_TEXT: ("Reading your resume...", 35),
    ResumeStatus.ANALYZING: ("Finding your skills and experience...", 65),
    ResumeStatus.VALIDATING: ("Verifying details...", 90),
    ResumeStatus.READY: ("Resume processed successfully!", 100),
    ResumeStatus.FAILED: ("Processing failed", 0),
}


@router.post("/upload", response_model=ResumeUploadResponse)
async def upload_resume(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload a resume (PDF, DOCX, TXT) up to 5 MB.
    Validates MIME type & magic file signature.
    Caches by file_hash + user_id only if prior run successfully extracted real profile data.
    Stores the file, enqueues the parse job, and returns resume_id immediately.
    """
    if not file or not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file provided.")

    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read uploaded file: {str(e)}"
        )

    # Validate file size, signature, and MIME type
    try:
        detected_mime, detected_ext = storage_service.validate_file(content, file.filename)
    except StorageValidationError as sve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(sve)
        )

    # Compute SHA-256 hash
    file_hash = storage_service.compute_sha256(content)

    # Check cache: Only cache successful, non-empty parses
    cached_stmt = select(Resume).where(
        Resume.user_id == current_user.id,
        Resume.file_hash == file_hash,
        Resume.status == ResumeStatus.READY.value
    ).order_by(Resume.created_at.desc())
    cached_res = await db.execute(cached_stmt)
    cached_resume = cached_res.scalars().first()

    if cached_resume:
        # Check if corresponding MasterProfile actually exists and has parsed content
        mp_stmt = select(MasterProfile).where(
            MasterProfile.user_id == current_user.id,
            (MasterProfile.created_from_resume_id == cached_resume.id) | (MasterProfile.is_primary == True)
        )
        mp_res = await db.execute(mp_stmt)
        mp = mp_res.scalars().first()
        has_content = mp and (
            bool(mp.skills and any(mp.skills.values())) or
            bool(mp.projects) or
            bool(mp.experience) or
            bool(mp.contact_info and (mp.contact_info.get("location") or mp.contact_info.get("linkedin")))
        )
        if has_content:
            return ResumeUploadResponse(
                resume_id=cached_resume.id,
                filename=cached_resume.filename,
                file_hash=cached_resume.file_hash,
                file_size=cached_resume.file_size,
                status=ResumeStatus.READY,
                message="Resume retrieved from cache (already analyzed).",
                is_cached=True
            )

    # Store file safely
    try:
        storage_path, _ = storage_service.store_resume(
            user_id=str(current_user.id),
            content=content,
            original_filename=file.filename
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not store resume file: {str(e)}"
        )

    # Create Resume DB row with status 'queued'
    resume = Resume(
        id=uuid.uuid4(),
        user_id=current_user.id,
        filename=file.filename,
        storage_path=storage_path,
        file_hash=file_hash,
        file_size=len(content),
        mime_type=detected_mime,
        status=ResumeStatus.QUEUED.value,
        error_message=None,
        ocr_used=False
    )
    db.add(resume)
    await db.commit()
    await db.refresh(resume)

    # Enqueue background Celery task
    dispatch_resume_parsing(str(resume.id))

    return ResumeUploadResponse(
        resume_id=resume.id,
        filename=resume.filename,
        file_hash=resume.file_hash,
        file_size=resume.file_size,
        status=ResumeStatus.QUEUED,
        message="Resume uploaded successfully. Processing enqueued.",
        is_cached=False
    )


@router.get("/{resume_id}/status", response_model=ResumeStatusResponse)
async def get_resume_status(
    resume_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Poll status of a resume parse job:
    queued -> extracting_text -> analyzing -> validating -> ready | failed
    Returns animated step message, progress percentage, and error reason if failed.
    """
    stmt = select(Resume).where(
        Resume.id == resume_id,
        Resume.user_id == current_user.id
    )
    res = await db.execute(stmt)
    resume = res.scalar_one_or_none()
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found or access denied."
        )

    status_enum = ResumeStatus(resume.status) if resume.status in [s.value for s in ResumeStatus] else ResumeStatus.QUEUED
    step_msg, progress_pct = STEP_MESSAGES.get(status_enum, ("Processing...", 50))

    return ResumeStatusResponse(
        id=resume.id,
        status=status_enum,
        step_message=step_msg,
        progress_percent=progress_pct,
        error_message=resume.error_message,
        created_at=resume.created_at,
        updated_at=resume.updated_at
    )


@router.get("/{resume_id}", response_model=ResumeDetailResponse)
async def get_resume_details(
    resume_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get metadata for an uploaded resume"""
    stmt = select(Resume).where(
        Resume.id == resume_id,
        Resume.user_id == current_user.id
    )
    res = await db.execute(stmt)
    resume = res.scalar_one_or_none()
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found.")
    return resume


@router.get("/{resume_id}/download")
async def download_resume(
    resume_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Download the original uploaded resume file (owner only)"""
    stmt = select(Resume).where(
        Resume.id == resume_id,
        Resume.user_id == current_user.id
    )
    res = await db.execute(stmt)
    resume = res.scalar_one_or_none()
    if not resume or not os.path.exists(resume.storage_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume file not found.")

    return FileResponse(
        path=resume.storage_path,
        media_type=resume.mime_type,
        filename=resume.filename
    )


@router.delete("/{resume_id}")
async def delete_resume(
    resume_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a resume file and its associated database record (GDPR / Privacy compliance)"""
    stmt = select(Resume).where(
        Resume.id == resume_id,
        Resume.user_id == current_user.id
    )
    res = await db.execute(stmt)
    resume = res.scalar_one_or_none()
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found.")

    # Remove file from disk
    storage_service.delete_resume(resume.storage_path)

    await db.delete(resume)
    await db.commit()

    return {"message": "Resume and associated data successfully deleted."}


@router.get("/{resume_id}/parsed")
async def get_parsed_resume(
    resume_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns structured parsed MasterProfile data for the resume,
    field verification metadata, and parsing audit summary.
    """
    stmt = select(Resume).where(
        Resume.id == resume_id,
        Resume.user_id == current_user.id
    )
    res = await db.execute(stmt)
    resume = res.scalar_one_or_none()
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found.")

    if resume.status == ResumeStatus.FAILED.value:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=resume.error_message or "Resume parsing failed."
        )

    # Fetch MasterProfile created from or associated with this resume
    mp_stmt = select(MasterProfile).where(
        MasterProfile.user_id == current_user.id,
        (MasterProfile.created_from_resume_id == resume.id) | (MasterProfile.is_primary == True)
    ).order_by(MasterProfile.updated_at.desc())
    mp_res = await db.execute(mp_stmt)
    profile = mp_res.scalars().first()

    field_metas = []
    if profile:
        meta_stmt = select(ProfileFieldMeta).where(ProfileFieldMeta.profile_id == profile.id)
        meta_res = await db.execute(meta_stmt)
        for m in meta_res.scalars().all():
            field_metas.append({
                "field_path": m.field_path,
                "status": m.status,
                "confidence": m.confidence,
                "source_span": m.source_span
            })

    raw_contact = dict(profile.contact_info if profile else {})
    cleaned_contact = {}
    for k, v in raw_contact.items():
        if isinstance(v, str) and v.strip().lower() in ["null", "none", "n/a", "undefined"]:
            cleaned_contact[k] = ""
        else:
            cleaned_contact[k] = v

    profile_data = {
        "contact_info": cleaned_contact,
        "summary": profile.summary if profile else "",
        "skills": profile.skills if profile else {"languages": [], "frameworks": [], "databases": [], "tools": [], "cloud_devops": [], "soft_skills": []},
        "experience": profile.experience if profile else [],
        "projects": profile.projects if profile else [],
        "education": profile.education if profile else [],
        "certifications": profile.certifications if profile else [],
        "achievements": getattr(profile, "achievements", []) if profile else [],
        "links": profile.links if profile else [],
    }

    verified_count = sum(1 for f in field_metas if f["status"] == "verified")
    unverified_count = sum(1 for f in field_metas if f["status"] == "unverified")
    missing_count = sum(1 for f in field_metas if f["status"] == "missing")

    return {
        "resume_id": str(resume.id),
        "status": resume.status,
        "filename": resume.filename,
        "ocr_used": resume.ocr_used,
        "raw_text_length": len(resume.raw_text or ""),
        "profile": profile_data,
        "field_meta": field_metas,
        "summary_counts": {
            "skills": sum(len(skills_list) for skills_list in profile_data["skills"].values() if isinstance(skills_list, list)),
            "projects": len(profile_data["projects"]),
            "experience": len(profile_data["experience"]),
            "education": len(profile_data["education"]),
            "verified": verified_count,
            "unverified": unverified_count,
            "missing": missing_count,
            "needs_attention": unverified_count,
        }
    }


@router.post("/{resume_id}/retry")
async def retry_resume_parsing(
    resume_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retries parsing for a failed or stuck resume job"""
    stmt = select(Resume).where(
        Resume.id == resume_id,
        Resume.user_id == current_user.id
    )
    res = await db.execute(stmt)
    resume = res.scalar_one_or_none()
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found.")

    resume.status = ResumeStatus.QUEUED.value
    resume.error_message = None
    await db.commit()

    dispatch_resume_parsing(str(resume.id))

    return {"message": "Parsing retried", "status": ResumeStatus.QUEUED.value}
