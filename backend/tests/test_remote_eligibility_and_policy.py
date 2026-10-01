import uuid
import pytest
from app.database import AsyncSessionLocal
from app.models.job import Job, EligibilityResult, CompanyPolicy
from app.models.user import User
from app.services.remote_eligibility import remote_eligibility
from app.services.policy_fetcher import policy_fetcher


@pytest.fixture
async def db_session():
    async with AsyncSessionLocal() as session:
        yield session


def make_user(
    home_country: str = "IN",
    citizenship: str = "IN",
    work_auth: list = None,
    sponsorship: bool = False,
    relocate: bool = False
) -> User:
    return User(
        id=uuid.uuid4(),
        email=f"test_{home_country.lower()}@example.com",
        hashed_password="fake",
        home_country=home_country,
        citizenship=citizenship,
        work_authorization_countries=work_auth or [home_country],
        needs_visa_sponsorship=sponsorship,
        willing_to_relocate=relocate,
        timezone="Asia/Kolkata" if home_country == "IN" else "America/New_York"
    )


def make_job(
    title: str,
    work_mode: str = "remote",
    country: str = None,
    remote_scope: str = "unknown",
    allowed_countries: list = None,
    excluded_countries: list = None,
    jd_text: str = "",
    company_name: str = "Acme Corp"
) -> Job:
    return Job(
        id=uuid.uuid4(),
        title=title,
        company_name=company_name,
        location="Remote" if work_mode == "remote" else "Office",
        work_mode=work_mode,
        country=country,
        remote_scope=remote_scope,
        allowed_countries=allowed_countries or [],
        excluded_countries=excluded_countries or [],
        jd_text=jd_text,
        apply_url="https://example.com/apply",
        is_active=True
    )


class TestRemoteEligibilityEngine:

    @pytest.mark.asyncio
    async def test_india_user_vs_us_user_on_us_only_role(self, db_session):
        """
        Critical rule: The same job evaluated for a US user and an Indian user
        must yield different, correct verdicts.
        """
        job = make_job(
            title="Senior React Developer",
            work_mode="remote",
            jd_text="This position is remote. US only. Must reside within the United States."
        )
        user_in = make_user(home_country="IN", citizenship="IN")
        user_us = make_user(home_country="US", citizenship="US")

        eval_in = await remote_eligibility.evaluate_eligibility(job, user_in, db_session, use_cache=False)
        assert eval_in.verdict == "not_eligible"
        assert any("United States" in r or "US" in r for r in eval_in.reasons)
        assert any("us only" in e.quote.lower() for e in eval_in.evidence)

        eval_us = await remote_eligibility.evaluate_eligibility(job, user_us, db_session, use_cache=False)
        assert eval_us.verdict == "eligible"

    @pytest.mark.asyncio
    async def test_remote_worldwide_eligible(self, db_session):
        """Roles explicitly open worldwide are eligible for all users."""
        job = make_job(
            title="Backend Engineer",
            work_mode="remote",
            remote_scope="worldwide",
            jd_text="Work from anywhere in the world. We are an all-remote, global company."
        )
        user_in = make_user(home_country="IN")
        eval_res = await remote_eligibility.evaluate_eligibility(job, user_in, db_session, use_cache=False)
        assert eval_res.verdict == "eligible"
        assert eval_res.confidence >= 0.90

    @pytest.mark.asyncio
    async def test_apac_and_emea_regional_restrictions(self, db_session):
        """APAC allows Indian users; EMEA restricts Indian users."""
        job_apac = make_job(
            title="DevOps Engineer",
            work_mode="remote",
            jd_text="Remote - APAC. Working hours align with Asia-Pacific timezones."
        )
        job_emea = make_job(
            title="Product Designer",
            work_mode="remote",
            jd_text="Remote - EMEA only. Must be located in Europe, Middle East, or Africa."
        )
        user_in = make_user(home_country="IN")

        eval_apac = await remote_eligibility.evaluate_eligibility(job_apac, user_in, db_session, use_cache=False)
        assert eval_apac.verdict in ("eligible", "likely_eligible")
        assert any("apac" in e.quote.lower() for e in eval_apac.evidence)

        eval_emea = await remote_eligibility.evaluate_eligibility(job_emea, user_in, db_session, use_cache=False)
        assert eval_emea.verdict == "not_eligible"

    @pytest.mark.asyncio
    async def test_no_sponsorship_restriction(self, db_session):
        """On-site role in US with no sponsorship is not eligible for foreign candidate without authorization."""
        job = make_job(
            title="ML Engineer",
            work_mode="onsite",
            country="US",
            jd_text="Must be authorized to work in the US without sponsorship. No visa sponsorship available."
        )
        user_in = make_user(home_country="IN", sponsorship=True, relocate=True)
        eval_res = await remote_eligibility.evaluate_eligibility(job, user_in, db_session, use_cache=False)
        assert eval_res.verdict == "not_eligible"
        assert any("sponsorship" in e.quote.lower() for e in eval_res.evidence)

    @pytest.mark.asyncio
    async def test_eor_deel_positive_signal(self, db_session):
        """Mentions of hiring via Deel/Remote.com count as positive international hiring signal."""
        job = make_job(
            title="Platform Engineer",
            work_mode="remote",
            jd_text="We hire via Deel in 100+ countries across the globe."
        )
        user_in = make_user(home_country="IN")
        eval_res = await remote_eligibility.evaluate_eligibility(job, user_in, db_session, use_cache=False)
        assert eval_res.verdict == "likely_eligible"
        assert any("deel" in e.quote.lower() for e in eval_res.evidence)

    @pytest.mark.asyncio
    async def test_remote_unclear_without_stated_geography(self, db_session):
        """Remote posting with no geographic information yields 'unclear'."""
        job = make_job(
            title="Full Stack Engineer",
            work_mode="remote",
            jd_text="Join our fast-growing startup. You will write TypeScript and Python."
        )
        user_in = make_user(home_country="IN")
        eval_res = await remote_eligibility.evaluate_eligibility(job, user_in, db_session, use_cache=False)
        assert eval_res.verdict == "unclear"
        assert eval_res.confidence == 0.50

    @pytest.mark.asyncio
    async def test_policy_fetcher_eor_extraction(self):
        """Verifies policy_fetcher extracts Deel and global hiring statements with quotes."""
        policy_html = """
        <html>
            <body>
                <h1>Remote Hiring at Acme</h1>
                <p>We hire globally and partner with Deel to employ talent in over 90 countries.</p>
            </body>
        </html>
        """
        extracted = policy_fetcher.parse_policy_text(policy_html, source_url="https://acme.com/remote-policy")
        assert "Deel" in extracted["eor_hints"]
        assert len(extracted["quotes"]) > 0
        assert "Deel" in extracted["quotes"][0]["quote"]
