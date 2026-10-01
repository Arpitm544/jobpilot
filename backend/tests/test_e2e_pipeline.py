import os
import sys
import uuid
import pytest
import pytest_asyncio
import httpx

# Ensure backend root is in PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.config import settings
from app.database import get_db, init_db, engine
from sqlalchemy import text


@pytest_asyncio.fixture(scope="session")
async def prepare_db():
    await engine.dispose()
    await init_db()
    yield
    await engine.dispose()


@pytest.mark.asyncio
async def test_health_check(prepare_db):
    """Verifies backend health check endpoint"""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "healthy"


@pytest.mark.asyncio
async def test_auth_and_profile_flow(prepare_db):
    """Verifies user registration, login, and master profile persistence"""
    transport = httpx.ASGITransport(app=app)
    test_email = f"candidate_{uuid.uuid4().hex[:6]}@example.com"
    test_password = "Password123!Secure"

    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Register
        print("\n---> [1/9] Testing User Registration...", flush=True)
        reg_res = await client.post("/api/v1/auth/register", json={
            "email": test_email,
            "password": test_password,
            "full_name": "Test Candidate"
        })
        assert reg_res.status_code == 201, reg_res.text
        user_data = reg_res.json()
        assert "user" in user_data and "id" in user_data["user"]
        print("  Status: User Registered Successfully", flush=True)

        # 2. Login
        print("---> [2/9] Testing User Login & JWT Tokens...", flush=True)
        login_res = await client.post("/api/v1/auth/login", json={
            "email": test_email,
            "password": test_password
        })
        assert login_res.status_code == 200
        auth_data = login_res.json()
        access_token = login_res.cookies.get("access_token") or (auth_data.get("tokens") or {}).get("access_token")
        assert access_token, "No access_token found in cookie or body"
        headers = {"Authorization": f"Bearer {access_token}"}
        print("  Status: Cookie-based JWT Issued & Verified", flush=True)

        # 3. Create / Update Master Profile
        profile_payload = {
            "contact_info": {
                "full_name": "Test Candidate",
                "email": test_email,
                "phone": "+1 (555) 123-4567",
                "linkedin": "https://linkedin.com/in/testcandidate",
                "github": "https://github.com/testcandidate"
            },
            "summary": "Experienced Full-Stack Python & React Engineer with high-throughput distributed systems background.",
            "skills": {
                "languages": ["Python", "JavaScript", "SQL"],
                "frameworks": ["FastAPI", "Next.js", "React"],
                "databases": ["PostgreSQL", "Redis"],
                "tools": ["Docker", "Git", "Celery"]
            },
            "experience": [
                {
                    "company": "Acme Systems",
                    "role": "Senior Software Engineer",
                    "start_date": "2022-01",
                    "end_date": "Present",
                    "bullets": [
                        "Architected event-driven microservices processing 50M requests daily with 99.99% uptime.",
                        "Optimized PostgreSQL queries reducing P99 query latency by 45% using composite indexes."
                    ]
                }
            ],
            "projects": [],
            "education": [
                {
                    "institution": "University of Technology",
                    "degree": "B.S. Computer Science",
                    "graduation_year": "2021"
                }
            ]
        }

        print("---> [3/9] Testing Master Profile Persistence (PUT /profile/master)...", flush=True)
        save_res = await client.put("/api/v1/profile/master", json=profile_payload, headers=headers)
        assert save_res.status_code == 200, save_res.text
        prof_data = save_res.json()
        assert prof_data["contact_info"]["full_name"] == "Test Candidate"
        print("  Status: Master Profile Saved & Verified", flush=True)

        # 4. Ingest and Score a Manual Job Listing
        print("---> [4/9] Testing Manual Job Ingestion & Gemini Match Scoring...", flush=True)
        job_payload = {
            "company_name": "Stripe",
            "title": "Senior Python Infrastructure Engineer",
            "location": "Remote",
            "workplace_type": "Remote",
            "job_type": "Full-time",
            "jd_text": "We are seeking a Senior Python Engineer experienced in FastAPI, PostgreSQL, Celery, and distributed systems to build high-scale financial infrastructure.",
            "apply_url": "https://boards.greenhouse.io/stripe/jobs/123456"
        }

        job_res = await client.post("/api/v1/jobs/manual", json=job_payload, headers=headers)
        assert job_res.status_code == 200, job_res.text
        match_data = job_res.json()
        assert "match_score" in match_data or "overall_score" in match_data
        job_match_id = match_data["id"]
        print(f"  Status: Job Ingested & Scored ({match_data.get('match_score', 80)}% match)", flush=True)

        # 5. Tailor Resume for this Job Match
        print("---> [5/9] Testing Gemini Resume Tailoring & ATS PDF Generation...", flush=True)
        tailor_res = await client.post("/api/v1/tailor/generate", json={
            "job_match_id": str(job_match_id)
        }, headers=headers)
        assert tailor_res.status_code == 200, tailor_res.text
        tailored_data = tailor_res.json()
        assert "ats_keyword_match_pct" in tailored_data
        assert "claim_verification_passed" in tailored_data
        print(f"  Status: ATS PDF Tailored (Score: {tailored_data.get('ats_keyword_match_pct', 90)}%)", flush=True)

        # 6. Stage Application & Execute Dry-Run
        print("---> [6/9] Testing Application Staging...", flush=True)
        stage_res = await client.post(f"/api/v1/apply/stage/{job_match_id}", headers=headers)
        assert stage_res.status_code == 200, stage_res.text
        app_data = stage_res.json()
        app_id = app_data["id"]
        assert app_data["status"] in ["queued", "tailored"]
        print("  Status: Application Staged for Review", flush=True)

        # 7. Check Analytics Overview
        print("---> [7/9] Testing Analytics & Funnel Aggregation...", flush=True)
        analytics_res = await client.get("/api/v1/analytics/overview", headers=headers)
        assert analytics_res.status_code == 200, analytics_res.text
        analytics_data = analytics_res.json()
        assert "funnel" in analytics_data
        assert "avg_ats_score" in analytics_data
        assert "velocity" in analytics_data
        print(f"  Status: Funnel Aggregated ({analytics_data['total_applications']} apps in funnel)", flush=True)

        # 8. Recruiter Email Synchronization
        print("---> [8/9] Testing Recruiter Email Sync & Intent Classification...", flush=True)
        email_res = await client.post("/api/v1/analytics/email-sync", json={
            "sender": "recruiting@stripe.com",
            "subject": "Invitation to Interview: Senior Python Infrastructure Engineer at Stripe",
            "body": "Hi Test Candidate, We were impressed by your resume and would like to schedule a technical screen with our hiring manager!"
        }, headers=headers)
        assert email_res.status_code == 200, email_res.text
        sync_result = email_res.json()
        assert sync_result["classification"]["category"] == "INTERVIEW_INVITE"
        print(f"  Status: Email Classified as {sync_result['classification']['category']}", flush=True)

        # 9. AI Follow-Up Draft Generation
        print("---> [9/9] Testing Gemini Follow-Up Email Assistant...", flush=True)
        follow_up_res = await client.post(f"/api/v1/analytics/follow-up-draft/{app_id}", json={
            "follow_up_type": "7_day"
        }, headers=headers)
        assert follow_up_res.status_code == 200, follow_up_res.text
        draft_data = follow_up_res.json()
        assert "subject" in draft_data
        assert "body" in draft_data
        print(f"  Status: Follow-Up Draft Generated: '{draft_data['subject']}'", flush=True)
        print("\n=======================================================", flush=True)
        print("  ALL 9 END-TO-END PIPELINE STEPS PASSED SUCCESSFULLY!  ", flush=True)
        print("=======================================================", flush=True)
