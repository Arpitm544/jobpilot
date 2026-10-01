import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import AsyncSessionLocal
from app.models.user import User
from app.models.preference import JobPreference
from app.services.auth_service import create_access_token


@pytest.mark.asyncio
async def test_fresh_user_onboarding_state_is_zero():
    """
    REGRESSION TEST:
    A newly registered user has default JobPreference records seeded, but has NOT uploaded
    a resume or completed master profile. get_onboarding_state MUST return:
    - has_resume == False
    - has_active_profile == False
    - last_completed_step == 0 (NOT step 3!)
    """
    user_id = uuid.uuid4()
    test_email = f"fresh_user_{user_id.hex[:8]}@example.com"

    async with AsyncSessionLocal() as db:
        user = User(
            id=user_id,
            email=test_email,
            hashed_password="test_dummy_hashed_pw",
            full_name="Fresh QA User",
            is_active=True,
            last_completed_step=0,
        )
        db.add(user)
        # Seed default preferences as auth.py does
        prefs = JobPreference(
            user_id=user_id,
            target_roles=["Software Engineer"],
            locations=["Remote"],
            workplace_type="Remote",
            min_salary=0,
            apply_mode="review_then_apply",
            daily_cap=20,
        )
        db.add(prefs)
        await db.commit()

    token = create_access_token(user_id=user_id, email=test_email)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        client.cookies.set("access_token", token)
        res = await client.get("/api/v1/onboarding/state")
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["has_resume"] is False
        assert data["has_active_profile"] is False
        assert data["last_completed_step"] == 0, f"Expected step 0 for fresh user, got {data['last_completed_step']}"

        # Test updating step
        put_res = await client.put("/api/v1/onboarding/step", json={"step": 2})
        assert put_res.status_code == 200, put_res.text
        assert put_res.json()["last_completed_step"] == 2

        # Verify state reflects persisted step
        res2 = await client.get("/api/v1/onboarding/state")
        assert res2.status_code == 200
        assert res2.json()["last_completed_step"] == 2
