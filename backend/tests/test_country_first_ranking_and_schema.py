import pytest
import uuid
from datetime import datetime, timezone
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import AsyncSessionLocal
from app.models.job import Job
from app.models.user import User
from app.services.auth_service import create_access_token
from app.services.ranking_service import ranking_service
from app.adapters.source_router import source_router


def test_ranking_service_tier_classification():
    """Verify ranking order: Home onsite/hybrid > Home remote > Eligible remote > International."""
    user = User(
        id=uuid.uuid4(),
        email="test_rank@example.com",
        home_country="IN",
        preferred_cities=["Bengaluru", "Pune"],
        open_to_international=False
    )

    # 1. Home country on-site in preferred city -> Tier 1
    job_blr = Job(
        id=uuid.uuid4(),
        company_name="Flipkart",
        title="Software Engineer",
        country="IN",
        city="Bengaluru",
        work_mode="onsite",
        remote_scope="unknown"
    )
    tier, included = ranking_service.classify_job_tier(job_blr, user)
    assert tier == 1
    assert included is True

    # 2. Home country remote -> Tier 2
    job_in_rem = Job(
        id=uuid.uuid4(),
        company_name="Swiggy",
        title="Backend Engineer",
        country="IN",
        city=None,
        work_mode="remote",
        remote_scope="country_specific",
        allowed_countries=["IN"]
    )
    tier, included = ranking_service.classify_job_tier(job_in_rem, user)
    assert tier == 2
    assert included is True

    # 3. Worldwide remote role -> Tier 3
    job_global = Job(
        id=uuid.uuid4(),
        company_name="GitLab",
        title="DevOps Engineer",
        country=None,
        city=None,
        work_mode="remote",
        remote_scope="worldwide",
        allowed_countries=[]
    )
    tier, included = ranking_service.classify_job_tier(job_global, user)
    assert tier == 3
    assert included is True

    # 4. US Onsite role when open_to_international is False -> Excluded
    job_sf = Job(
        id=uuid.uuid4(),
        company_name="Salesforce",
        title="Platform Engineer",
        country="US",
        city="San Francisco",
        work_mode="onsite",
        remote_scope="unknown"
    )
    tier, included = ranking_service.classify_job_tier(job_sf, user)
    assert tier == 5
    assert included is False

    # 5. When user turns on open_to_international -> Included in Tier 4
    user.open_to_international = True
    tier_intl, included_intl = ranking_service.classify_job_tier(job_sf, user)
    assert tier_intl == 4
    assert included_intl is True


def test_ranking_service_80_20_feed_mix():
    """Verify default feed mix of ~80% home country to 20% eligible remote."""
    user = User(
        id=uuid.uuid4(),
        email="test_mix@example.com",
        home_country="IN",
        open_to_international=False
    )

    # Create 8 home jobs and 4 remote jobs
    home_jobs = [
        Job(id=uuid.uuid4(), company_name=f"HomeComp{i}", title=f"Dev {i}", country="IN", work_mode="onsite")
        for i in range(8)
    ]
    remote_jobs = [
        Job(id=uuid.uuid4(), company_name=f"RemComp{i}", title=f"RemDev {i}", work_mode="remote", remote_scope="worldwide")
        for i in range(4)
    ]

    all_jobs = home_jobs + remote_jobs
    mixed = ranking_service.rank_and_mix_jobs(all_jobs, user=user)

    # First 5 items must contain 4 home jobs and 1 remote job (80/20)
    first_five = mixed[:5]
    first_five_home = [j for j in first_five if j.country == "IN"]
    first_five_rem = [j for j in first_five if j.work_mode == "remote"]
    assert len(first_five_home) == 4
    assert len(first_five_rem) == 1


@pytest.mark.asyncio
async def test_source_router_dispatch():
    """Verify source routing per country and terms_restricted flags."""
    # 1. Query available sources for India
    in_sources = source_router.get_sources_for_country("IN")
    source_ids = [s["id"] for s in in_sources]
    assert "internshala" in source_ids
    assert "naukri" in source_ids

    # Verify Naukri terms_restricted flag
    naukri_meta = next(s for s in in_sources if s["id"] == "naukri")
    assert naukri_meta["terms_restricted"] is True

    # 2. Fetch and normalize for India
    jobs = await source_router.fetch_and_normalize_for_country("IN", query="Software", limit=10)
    assert len(jobs) > 0

    # Ensure Internshala internships normalized properly
    internships = [j for j in jobs if j.get("ats_type") == "internshala"]
    assert len(internships) > 0
    first_intern = internships[0]
    assert first_intern["employment_type"] == "internship"
    assert first_intern["is_paid"] is True
    assert first_intern["stipend_min"] is not None
    assert first_intern["stipend_currency"] == "INR"


@pytest.mark.asyncio
async def test_jobs_api_endpoint_filters():
    """Verify GET /api/v1/jobs filter behavior."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Filter by country=IN
        res_in = await client.get("/api/v1/jobs?country=IN&limit=10")
        assert res_in.status_code == 200
        jobs_in = res_in.json()
        assert len(jobs_in) > 0
        for j in jobs_in:
            assert j["country"] == "IN"

        # Filter by work_mode=remote
        res_rem = await client.get("/api/v1/jobs?work_mode=remote&limit=10")
        assert res_rem.status_code == 200
        jobs_rem = res_rem.json()
        assert len(jobs_rem) > 0
        for j in jobs_rem:
            assert j["work_mode"] == "remote"

        # Filter by employment_type=internship
        res_intern = await client.get("/api/v1/jobs?employment_type=internship&limit=10")
        assert res_intern.status_code == 200
        jobs_intern = res_intern.json()
        for j in jobs_intern:
            assert j["employment_type"] == "internship"
