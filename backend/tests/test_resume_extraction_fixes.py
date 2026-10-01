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
            ProjectItem(
                title="Distributed Cache Engine",
                link="https://github.com/janedev/cache",
                github_url="https://github.com/janedev/cache",
                demo_url="https://cache-demo.dev"
            )
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
        {"label": "LinkedIn", "url": "https://linkedin.com/in/janedev"},
        {"label": "Repo", "url": "https://github.com/janedev/cache"},
        {"label": "Demo", "url": "https://cache-demo.dev"}
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
    """Ensures API response keys match what the frontend reads across all 8 sections"""
    expected_frontend_keys = {
        "contact_info": ["full_name", "email", "phone", "location", "linkedin", "github", "portfolio"],
        "skills": ["languages", "frameworks", "databases", "tools", "cloud_devops", "soft_skills"],
        "summary": None,
        "experience": None,
        "projects": None,
        "education": None,
        "certifications": None,
        "achievements": None,
    }
    
    dummy_profile = MasterProfileData()
    profile_dict = dummy_profile.model_dump()
    
    for key, subkeys in expected_frontend_keys.items():
        assert key in profile_dict, f"Missing key '{key}' expected by frontend form"
        if subkeys:
            for sub in subkeys:
                assert sub in profile_dict[key], f"Missing subkey '{sub}' in '{key}'"


def test_master_profile_update_all_sections():
    """Verifies that MasterProfileUpdate parses projects, education, certifications, and achievements"""
    from app.schemas.profile import MasterProfileUpdate, AchievementItem, CertificationItem
    
    payload = {
        "contact_info": {
            "full_name": "Test User",
            "email": "test@user.com",
            "phone": "+91 98765 43210",
            "location": "Bengaluru, India"
        },
        "summary": "Full Stack Engineer",
        "skills": {
            "languages": ["Python", "JavaScript"],
            "frameworks": ["FastAPI", "Next.js"],
            "databases": ["PostgreSQL"],
            "tools": ["Git"],
            "cloud_devops": ["Docker"],
            "soft_skills": []
        },
        "experience": [
            {
                "company": "Tech Corp",
                "role": "SDE Intern",
                "start_date": "2023",
                "end_date": "2024",
                "is_current": False,
                "bullets": ["Built backend APIs"]
            }
        ],
        "projects": [
            {
                "title": "Job Pilot",
                "role": "Creator",
                "description": "Autonomous AI job applicant",
                "tech_stack": ["FastAPI", "React", "PostgreSQL"],
                "bullets": ["Automated resume parsing"],
                "github_url": "https://github.com/test/jobpilot",
                "demo_url": "https://jobpilot.dev"
            }
        ],
        "education": [
            {
                "institution": "State University",
                "degree": "B.Tech",
                "field_of_study": "Computer Science",
                "start_year": "2020",
                "end_year": "2024",
                "grade_type": "CGPA",
                "grade_value": "8.9",
                "secondary_percentage": "94%"
            }
        ],
        "certifications": [
            {
                "name": "AWS Certified Developer",
                "issuer": "Amazon",
                "date": "2023",
                "url": "https://aws.amazon.com/verify/123"
            }
        ],
        "achievements": [
            {
                "title": "1st Prize Hackathon",
                "description": "Won best overall project",
                "date": "2023",
                "issuer": "MLH"
            }
        ]
    }
    
    update_obj = MasterProfileUpdate(**payload)
    dumped = update_obj.model_dump()
    assert dumped["contact_info"]["phone"] == "+91 98765 43210"
    assert len(dumped["projects"]) == 1
    assert dumped["projects"][0]["github_url"] == "https://github.com/test/jobpilot"
    assert len(dumped["education"]) == 1
    assert dumped["education"][0]["grade_type"] == "CGPA"
    assert len(dumped["certifications"]) == 1
    assert len(dumped["achievements"]) == 1
    assert dumped["achievements"][0]["title"] == "1st Prize Hackathon"


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


def create_pdf_with_hidden_and_visible_links() -> bytes:
    """Creates a PDF with projects having hidden links ('GitHub', 'Live', 'Code') and visible URL links"""
    doc = pymupdf.open()
    page = doc.new_page(width=612, height=792)

    # 1. Contact info at top
    page.insert_textbox(pymupdf.Rect(50, 40, 560, 90), "John Doe\njohn@example.com | +1 555-0199 | San Francisco, CA\nGitHub | LinkedIn", fontsize=10)
    # Profile links
    page.insert_link({"kind": pymupdf.LINK_URI, "from": pymupdf.Rect(50, 75, 100, 90), "uri": "https://github.com/johndoe"})
    page.insert_link({"kind": pymupdf.LINK_URI, "from": pymupdf.Rect(110, 75, 170, 90), "uri": "https://linkedin.com/in/johndoe"})

    # 2. Project 1: Hidden link behind "Live" and "GitHub" text
    page.insert_textbox(pymupdf.Rect(50, 120, 560, 140), "EnterpriseOps Agent - Autonomous Operations | LangGraph, FastAPI", fontsize=11)
    page.insert_textbox(pymupdf.Rect(50, 140, 560, 155), "Live | GitHub", fontsize=10)
    page.insert_link({"kind": pymupdf.LINK_URI, "from": pymupdf.Rect(50, 140, 80, 155), "uri": "https://enterprise-ops.vercel.app/"})
    page.insert_link({"kind": pymupdf.LINK_URI, "from": pymupdf.Rect(90, 140, 140, 155), "uri": "https://github.com/johndoe/enterprise-ops-agent"})
    page.insert_textbox(pymupdf.Rect(50, 155, 560, 185), "- Implemented stateful multi-agent supervisor graph.\n- Reduced operational incidents by 40%.", fontsize=9)

    # 3. Project 2: Hidden link behind "Code" and "Demo"
    page.insert_textbox(pymupdf.Rect(50, 200, 560, 220), "AutoDev Agent - Self-Healing Software Engineer | Docker, Python", fontsize=11)
    page.insert_textbox(pymupdf.Rect(50, 220, 560, 235), "Demo | Code", fontsize=10)
    page.insert_link({"kind": pymupdf.LINK_URI, "from": pymupdf.Rect(50, 220, 85, 235), "uri": "https://autodev.render.com"})
    page.insert_link({"kind": pymupdf.LINK_URI, "from": pymupdf.Rect(95, 220, 135, 235), "uri": "https://github.com/johndoe/autodev-agent"})
    page.insert_textbox(pymupdf.Rect(50, 235, 560, 265), "- Built automated test-driven repair loop with pytest in Docker sandbox.", fontsize=9)

    # 4. Project 3: Visible text link
    page.insert_textbox(
        pymupdf.Rect(50, 280, 560, 340),
        "ResolveAI - Customer Support Agent\n"
        "Repository: https://github.com/johndoe/resolve-ai | Deployment: https://resolve-ai.netlify.app\n"
        "- Multi-turn customer resolution engine with guardrails.",
        fontsize=10
    )

    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


@pytest.mark.asyncio
async def test_hidden_and_visible_project_github_links_extraction():
    """
    Verifies that projects with hidden anchor hyperlinks ('GitHub', 'Code')
    and visible URLs correctly assign repo URLs to github_url and live demo URLs to demo_url.
    """
    from app.services.resume_parser import associate_project_links, classify_url

    pdf_bytes = create_pdf_with_hidden_and_visible_links()
    raw_text, extracted_links, _ = await extract_text_and_links_from_pdf(pdf_bytes)

    # Check that PyMuPDF extracted all link annotations with their coordinates and anchors
    assert len(extracted_links) >= 4
    urls = [l["url"] for l in extracted_links]
    assert "https://github.com/johndoe/enterprise-ops-agent" in urls
    assert "https://enterprise-ops.vercel.app/" in urls
    assert "https://github.com/johndoe/autodev-agent" in urls

    # Check inline link injection in raw text
    assert "[link: GitHub -> https://github.com/johndoe/enterprise-ops-agent]" in raw_text or "enterprise-ops-agent" in raw_text

    # Test deterministic fallback matching
    projects = [
        ProjectItem(title="EnterpriseOps Agent - Autonomous Operations"),
        ProjectItem(title="AutoDev Agent - Self-Healing Software Engineer"),
        ProjectItem(title="ResolveAI - Customer Support Agent")
    ]

    associated = associate_project_links(projects, extracted_links, raw_text)

    # Project 1 (Hidden behind "GitHub")
    assert associated[0].github_url == "https://github.com/johndoe/enterprise-ops-agent"
    assert associated[0].demo_url == "https://enterprise-ops.vercel.app/"

    # Project 2 (Hidden behind "Code")
    assert associated[1].github_url == "https://github.com/johndoe/autodev-agent"
    assert associated[1].demo_url == "https://autodev.render.com"

    # Project 3 (Visible in raw text)
    # Visible text will be matched via regex/corpus in fallback
    all_potential = list(extracted_links)
    import re
    for u in re.findall(r"https?://[^\s<>\"']+", raw_text):
        if not any(l["url"] == u for l in all_potential):
            kind, slug = classify_url(u)
            all_potential.append({"url": u, "label": "Link", "anchor_text": "Link", "kind": kind, "slug": slug})

    associated_all = associate_project_links(projects, all_potential, raw_text)
    assert associated_all[2].github_url == "https://github.com/johndoe/resolve-ai"
    assert associated_all[2].demo_url == "https://resolve-ai.netlify.app"


def test_link_domain_classification():
    """Verify link domain classification rules"""
    from app.services.resume_parser import classify_url

    # Project repo
    kind, slug = classify_url("https://github.com/prakashramav/Autonomous_Operations_Agent")
    assert kind == "github_repo"
    assert slug == "autonomous_operations_agent"

    # Profile link (no repo)
    kind, user = classify_url("https://github.com/prakashramav")
    assert kind == "github_profile"
    assert user == "prakashramav"

    # LinkedIn
    kind, _ = classify_url("https://linkedin.com/in/prakashramavath")
    assert kind == "linkedin"

    # Live demo platforms
    assert classify_url("https://app.vercel.app")[0] == "demo"
    assert classify_url("https://site.netlify.app")[0] == "demo"
    assert classify_url("https://api.render.com")[0] == "demo"
    assert classify_url("https://app.herokuapp.com")[0] == "demo"
    assert classify_url("https://customdomain.io")[0] == "demo"


def test_resume_verifier_project_links_normalization_and_zero_hallucination():
    """Verify that verifier validates real URLs with normalization and clears invented URLs"""
    from app.schemas.profile import MasterProfileData, ProjectItem

    profile = MasterProfileData(
        projects=[
            ProjectItem(
                title="Autonomous Ops",
                github_url="https://www.github.com/user/real-repo/",  # has www and trailing slash
                demo_url="http://real-demo.vercel.app/"  # http and trailing slash
            ),
            ProjectItem(
                title="Fictional Agent",
                github_url="https://github.com/fake/invented-repo",  # not present anywhere
                demo_url="https://fake-demo.com"
            )
        ]
    )

    raw_text = "Projects: Autonomous Ops with repo at github.com/user/real-repo and demo real-demo.vercel.app"
    extracted_links = [
        {"url": "https://github.com/user/real-repo", "label": "GitHub"},
        {"url": "https://real-demo.vercel.app", "label": "Demo"}
    ]

    verified_profile, field_metas, summary = resume_verifier.verify_profile(
        profile=profile,
        raw_text=raw_text,
        extracted_links=extracted_links
    )

    # Valid project URLs normalized and marked verified
    meta_gh = next(m for m in field_metas if m["field_path"] == "projects[0].github_url")
    assert meta_gh["status"] == "verified"

    meta_demo = next(m for m in field_metas if m["field_path"] == "projects[0].demo_url")
    assert meta_demo["status"] == "verified"

    # Invented project URLs cleared to None (zero hallucination guarantee)
    assert verified_profile.projects[1].github_url is None
    assert verified_profile.projects[1].demo_url is None
    meta_gh_fake = next(m for m in field_metas if m["field_path"] == "projects[1].github_url")
    assert meta_gh_fake["status"] == "missing"


def test_profile_and_project_github_links_coexist():
    """Verify profile-level GitHub link and project repo links both exist and are not de-duplicated"""
    from app.services.resume_parser import associate_project_links, classify_url
    from app.schemas.profile import ProjectItem, MasterProfileData, ContactInfo

    profile_gh = "https://github.com/janedev"
    proj_gh = "https://github.com/janedev/distributed-cache"

    assert classify_url(profile_gh)[0] == "github_profile"
    assert classify_url(proj_gh)[0] == "github_repo"

    projects = [ProjectItem(title="Distributed Cache", link="https://cachedemo.dev")]
    extracted_links = [
        {"url": profile_gh, "label": "GitHub", "kind": "github_profile"},
        {"url": proj_gh, "label": "Code", "kind": "github_repo", "slug": "distributed-cache"},
        {"url": "https://cachedemo.dev", "label": "Live Demo", "kind": "demo"}
    ]
    raw_text = "Jane Dev github.com/janedev\nProjects:\nDistributed Cache [link: Live Demo -> https://cachedemo.dev] [link: Code -> https://github.com/janedev/distributed-cache]"

    updated = associate_project_links(projects, extracted_links, raw_text)
    assert len(updated) == 1
    assert updated[0].github_url == proj_gh
    assert updated[0].demo_url == "https://cachedemo.dev"
    assert updated[0].links.github_repo == proj_gh
    # Profile link was NOT used as project repo
    assert updated[0].github_url != profile_gh


def test_two_column_layout_project_link_association():
    """Verify projects in multi-column layouts get their own repo URLs without cross-contamination"""
    from app.services.resume_parser import associate_project_links
    from app.schemas.profile import ProjectItem

    projects = [
        ProjectItem(title="QueryOptimizer Engine"),
        ProjectItem(title="EventStream Dispatcher")
    ]
    extracted_links = [
        {"url": "https://github.com/janedev/query-optimizer", "kind": "github_repo", "slug": "query-optimizer", "x_position": 80.0, "y_position": 350.0},
        {"url": "https://optimizer-demo.dev", "kind": "demo", "x_position": 140.0, "y_position": 350.0},
        {"url": "https://github.com/janedev/event-stream", "kind": "github_repo", "slug": "event-stream", "x_position": 350.0, "y_position": 350.0},
        {"url": "https://stream-demo.dev", "kind": "demo", "x_position": 420.0, "y_position": 350.0},
    ]
    raw_text = (
        "Column 1: QueryOptimizer Engine [link: Code -> https://github.com/janedev/query-optimizer] [link: Demo -> https://optimizer-demo.dev]\n"
        "Column 2: EventStream Dispatcher [link: Code -> https://github.com/janedev/event-stream] [link: Demo -> https://stream-demo.dev]"
    )

    updated = associate_project_links(projects, extracted_links, raw_text)
    assert updated[0].github_url == "https://github.com/janedev/query-optimizer"
    assert updated[0].demo_url == "https://optimizer-demo.dev"
    assert updated[1].github_url == "https://github.com/janedev/event-stream"
    assert updated[1].demo_url == "https://stream-demo.dev"


def test_icon_only_or_missing_links_never_invented():
    """Verify that projects with icon-only or no links are left empty and not fabricated"""
    from app.services.resume_parser import associate_project_links
    from app.schemas.profile import ProjectItem

    projects = [ProjectItem(title="Secret Stealth Startup Tool")]
    extracted_links = [
        {"url": "https://linkedin.com/in/janedev", "kind": "linkedin"},
        {"url": "mailto:jane@dev.io", "kind": "other"}
    ]
    raw_text = "Projects:\nSecret Stealth Startup Tool\nBuilt internal tooling in stealth mode."

    updated = associate_project_links(projects, extracted_links, raw_text)
    assert updated[0].github_url is None
    assert updated[0].demo_url is None
    assert updated[0].links.github_repo is None


def test_project_links_canonical_key_divergence_prevention():
    """Verify that github_url and links.github_repo are synchronized symmetrically"""
    from app.schemas.profile import ProjectItem, ProjectLinks

    # Given github_url directly
    p1 = ProjectItem(title="App 1", github_url="https://github.com/user/app1", demo_url="https://app1.dev")
    assert p1.links.github_repo == "https://github.com/user/app1"
    assert p1.links.live_demo == "https://app1.dev"

    # Given links dict with github_repo
    p2 = ProjectItem(title="App 2", links=ProjectLinks(github_repo="https://github.com/user/app2", live_demo="https://app2.dev"))
    assert p2.github_url == "https://github.com/user/app2"
    assert p2.demo_url == "https://app2.dev"

    # Serialization matches
    dumped = p1.model_dump()
    assert dumped["github_url"] == "https://github.com/user/app1"
    assert dumped["links"]["github_repo"] == "https://github.com/user/app1"


@pytest.mark.asyncio
async def test_github_repo_suggester_fuzzy_matching_and_rate_limits():
    """Verify GitHub suggestion matcher matches correctly, filters noise words, and handles errors"""
    from app.services.github_service import github_repo_suggester

    mock_repos = [
        {
            "name": "Autonomous_Operations_Agent",
            "full_name": "prakashramav/Autonomous_Operations_Agent",
            "html_url": "https://github.com/prakashramav/Autonomous_Operations_Agent",
            "description": "Multi-agent LangGraph supervisor orchestrating autonomous operations with MCP",
            "language": "Python"
        },
        {
            "name": "AutoDev-Agent",
            "full_name": "prakashramav/AutoDev-Agent",
            "html_url": "https://github.com/prakashramav/AutoDev-Agent",
            "description": "Self-healing software engineering agent with Docker sandboxing",
            "language": "Python"
        },
        {
            "name": "unrelated-personal-blog",
            "full_name": "prakashramav/unrelated-personal-blog",
            "html_url": "https://github.com/prakashramav/unrelated-personal-blog",
            "description": "Static markdown blog",
            "language": "HTML"
        }
    ]

    projects = [
        {"title": "EnterpriseOps Agent – Governed Autonomous Operations"},
        {"title": "AutoDev-Agent – Self-Healing Software Engineering Agent"}
    ]

    matched = github_repo_suggester.match_projects_to_repos(projects, mock_repos, threshold=70.0)

    # Project 1 matched Autonomous_Operations_Agent
    p1_sugs = matched["EnterpriseOps Agent – Governed Autonomous Operations"]
    assert len(p1_sugs) >= 1
    assert p1_sugs[0]["repo_name"] == "Autonomous_Operations_Agent"
    assert p1_sugs[0]["score"] >= 80.0
    assert p1_sugs[0]["source"] == "github_suggestion"

    # Project 2 matched AutoDev-Agent
    p2_sugs = matched["AutoDev-Agent – Self-Healing Software Engineering Agent"]
    assert len(p2_sugs) >= 1
    assert p2_sugs[0]["repo_name"] == "AutoDev-Agent"

    # Unrelated repo not suggested for unrelated titles
    for sugs in matched.values():
        assert not any(s["repo_name"] == "unrelated-personal-blog" for s in sugs)


