import os
import uuid
import logging
import asyncio
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse, Response
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

from app.database import get_db
from app.models.user import User
from app.models.job import JobMatch
from app.models.profile import MasterProfile
from app.models.application import TailoredResume
from app.schemas.tailor import (
    TailorRequest,
    TailorUpdateRequest,
    TailoredResumeResponse,
    TailoredProfilePayload,
)
from app.api.deps import get_current_user
from app.services.tailoring_service import tailoring_service, compute_bullet_diff

router = APIRouter(prefix="/tailor", tags=["AI Resume Tailoring & PDF Engine"])


@router.post("/generate", response_model=TailoredResumeResponse)
async def generate_tailored_resume(
    body: TailorRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Core AI Resume Tailoring Pipeline:
    1. Fetches candidate Master Profile & target Job.
    2. Rewrites summary & bullets (Action + Tech + Impact) without fabrication.
    3. Runs second Gemini claim verification audit pass against master profile.
    4. Computes ATS keyword match %.
    5. Renders 1-page ATS-safe PDF.
    6. Advances match status to 'tailored'.
    """
    match_res = await db.execute(
        select(JobMatch)
        .options(selectinload(JobMatch.job))
        .where(JobMatch.id == body.job_match_id, JobMatch.user_id == current_user.id)
    )
    job_match = match_res.scalar_one_or_none()
    if not job_match:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job match not found")

    try:
        tailored_resume = await tailoring_service.generate_tailored_resume(
            db=db,
            user_id=current_user.id,
            job_match=job_match,
            custom_instructions=body.custom_instructions
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Tailoring failed: {str(e)}"
        )

    # Compute diff for response
    prof_res = await db.execute(
        select(MasterProfile).where(MasterProfile.id == tailored_resume.master_profile_id)
    )
    master_profile = prof_res.scalar_one_or_none()
    payload = TailoredProfilePayload(**tailored_resume.tailored_profile_json)
    diff_summary = compute_bullet_diff(master_profile, payload) if master_profile else []

    return TailoredResumeResponse(
        id=tailored_resume.id,
        job_match_id=tailored_resume.job_match_id,
        master_profile_id=tailored_resume.master_profile_id,
        tailored_summary=tailored_resume.tailored_summary,
        tailored_profile_json=tailored_resume.tailored_profile_json,
        cover_letter=tailored_resume.cover_letter,
        custom_question_answers=tailored_resume.custom_question_answers,
        pdf_storage_path=tailored_resume.pdf_storage_path,
        pdf_download_url=f"/api/v1/tailor/{tailored_resume.id}/pdf",
        claim_verification_passed=tailored_resume.claim_verification_passed,
        claim_verification_notes=tailored_resume.claim_verification_notes,
        ats_keyword_match_pct=tailored_resume.ats_keyword_match_pct,
        diff_summary=diff_summary,
        created_at=tailored_resume.created_at
    )


@router.get("/match/{job_match_id}", response_model=TailoredResumeResponse)
async def get_tailored_resume_by_match(
    job_match_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve tailored resume for a specific job match"""
    result = await db.execute(
        select(TailoredResume)
        .join(JobMatch, JobMatch.id == TailoredResume.job_match_id)
        .where(TailoredResume.job_match_id == job_match_id, JobMatch.user_id == current_user.id)
    )
    tailored = result.scalar_one_or_none()
    if not tailored:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No tailored resume generated yet for this match."
        )

    prof_res = await db.execute(select(MasterProfile).where(MasterProfile.id == tailored.master_profile_id))
    master_profile = prof_res.scalar_one_or_none()
    payload = TailoredProfilePayload(**tailored.tailored_profile_json)
    diff_summary = compute_bullet_diff(master_profile, payload) if master_profile else []

    return TailoredResumeResponse(
        id=tailored.id,
        job_match_id=tailored.job_match_id,
        master_profile_id=tailored.master_profile_id,
        tailored_summary=tailored.tailored_summary,
        tailored_profile_json=tailored.tailored_profile_json,
        cover_letter=tailored.cover_letter,
        custom_question_answers=tailored.custom_question_answers,
        pdf_storage_path=tailored.pdf_storage_path,
        pdf_download_url=f"/api/v1/tailor/{tailored.id}/pdf",
        claim_verification_passed=tailored.claim_verification_passed,
        claim_verification_notes=tailored.claim_verification_notes,
        ats_keyword_match_pct=tailored.ats_keyword_match_pct,
        diff_summary=diff_summary,
        created_at=tailored.created_at
    )


@router.get("/{tailored_id}/pdf")
async def download_tailored_pdf(
    tailored_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Download or view the rendered 1-page ATS PDF"""
    result = await db.execute(
        select(TailoredResume)
        .join(JobMatch, JobMatch.id == TailoredResume.job_match_id)
        .where(TailoredResume.id == tailored_id, JobMatch.user_id == current_user.id)
    )
    tailored = result.scalar_one_or_none()
    if not tailored or not tailored.pdf_storage_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PDF not found.")

    pdf_path = tailored.pdf_storage_path
    html_path = pdf_path.replace(".pdf", ".html") if pdf_path.endswith(".pdf") else f"{pdf_path}.html"

    # Self-healing: if PDF is missing or is an old dummy placeholder (<1KB), and HTML exists, re-render it cleanly
    if os.path.exists(html_path) and (not os.path.exists(pdf_path) or os.path.getsize(pdf_path) < 1000):
        try:
            with open(html_path, "r", encoding="utf-8") as f:
                html_content = f.read()

            def _render_sync(html: str, target: str):
                from playwright.sync_api import sync_playwright
                with sync_playwright() as p:
                    b = p.chromium.launch(headless=True)
                    pg = b.new_page()
                    pg.set_content(html, wait_until="domcontentloaded", timeout=10000)
                    pg.pdf(
                        path=target,
                        format="Letter",
                        print_background=True,
                        margin={"top": "0.4in", "bottom": "0.4in", "left": "0.5in", "right": "0.5in"}
                    )
                    b.close()

            await asyncio.wait_for(asyncio.to_thread(_render_sync, html_content, pdf_path), timeout=20.0)
            logger.info(f"Self-healed and re-rendered PDF: {pdf_path}")
        except Exception as e:
            logger.warning(f"Could not re-render PDF from HTML: {e}")

    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PDF not found.")

    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=f"tailored_resume_{tailored_id}.pdf"
    )


@router.put("/{tailored_id}", response_model=TailoredResumeResponse)
async def update_tailored_resume(
    tailored_id: uuid.UUID,
    body: TailorUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """User manual fine-tuning of summary, cover letter, or answers before auto-applying"""
    result = await db.execute(
        select(TailoredResume)
        .join(JobMatch, JobMatch.id == TailoredResume.job_match_id)
        .where(TailoredResume.id == tailored_id, JobMatch.user_id == current_user.id)
    )
    tailored = result.scalar_one_or_none()
    if not tailored:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tailored resume not found")

    if body.tailored_summary is not None:
        tailored.tailored_summary = body.tailored_summary
        t_json = dict(tailored.tailored_profile_json)
        t_json["tailored_summary"] = body.tailored_summary
        tailored.tailored_profile_json = t_json

    if body.cover_letter is not None:
        tailored.cover_letter = body.cover_letter

    if body.custom_question_answers is not None:
        tailored.custom_question_answers = body.custom_question_answers

    await db.commit()
    await db.refresh(tailored)

    prof_res = await db.execute(select(MasterProfile).where(MasterProfile.id == tailored.master_profile_id))
    master_profile = prof_res.scalar_one_or_none()
    payload = TailoredProfilePayload(**tailored.tailored_profile_json)
    diff_summary = compute_bullet_diff(master_profile, payload) if master_profile else []

    return TailoredResumeResponse(
        id=tailored.id,
        job_match_id=tailored.job_match_id,
        master_profile_id=tailored.master_profile_id,
        tailored_summary=tailored.tailored_summary,
        tailored_profile_json=tailored.tailored_profile_json,
        cover_letter=tailored.cover_letter,
        custom_question_answers=tailored.custom_question_answers,
        pdf_storage_path=tailored.pdf_storage_path,
        pdf_download_url=f"/api/v1/tailor/{tailored.id}/pdf",
        claim_verification_passed=tailored.claim_verification_passed,
        claim_verification_notes=tailored.claim_verification_notes,
        ats_keyword_match_pct=tailored.ats_keyword_match_pct,
        diff_summary=diff_summary,
        created_at=tailored.created_at
    )
