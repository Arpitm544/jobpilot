import pytest
import pytest_asyncio
import httpx
import uuid
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.database import init_db, engine

@pytest_asyncio.fixture(scope="session")
async def prepare_db():
    await init_db()
    yield

@pytest.mark.asyncio
async def test_cookie_auth_lifecycle(prepare_db):
    transport = httpx.ASGITransport(app=app)
    test_email = f"cookietest_{uuid.uuid4().hex[:6]}@example.com"
    test_password = "Password123!Secure"

    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Unauthenticated request to protected endpoint -> 401
        me_unauth = await client.get("/api/v1/auth/me")
        assert me_unauth.status_code == 401, f"Expected 401, got {me_unauth.status_code}"

        # 2. Register candidate -> Sets access_token cookie
        reg_res = await client.post("/api/v1/auth/register", json={
            "email": test_email,
            "password": test_password,
            "full_name": "Cookie Tester"
        })
        assert reg_res.status_code == 201, reg_res.text
        # Verify access_token cookie is present
        assert "access_token" in reg_res.cookies, "access_token cookie missing on register"
        # Verify token is NOT in JSON body
        reg_json = reg_res.json()
        assert reg_json.get("tokens") is None, "Token must NOT be in JSON body"

        # 3. Call protected endpoint with cookie (httpx client automatically sends cookies)
        me_res = await client.get("/api/v1/auth/me")
        assert me_res.status_code == 200, me_res.text
        assert me_res.json()["email"] == test_email

        # 4. Logout -> deletes cookie
        logout_res = await client.post("/api/v1/auth/logout")
        assert logout_res.status_code == 200
        
        # 5. Call protected endpoint after logout -> 401
        me_after_logout = await client.get("/api/v1/auth/me")
        assert me_after_logout.status_code == 401

        # 6. Login again -> sets cookie
        login_res = await client.post("/api/v1/auth/login", json={
            "email": test_email,
            "password": test_password
        })
        assert login_res.status_code == 200
        assert "access_token" in login_res.cookies, "access_token cookie missing on login"
        login_json = login_res.json()
        assert login_json.get("tokens") is None, "Token must NOT be in JSON body on login"

        # 7. Check /auth/me again -> 200
        me_again = await client.get("/api/v1/auth/me")
        assert me_again.status_code == 200
        assert me_again.json()["email"] == test_email
