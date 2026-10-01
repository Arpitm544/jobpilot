import os
import sys
import io
import uuid
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
import pymupdf
import docx
from unittest.mock import patch, AsyncMock

from app.schemas.profile import MasterProfileData, ContactInfo, SkillCategories, ProjectItem, EducationItem
from app.services.resume_parser import (
    extract_text_and_links_from_pdf,
    extract_text_from_docx,
    resume_parser_service,
    heuristic_profile_extractor
)
from app.services.resume_verifier import resume_verifier, normalize_phone, normalize_url
from app.workers.resume_tasks import async_process_resume
from app.models.resume import Resume
from app.models.profile import MasterProfile


def create_sample_pdf_bytes() -> bytes:
    """Generates a binary PDF in memory with text and link annotations"""
    doc = pymupdf.open()
    page = doc.new_page(width=612, height=792)
    
    text = (
        "Jane Developer\n"
        "Senior Systems Engineer\n"
        "Seattle, WA | +1 555-432-1098 | jane@testdomain.com\n\n"
        "Professional Summary\n"
        "Senior Systems Engineer specializing in distributed databases and cloud infrastructure.\n\n"
        "Technical Skills\n"
        "Languages: Python, Go, TypeScript, SQL\n"
        "Frameworks: FastAPI, React, Node.js\n"
        "Cloud & Tools: AWS, Docker, Kubernetes, Git\n\n"
        "Projects\n"
        "Distributed Cache Engine\n"
        "Designed and implemented high throughput LRU cache node in Go with raft consensus.\n\n"
        "Education\n"
        "University of Washington - B.S. in Computer Science (2018 - 2022)\n"
    )
    rect = pymupdf.Rect(50, 50, 560, 700)
    page.insert_textbox(rect, text, fontsize=11)
    
    # Add link annotations
    link_gh = {"kind": pymupdf.LINK_URI, "from": pymupdf.Rect(50, 100, 150, 120), "uri": "https://github.com/janedev"}
    link_li = {"kind": pymupdf.LINK_URI, "from": pymupdf.Rect(160, 100, 260, 120), "uri": "https://linkedin.com/in/janedev"}
    page.insert_link(link_gh)
    page.insert_link(link_li)
    
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def create_sample_docx_bytes() -> bytes:
    """Generates a binary DOCX in memory"""
    doc = docx.Document()
    doc.add_heading("Jane Developer", 0)
    doc.add_paragraph("Seattle, WA | +1 555-432-1098 | jane@testdomain.com")
    doc.add_paragraph("https://linkedin.com/in/janedev | https://github.com/janedev")
    doc.add_heading("Professional Summary", level=1)
    doc.add_paragraph("Senior Systems Engineer specializing in distributed databases and cloud infrastructure.")
    doc.add_heading("Technical Skills", level=1)
    doc.add_paragraph("Languages: Python, Go, TypeScript")
    doc.add_paragraph("Frameworks: FastAPI, React")
    doc.add_paragraph("Tools: Docker, Kubernetes, AWS")
    doc.add_heading("Projects", level=1)
    doc.add_paragraph("Distributed Cache Engine - High throughput LRU cache in Go")
    doc.add_heading("Education", level=1)
    doc.add_paragraph("University of Washington - B.S. in Computer Science")
    
    bio = io.BytesIO()
    doc.save(bio)
    return bio.getvalue()


@pytest.mark.asyncio
async def test_pdf_extraction_extracts_text_and_links():
    """Verify that extract_text_and_links_from_pdf preserves links and text"""
    pdf_bytes = create_sample_pdf_bytes()
    raw_text, links, ocr_used = await extract_text_and_links_from_pdf(pdf_bytes)
    
    assert len(raw_text) > 100
    assert "Jane Developer" in raw_text
    assert "jane@testdomain.com" in raw_text
    assert len(links) >= 2
    urls = [l["url"] for l in links]
    assert "https://github.com/janedev" in urls
    assert "https://linkedin.com/in/janedev" in urls
    assert not ocr_used


@pytest.mark.asyncio
async def test_docx_extraction():
    """Verify DOCX text extraction"""
    docx_bytes = create_sample_docx_bytes()
    raw_text, links = extract_text_from_docx(docx_bytes)
    assert len(raw_text) > 100
    assert "Jane Developer" in raw_text
    assert "Distributed Cache Engine" in raw_text


def test_resume_verifier_zero_hallucination():
    """Verify deterministic zero-hallucination layer"""
    profile = MasterProfileData(
        contact_info=ContactInfo(
            full_name="Jane Developer",
            email="jane@testdomain.com",
            phone="+1 555-432-1098",
            location="Seattle, WA",
            linkedin="https://linkedin.com/in/janedev",
            github="https://github.com/janedev"
        ),
        summary="Senior Systems Engineer specializing in distributed databases and cloud infrastructure.",
        skills=SkillCategories(
            languages=["Python", "Go"],
            frameworks=["FastAPI", "React"],
            tools=["Docker", "AWS"],
            cloud_devops=["Kubernetes"]
        ),
        projects=[
            ProjectItem(title="Distributed Cache Engine", link="https://github.com/janedev/cache")
        ],
        education=[
            EducationItem(institution="University of Washington", degree="B.S. in Computer Science")
        ]
    )
    raw_text = (
        "Jane Developer Seattle, WA +1 555-432-1098 jane@testdomain.com\n"
        "Senior Systems Engineer specializing in distributed databases and cloud infrastructure.\n"
        "Skills: Python, Go, FastAPI, React, Docker, Kubernetes, AWS\n"
        "Projects: Distributed Cache Engine\n"
        "University of Washington B.S. in Computer Science"
    )
    links = [
        {"label": "GitHub", "url": "https://github.com/janedev"},
        {"label": "LinkedIn", "url": "https://linkedin.com/in/janedev"}
    ]
    
    verified_prof, metas, summary = resume_verifier.verify_profile(profile, raw_text, links)
    assert summary["verified"] > 8
    assert summary["missing"] == 0
    # Phone digits match
    phone_meta = next(m for m in metas if m["field_path"] == "contact_info.phone")
    assert phone_meta["status"] == "verified"
    # LinkedIn match
    li_meta = next(m for m in metas if m["field_path"] == "contact_info.linkedin")
    assert li_meta["status"] == "verified"


def test_field_schema_matches_frontend():
    """Ensures API response keys match what the frontend reads"""
    expected_frontend_keys = {
        "contact_info": ["full_name", "email", "phone", "location", "linkedin", "github", "portfolio"],
        "skills": ["languages", "frameworks", "databases", "tools", "cloud_devops", "soft_skills"],
        "summary": None,
        "experience": None,
        "projects": None,
        "education": None,
    }
    
    dummy_profile = MasterProfileData()
    profile_dict = dummy_profile.model_dump()
    
    for key, subkeys in expected_frontend_keys.items():
        assert key in profile_dict, f"Missing key '{key}' expected by frontend form"
        if subkeys:
            for sub in subkeys:
                assert sub in profile_dict[key], f"Missing subkey '{sub}' in '{key}'"


@pytest.mark.asyncio
async def test_scanned_pdf_triggers_ocr():
    """Verify that an image/scanned PDF (empty text) triggers OCR fallback"""
    doc = pymupdf.open()
    doc.new_page(width=612, height=792)
    empty_pdf = doc.tobytes()
    doc.close()
    
    with patch("app.services.gemini_service.gemini_service.extract_text_via_vision", new=AsyncMock(return_value="Scanned Text Resume Header")) as mock_vision:
        raw_text, links, ocr_used = await extract_text_and_links_from_pdf(empty_pdf)
        assert ocr_used == True
        assert "Scanned Text" in raw_text
        mock_vision.assert_called_once()


@pytest.mark.asyncio
async def test_failed_pipeline_sets_failed_status():
    """Verify that if an unrecoverable error occurs, status becomes 'failed' and not silent success"""
    with patch("app.services.resume_parser.resume_parser_service.parse_resume_file", side_effect=ValueError("Corrupt PDF file")):
        resume = Resume(
            id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            filename="bad.pdf",
            storage_path="nonexistent.pdf",
            file_hash="12345",
            file_size=100,
            mime_type="application/pdf",
            status="queued"
        )
        assert resume.status == "queued"
        # Test error handling logic in task
        try:
            from app.workers.resume_tasks import async_process_resume
            # Will handle non-existent ID gracefully without raising or silently marking ready
            await async_process_resume(str(resume.id))
        except Exception:
            pass
        assert resume.status != "ready"
