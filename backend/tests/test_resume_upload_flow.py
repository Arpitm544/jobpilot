import os
import sys
import uuid
import pytest
import pytest_asyncio
import httpx
import asyncio

# Ensure backend root is in PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.database import init_db, engine


@pytest_asyncio.fixture(scope="session")
async def prepare_db():
    await engine.dispose()
    await init_db()
    yield
    await engine.dispose()


@pytest.mark.asyncio
async def test_resume_upload_and_status_flow(prepare_db):
    """
    Tests:
    1. Rejection of invalid magic signatures/spoofed files
    2. Rejection of files exceeding 5 MB
    3. Valid PDF upload and immediate response with resume_id & status='queued'
    4. Polling status endpoint until transition to ready
    5. Cache hit on re-uploading identical file
    """
    transport = httpx.ASGITransport(app=app)
    test_email = f"resume_tester_{uuid.uuid4().hex[:6]}@example.com"
    test_password = "Password123!Secure"

    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Register & Login
        reg_res = await client.post("/api/v1/auth/register", json={
            "email": test_email,
            "password": test_password,
            "full_name": "Resume Tester"
        })
        assert reg_res.status_code == 201

        login_res = await client.post("/api/v1/auth/login", json={
            "email": test_email,
            "password": test_password
        })
        assert login_res.status_code == 200
        token = login_res.cookies.get("access_token")
        headers = {"Authorization": f"Bearer {token}"} if token else {}

        # 2. Test Invalid File Signature (Spoofed PDF: text content pretending to be PDF)
        fake_pdf = b"This is plain text without any PDF magic header"
        res_spoofed = await client.post(
            "/api/v1/resumes/upload",
            files={"file": ("fake_resume.pdf", fake_pdf, "application/pdf")},
            headers=headers
        )
        assert res_spoofed.status_code == 400
        assert "Invalid file format or signature" in res_spoofed.text

        # 3. Test File Size Limit Exceeded (> 5 MB)
        oversized_pdf = b"%PDF-1.5\n" + (b"A" * (6 * 1024 * 1024))
        res_oversized = await client.post(
            "/api/v1/resumes/upload",
            files={"file": ("big_resume.pdf", oversized_pdf, "application/pdf")},
            headers=headers
        )
        assert res_oversized.status_code == 400
        assert "exceeds maximum allowed limit" in res_oversized.text

        # 4. Test Valid Minimal PDF Upload
        # Create a syntactically valid minimal PDF
        valid_pdf_content = (
            b"%PDF-1.4\n"
            b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
            b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
            b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n"
            b"4 0 obj\n<< /Length 53 >>\nstream\n"
            b"BT /F1 12 Tf 100 700 Td (Alex Mercer - Full Stack Engineer) Tj ET\n"
            b"endstream\nendobj\n"
            b"xref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000214 00000 n \n"
            b"trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n317\n%%EOF\n"
        )

        upload_res = await client.post(
            "/api/v1/resumes/upload",
            files={"file": ("alex_mercer.pdf", valid_pdf_content, "application/pdf")},
            headers=headers
        )
        assert upload_res.status_code == 200, upload_res.text
        upload_data = upload_res.json()
        assert "resume_id" in upload_data
        assert upload_data["status"] == "queued"
        assert upload_data["is_cached"] is False
        resume_id = upload_data["resume_id"]

        # 5. Poll Status endpoint
        status_data = None
        for _ in range(20):
            status_res = await client.get(f"/api/v1/resumes/{resume_id}/status", headers=headers)
            assert status_res.status_code == 200
            status_data = status_res.json()
            assert "step_message" in status_data
            assert "progress_percent" in status_data
            if status_data["status"] in ["ready", "failed"]:
                break
            await asyncio.sleep(0.3)

        assert status_data["status"] == "ready", f"Expected ready but got {status_data}"
        assert status_data["progress_percent"] == 100

        # 6. Test Cache Hit: re-uploading the exact same PDF
        reupload_res = await client.post(
            "/api/v1/resumes/upload",
            files={"file": ("alex_mercer.pdf", valid_pdf_content, "application/pdf")},
            headers=headers
        )
        assert reupload_res.status_code == 200
        reupload_data = reupload_res.json()
        assert reupload_data["is_cached"] is True
        assert reupload_data["resume_id"] == resume_id
        assert reupload_data["status"] == "ready"

        # 7. Test Download Endpoint
        dl_res = await client.get(f"/api/v1/resumes/{resume_id}/download", headers=headers)
        assert dl_res.status_code == 200
        assert dl_res.content == valid_pdf_content
