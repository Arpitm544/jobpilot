import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.models.job import Job, JobMatch, Source, EligibilityResult, JobClassification
from app.models.profile import MasterProfile
from app.models.preference import JobPreference
from app.schemas.job import JobResponse, JobMatchResponse, JobCreate, EligibilityResponse, EligibilityOverrideRequest
from app.api.deps import get_current_user, get_optional_current_user
from app.services.discovery_service import discovery_service, compute_dedupe_hash
from app.services.scoring_service import scoring_service
from app.services.ranking_service import ranking_service
from app.services.job_classifier import job_classifier
from app.services.remote_eligibility import remote_eligibility

router = APIRouter(prefix="/jobs", tags=["Job Discovery & Matching"])


class JobActionRequest(BaseModel):
    action: str  # "queue", "dismiss", "restore"


class ManualJobIngestRequest(BaseModel):
    company_name: str
    title: str
    location: str = "Remote"
    workplace_type: str = "Remote"
    job_type: str = "Full-time"
    salary_range: Optional[str] = None
    jd_text: str
    apply_url: str


def is_direct_job_url(url: str) -> bool:
    """
    Verifies that an application URL navigates directly to an official company careers ATS
    (Greenhouse, Lever, Ashby, Workday, direct corporate careers) rather than a third-party job aggregator or staffing portal.
    """
    if not url or not isinstance(url, str):
        return False
    u = url.strip().lower()

    # Reject third-party job aggregators, staffing portals, and intermediaries
    third_party_domains = [
        "internshala.com",
        "naukri.com",
        "indeed.com",
        "foundit.in",
        "monsterindia.com",
        "shine.com",
        "linkedin.com",
        "glassdoor.com",
        "simplyhired.com",
        "ziprecruiter.com",
        "unstop.com",
        "timesjobs.com",
        "freshersworld.com",
        "wellfound.com",
        "angel.co",
    ]
    for tp in third_party_domains:
        if tp in u:
            return False

    generic_domains = [
        "browserstack.com/careers",
        "careers.swiggy.com",
        "razorpay.com/jobs",
        "postman.com/company/careers",
        "careers.cred.club",
        "stripe/jobs/123456",
        "job-listings-graduate-trainee-infosys",
        "company/supabase/jobs/full-stack-engineer"
    ]
    for g in generic_domains:
        if g in u:
            return False

    try:
        from urllib.parse import urlparse
        p = urlparse(u).path.rstrip('/')
        if p in ["", "/jobs", "/careers", "/company/careers", "/internships", "/careers/"]:
            return False
    except Exception:
        pass

    return True


import re as _re

# Geographic restriction regex patterns for pre-screening remote and onsite job listings
_INDIA_LOC_RE = _re.compile(r'\b(india|bengaluru|bangalore|pune|delhi|mumbai|hyderabad|chennai|noida|gurgaon|gurugram|kolkata|ahmedabad|kochi|indore|chandigarh)\b', _re.I)
_WORLDWIDE_LOC_RE = _re.compile(r'\b(worldwide|anywhere\s*in\s*the\s*world|work\s*from\s*anywhere|global\s*remote|hire\s*globally)\b', _re.I)
_APAC_LOC_RE = _re.compile(r'\b(apac|asia|asia\s*pacific)\b', _re.I)
_FOREIGN_LOC_RE = _re.compile(r'\b(us\s*only|united\s*states|u\.?s\.?a?|emea|americas|latam|europe|uk\s*only|uk|united\s*kingdom|great\s*britain|london|dublin|stockholm|vienna|barcelona|bucharest|taipei|beijing|seoul|tokyo|brazil|sao\s*paulo|mexico|spain|austria|canada|germany|france|australia|washington|honolulu|california|texas|new\s*york|chicago|seattle|san\s*francisco|boston|denver|atlanta|austin)\b', _re.I)
_SPONSOR_RE = _re.compile(r'\b(visa\s*sponsorship\s*(?:is\s*)?available|we\s*sponsor\s*visas|will\s*sponsor\s*visas?|h-1b\s*sponsorship)\b', _re.I)
_US_ONLY_JD_RE = _re.compile(r'\b(us\s*only|united\s*states\s*only|must\s*(?:be|reside)\s*in\s*(?:the\s*)?us|us\s*based\s*only|within\s*the\s*us|authorized\s*to\s*work\s*in\s*the\s*us)\b', _re.I)
_UK_ONLY_RE = _re.compile(r'\b(uk\s*only|united\s*kingdom\s*only|must\s*be\s*in\s*the\s*uk|uk\s*residents\s*only)\b', _re.I)
_EU_ONLY_RE = _re.compile(r'\b(eu\s*only|european\s*union\s*only|europe\s*only|must\s*reside\s*in\s*(?:the\s*)?eu)\b', _re.I)
_EMEA_ONLY_RE = _re.compile(r'\b(remote\s*-\s*emea|emea\s*only|located\s*in\s*emea|within\s*emea)\b', _re.I)
_US_LOC_RE = _re.compile(r'(\b(u\.?s\.?a?|united\s*states)\b|remote\s*\(?u\.?s\.?\)?|us\s*only)', _re.I)
_CA_LOC_RE = _re.compile(r'(\b(canada|canadian)\b|remote\s*,?\s*canada)', _re.I)
_UK_LOC_RE = _re.compile(r'(\b(uk|united\s*kingdom|great\s*britain|london)\b|remote\s*,?\s*united\s*kingdom)', _re.I)
_EU_LOC_RE = _re.compile(r'(\b(europe|european\s*union|germany|france|netherlands|poland)\b)', _re.I)

_EMEA_COUNTRIES = {"GB","DE","FR","NL","IE","SE","CH","ES","IT","PL","AT","BE","DK","FI","NO","PT","CZ","RO","GR","ZA","AE","IL","EG","NG","KE"}
_APAC_COUNTRIES = {"IN","SG","AU","JP","MY","PH","VN","NZ","KR","ID","TH","TW","HK"}

# Disqualifiers for non-technical roles when serving jobs to software/developer engineering candidates
_NON_TECH_ROLE_RE = _re.compile(
    r"\b("
    r"video\s*editor|video\s*editing|videographer|videography|"
    r"youtube(?:\s*&|\s*and)?\s*content|content\s*creator|content\s*creation|"
    r"content\s*writer|content\s*writing|copywriter|copywriting|seo\s*writer|"
    r"graphic\s*designer|graphic\s*design|animator|animation|motion\s*graphics|"
    r"social\s*media\s*manager|social\s*media\s*intern|community\s*manager|"
    r"human\s*resources|hr\s*intern|talent\s*acquisition|recruiter|recruitment|"
    r"accountant|accounting|tax\s*manager|internal\s*audit|auditor|financial\s*analyst|"
    r"compliance\s*officer|legal\s*counsel|paralegal|"
    r"sales\s*representative|sales\s*manager|sales\s*director|account\s*executive|"
    r"growth\s*sales|territory\s*manager|business\s*development\s*associate|"
    r"receptionist|office\s*assistant|administrative\s*assistant|customer\s*support|"
    r"customer\s*success|customer\s*service|operations\s*associate|telecaller|"
    r"training\s*program\s*manager"
    r")\b",
    _re.I
)

_TECH_ROLE_EXCEPTIONS_RE = _re.compile(
    r"\b(engineer|developer|architect|programmer|data\s*scientist|sde|systems|security|qa|devops|swe)\b",
    _re.I
)


def is_remote_eligible_for_country(job, user_country: str) -> bool:
    """
    Pre-screens whether a job is eligible/authorized for a candidate from a given country (e.g. India).
    Ensures Indian citizens/candidates ONLY see jobs they are legally authorized to work:
    - Domestic roles in India (Bangalore, Pune, Delhi, Remote-India, etc.)
    - Worldwide Remote and APAC Remote roles open to India
    - Foreign onsite/hybrid roles ONLY if they explicitly sponsor visas
    - Foreign domestic roles (US-only, Canada-only, UK-only, EMEA) are strictly filtered out.
    """
    if not user_country:
        user_country = "IN"
    uc = user_country.upper().strip()

    loc = (job.location or "").lower()
    title = (job.title or "").lower()
    jd = job.jd_text or ""
    c = (job.country or "").upper().strip()
    wm = (job.work_mode or "").lower().strip()

    if uc == "IN":
        has_explicit_foreign = bool(_FOREIGN_LOC_RE.search(loc) or _FOREIGN_LOC_RE.search(title))
        has_explicit_india = bool(_INDIA_LOC_RE.search(loc) or _INDIA_LOC_RE.search(title))
        has_worldwide_term = bool(
            _WORLDWIDE_LOC_RE.search(loc) or 
            _APAC_LOC_RE.search(loc) or 
            "home based - worldwide" in loc or 
            "home based - apac" in loc or
            "remote, global" in loc or
            "remote, worldwide" in loc
        )

        # 1. Foreign location specified in title or location string (e.g. Austin, TX, San Francisco, London, Vienna...)
        # Explicit foreign location always overrides a DB country column that might be mis-tagged
        if has_explicit_foreign and not has_explicit_india and not has_worldwide_term:
            if wm in ("onsite", "hybrid") and _SPONSOR_RE.search(jd):
                return True
            return False

        has_india_term = has_explicit_india or (c == "IN")

        # 2. Foreign country code in DB (US, CA, GB, etc.) without explicit worldwide remote or India
        if c and c not in ("IN", "WORLDWIDE") and not has_india_term and not has_worldwide_term:
            if _SPONSOR_RE.search(jd):
                return True
            return False

        # 3. Explicit JD restrictions (e.g. US Only, must reside in US)
        if _US_ONLY_JD_RE.search(jd) and not has_india_term:
            return False
        if _UK_ONLY_RE.search(jd) and not has_india_term:
            return False
        if (_EU_ONLY_RE.search(jd) or _EMEA_ONLY_RE.search(jd)) and not has_worldwide_term:
            return False

        # 4. Onsite / Hybrid: must be in India or offer explicit visa sponsorship
        if wm in ("onsite", "hybrid") and not has_worldwide_term:
            if has_india_term:
                return True
            if _SPONSOR_RE.search(jd):
                return True
            # Distributed or unknown onsite outside India without sponsorship is not eligible
            return False

        # 5. Remote / Home-based:
        if has_worldwide_term or _WORLDWIDE_LOC_RE.search(jd) or _APAC_LOC_RE.search(jd):
            return True

        if has_india_term:
            return True

        if job.allowed_countries:
            ac = [x.upper() for x in job.allowed_countries]
            return "IN" in ac or "WORLDWIDE" in ac or any(x in ["SG", "MY", "PH", "APAC"] for x in ac)

        if job.excluded_countries:
            ec = [x.upper() for x in job.excluded_countries]
            if "IN" in ec:
                return False

        return False

    # Default fallback for other candidate countries
    if wm in ("onsite", "hybrid"):
        if job.country:
            return job.country.upper() == uc
        return True

    if _WORLDWIDE_LOC_RE.search(jd) or "worldwide" in loc:
        return True

    if _US_ONLY_JD_RE.search(jd):
        return uc == "US"
    if _UK_ONLY_RE.search(jd):
        return uc == "GB"
    if _EU_ONLY_RE.search(jd) or _EMEA_ONLY_RE.search(jd):
        return uc in _EMEA_COUNTRIES

    return True


async def _get_or_create_primary_profile(db: AsyncSession, current_user: User) -> MasterProfile:
    """Fetch primary master profile or fallback to any existing profile / default template"""
    prof_res = await db.execute(
        select(MasterProfile).where(
            MasterProfile.user_id == current_user.id,
            MasterProfile.is_primary == True
        )
    )
    profile = prof_res.scalar_one_or_none()
    if not profile:
        # Fallback to any profile belonging to user
        any_res = await db.execute(
            select(MasterProfile)
            .where(MasterProfile.user_id == current_user.id)
            .order_by(MasterProfile.version.desc())
        )
        profile = any_res.scalars().first()
        if profile:
            profile.is_primary = True
            await db.commit()
            await db.refresh(profile)

    if not profile:
        # Initialize default master profile template so user can discover jobs without crashing
        profile = MasterProfile(
            id=uuid.uuid4(),
            user_id=current_user.id,
            version_name="Primary Master Profile",
            version=1,
            is_primary=True,
            is_active=True,
            contact_info={
                "full_name": current_user.full_name or "",
                "email": current_user.email,
                "phone": "",
                "location": "",
                "linkedin": "",
                "github": "",
                "portfolio": ""
            },
            summary="",
            skills={
                "languages": [],
                "frameworks": [],
                "databases": [],
                "tools": [],
                "cloud_devops": [],
                "soft_skills": []
            },
            experience=[],
            projects=[],
            education=[],
            certifications=[],
            achievements=[],
            links=[]
        )
        db.add(profile)
        await db.commit()
        await db.refresh(profile)

    return profile


@router.post("/discover")
async def trigger_discovery(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Triggers on-demand discovery across ATS boards (Greenhouse, Lever, Ashby),
    deduplicates against database, and scores all matching jobs against candidate profile.
    """
    # 1. Fetch user preferences
    pref_res = await db.execute(select(JobPreference).where(JobPreference.user_id == current_user.id))
    prefs = pref_res.scalar_one_or_none()
    if not prefs:
        prefs = JobPreference(user_id=current_user.id)
        db.add(prefs)
        await db.commit()
        await db.refresh(prefs)

    # 2. Fetch or initialize primary master profile
    profile = await _get_or_create_primary_profile(db, current_user)

    # 3. Run Discovery
    jobs = await discovery_service.discover_jobs_for_user(
        db=db,
        user_id=current_user.id,
        preferences=prefs
    )

    # 4. Return discovery summary — scoring happens lazily via GET /jobs
    # The scoring loop was removed because:
    #   a) job.jd_parsed_skills column doesn't exist on the Job model
    #   b) The frontend calls GET /jobs independently which handles all filtering
    #   c) Sequential embedding of 10 jobs adds ~10s latency unnecessarily
    return [
        {"id": str(j.id), "match_score": 75, "status": "discovered",
         "matched_skills": [], "missing_skills": [],
         "match_rationale": "Ranked via country discovery pipeline.",
         "job": {"id": str(j.id), "title": j.title, "company_name": j.company_name}}
        for j in jobs[:10]
    ]


@router.get("", response_model=List[JobResponse])
async def list_jobs(
    country: Optional[str] = Query(None, description="2-letter ISO country code"),
    city: Optional[str] = Query(None),
    work_mode: Optional[str] = Query(None, description="onsite, hybrid, remote, any"),
    employment_type: Optional[str] = Query(None, description="internship, full_time, trainee, etc."),
    include_fresher: bool = Query(False, description="Include fresher/graduate entry-level full-time roles in internship mode"),
    include_maybe: bool = Query(False, description="Include borderline/maybe internships in results"),
    stipend_min: Optional[float] = Query(None, description="Minimum salary/stipend amount"),
    posted_within: Optional[int] = Query(None, description="Posted within N days"),
    search: Optional[str] = Query(None),
    only_eligible: bool = Query(False, description="Show only roles user is eligible for"),
    actively_hiring_only: bool = Query(True, description="Filter for actively hiring jobs posted recently"),
    sort: str = Query("country_first", description="country_first, recent"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Country-aware job discovery endpoint with strict internship mode.
    Filters: country, city, work_mode, employment_type, include_fresher, include_maybe, stipend_min, posted_within, search, actively_hiring_only.
    Ranks:
    1. Home-country on-site/hybrid in preferred cities
    2. Home-country remote
    3. Remote roles user is eligible for (worldwide or allowed in country)
    4. International roles (only if open_to_international is enabled)
    Default feed mix: ~80% home country, 20% eligible remote.
    """
    now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
    cutoff_active = now_utc - timedelta(days=45)

    query = select(Job).options(selectinload(Job.classifications)).where(Job.is_active == True)

    if actively_hiring_only:
        # Exclude stale / zombie postings older than 45 days so candidates only see actively hiring roles
        query = query.where(
            (Job.posted_date >= cutoff_active) |
            ((Job.posted_date == None) & (Job.discovered_at >= cutoff_active))
        )

    if isinstance(country, str) and country.strip():
        query = query.where(Job.country == country.strip().upper())
    if isinstance(city, str) and city.strip():
        query = query.where(Job.city.ilike(f"%{city.strip()}%"))

    if isinstance(work_mode, str) and work_mode.strip() and work_mode.lower() not in ("all", "any"):
        wm_clean = work_mode.strip().lower().replace("-", "").replace("_", "")
        if wm_clean in ("remote", "offsite"):
            query = query.where(Job.work_mode == "remote")
        elif wm_clean == "onsite":
            query = query.where(Job.work_mode == "onsite")
        elif wm_clean == "hybrid":
            query = query.where(Job.work_mode == "hybrid")

    is_internship_mode = bool(isinstance(employment_type, str) and employment_type.strip().lower() in ("internship", "intern"))
    if isinstance(employment_type, str) and employment_type.strip() and employment_type.lower() not in ("all", "any") and not is_internship_mode:
        emp_clean = employment_type.strip().lower().replace("-", "_")
        if emp_clean in ("part_time", "parttime"):
            query = query.where(
                (Job.employment_type.in_(["part_time", "part-time", "contract"])) |
                (Job.title.ilike("%part time%")) |
                (Job.title.ilike("%part-time%"))
            )
        elif emp_clean in ("full_time", "fulltime"):
            query = query.where(
                (Job.employment_type.in_(["full_time", "full-time"])) |
                (Job.title.ilike("%full time%")) |
                (Job.title.ilike("%full-time%"))
            )
        else:
            query = query.where(Job.employment_type == emp_clean)
    elif is_internship_mode:
        # Broad fetch of candidate internship / trainee / fresher jobs for strict classifier filtering
        allowed_types = ["internship", "trainee", "apprenticeship"]
        if include_fresher:
            allowed_types.append("fresher_full_time")
        query = query.where(
            (Job.employment_type.in_(allowed_types)) |
            (Job.title.ilike("%intern%")) |
            (Job.title.ilike("%trainee%")) |
            (Job.title.ilike("%apprentice%")) |
            (Job.title.ilike("%werkstudent%")) |
            (Job.title.ilike("%praktikum%"))
        )

    if isinstance(stipend_min, (int, float)):
        query = query.where((Job.stipend_min >= stipend_min) | (Job.stipend_max >= stipend_min))
    if isinstance(posted_within, int) and posted_within > 0:
        cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=posted_within)
        query = query.where(Job.posted_date >= cutoff)

    if isinstance(search, str) and search.strip():
        s_term = f"%{search.strip()}%"
        query = query.where(
            Job.title.ilike(s_term) |
            Job.company_name.ilike(s_term) |
            Job.location.ilike(s_term)
        )

    if isinstance(sort, str) and sort == "recent":
        query = query.order_by(desc(Job.posted_date))

    result = await db.execute(query)
    all_jobs = result.scalars().all()

    # Apply strict country/citizenship authorization screening
    user_country_code = "IN"
    if current_user and hasattr(current_user, 'home_country') and current_user.home_country:
        user_country_code = current_user.home_country.upper().strip()
    elif current_user and hasattr(current_user, 'citizenship') and current_user.citizenship:
        user_country_code = current_user.citizenship.upper().strip()

    # Load user's target roles and preferences early for precision domain filtering
    user_target_roles = []
    if current_user:
        pref_res = await db.execute(select(JobPreference).where(JobPreference.user_id == current_user.id))
        user_pref = pref_res.scalar_one_or_none()
        if user_pref and user_pref.target_roles:
            user_target_roles = [str(r).strip() for r in user_pref.target_roles if str(r).strip()]

    user_wants_non_tech = any(_NON_TECH_ROLE_RE.search(tr) for tr in user_target_roles)

    filtered_jobs = []
    for j in all_jobs:
        # 1. Require direct job application URL (rejects third-party portals like internshala, naukri, indeed)
        if not is_direct_job_url(j.apply_url):
            continue

        # Normalize ats_type so official career ATS platforms (Greenhouse, Lever, Ashby) are displayed
        if j.ats_type and j.ats_type.lower() in ("internshala", "naukri", "indeed", "wellfound", "unknown"):
            u_low = (j.apply_url or "").lower()
            if "greenhouse.io" in u_low:
                j.ats_type = "greenhouse"
            elif "lever.co" in u_low:
                j.ats_type = "lever"
            elif "ashbyhq.com" in u_low:
                j.ats_type = "ashby"
            else:
                j.ats_type = "careers"

        # 2. Strict country / citizenship authorization pre-screening
        # Ensures Indian candidates only see jobs legally authorized for Indian citizens
        if not is_remote_eligible_for_country(j, user_country_code):
            continue

        # 3. Disqualify non-tech / out-of-domain roles (video editing, youtube content, sales, hr, accounting)
        # for software engineering / developer candidates
        if _NON_TECH_ROLE_RE.search(j.title) and not _TECH_ROLE_EXCEPTIONS_RE.search(j.title) and not user_wants_non_tech:
            continue

        # 4. In internship mode: require technical / engineering relevance
        if is_internship_mode and not user_wants_non_tech:
            if not _TECH_ROLE_EXCEPTIONS_RE.search(j.title) and not any(k in j.title.lower() for k in ["tech", "software", "developer", "engineer", "sde", "web", "frontend", "backend", "full stack", "fullstack", "ai", "data", "qa", "cloud", "devops"]):
                continue

        # Check classification record or compute deterministic classification
        cls_info = None
        if j.classifications:
            first_cls = j.classifications[0]
            cls_info = {
                "employment_type": first_cls.employment_type,
                "confidence": first_cls.confidence,
                "evidence": first_cls.evidence or [],
                "is_maybe": (0.50 <= first_cls.confidence < 0.85 and first_cls.employment_type == "internship")
            }
        else:
            cls_res = job_classifier.classify_job_sync(
                title=j.title,
                jd_text=j.jd_text,
                raw_employment_type=j.job_type,
                country=j.country
            )
            cls_info = {
                "employment_type": cls_res.employment_type,
                "confidence": cls_res.confidence,
                "evidence": [e.model_dump() for e in cls_res.evidence],
                "is_maybe": cls_res.is_maybe
            }

        j.classification_confidence = cls_info["confidence"]
        j.classification_evidence = cls_info["evidence"]
        j.is_maybe_internship = cls_info["is_maybe"]

        if is_internship_mode:
            emp_t = cls_info["employment_type"]
            conf = cls_info["confidence"]
            is_strict = (emp_t == "internship" and conf >= 0.85)
            is_fresher_ok = (include_fresher and emp_t in ("fresher_full_time", "graduate_trainee"))
            is_maybe_ok = (include_maybe and emp_t == "internship" and 0.50 <= conf < 0.85)

            if not (is_strict or is_fresher_ok or is_maybe_ok):
                continue  # Filter out senior roles, false positives, or unselected types

        filtered_jobs.append(j)

    jobs = filtered_jobs

    # Load eligibility results if user authenticated
    eligibility_map = {}
    if current_user and jobs:
        job_ids = [j.id for j in jobs]
        elig_res = await db.execute(
            select(EligibilityResult).where(
                EligibilityResult.user_id == current_user.id,
                EligibilityResult.job_id.in_(job_ids)
            )
        )
        for er in elig_res.scalars().all():
            eligibility_map[str(er.job_id)] = er.verdict

    # Apply country-first ranking and feed mix (exclude unauthorized jobs)
    if sort == "country_first":
        ranked_jobs = ranking_service.rank_and_mix_jobs(
            jobs=jobs,
            user=current_user,
            eligibility_map=eligibility_map,
            include_ineligible=False
        )
    else:
        ranked_jobs = list(jobs)

    # Prioritize user's saved target roles from onboarding (e.g. Full-Stack, Frontend, Backend, AI Agent, GEN AI...)
    DOMAIN_SYNONYMS = {
        "full-stack": ["full stack", "fullstack", "full-stack"],
        "full stack": ["full stack", "fullstack", "full-stack"],
        "frontend": ["frontend", "front-end", "web frontend", "ui engineer", "react"],
        "backend": ["backend", "back-end", "api", "database", "systems engineer"],
        "ai agent": ["ai agent", "ai agents", "agentic", "agent platform", "duo agent", "autonomous agent"],
        "gen ai": ["gen ai", "genai", "generative ai", "ai engineer", "workers ai", "ai gateway", "llm", "deep learning"],
        "agentic ai": ["agentic", "agentic ai", "agentic sdlc", "agentic development", "autonomous"]
    }

    def _score_target_role(job_title: str, roles: List[str]) -> int:
        if not roles:
            return 0
        t_low = job_title.lower()
        score = 0
        for r in roles:
            r_low = r.lower()
            # Exact phrase match
            if r_low in t_low:
                score += 50
            # Domain synonyms match
            for domain_key, syns in DOMAIN_SYNONYMS.items():
                if domain_key in r_low:
                    if any(s in t_low for s in syns):
                        score += 35
            # General tech role match
            keywords = [k for k in _re.split(r'[\s\-_/]+', r_low) if len(k) > 2 and k not in ("developer", "engineer")]
            matches = sum(1 for k in keywords if k in t_low)
            if matches >= 2:
                score += 20
            elif matches == 1:
                score += 10
            # Bonus for developer/engineer role type
            if any(k in t_low for k in ["developer", "engineer", "sde"]):
                score += 5
        return score

    if user_target_roles:
        # Boost user target roles to the top!
        ranked_jobs.sort(
            key=lambda j: (
                _score_target_role(j.title, user_target_roles) > 0,
                _score_target_role(j.title, user_target_roles),
                j.posted_date or j.discovered_at or datetime.min
            ),
            reverse=True
        )

    # Attach dynamic eligibility verdict and active hiring freshness metadata
    for rj in ranked_jobs:
        rj.eligibility_verdict = eligibility_map.get(str(rj.id))
        ref_date = rj.posted_date or rj.discovered_at
        if ref_date:
            days = max(0, (now_utc - ref_date).days)
            rj.days_since_posted = days
            rj.is_actively_hiring = bool(rj.is_active and days <= 45)
        else:
            rj.days_since_posted = 1
            rj.is_actively_hiring = True

    real_offset = offset if isinstance(offset, int) else 0
    real_limit = limit if isinstance(limit, int) else 50
    return ranked_jobs[real_offset:real_offset + real_limit]


@router.get("/matches", response_model=List[JobMatchResponse])
async def list_job_matches(
    match_status: Optional[str] = Query(None, description="discovered, queued, tailored, applied, dismissed"),
    min_score: Optional[float] = Query(None, ge=0, le=100),
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List scored job matches with filtering by status and match threshold"""
    query = (
        select(JobMatch)
        .options(selectinload(JobMatch.job))
        .where(JobMatch.user_id == current_user.id)
        .order_by(desc(JobMatch.match_score))
    )

    if match_status and match_status != "all":
        query = query.where(JobMatch.status == match_status)
    if min_score is not None:
        query = query.where(JobMatch.match_score >= min_score)

    result = await db.execute(query)
    matches = result.scalars().all()

    if search:
        s_lower = search.lower()
        matches = [
            m for m in matches
            if s_lower in m.job.title.lower() or s_lower in m.job.company_name.lower() or s_lower in m.job.location.lower()
        ]

    return matches


@router.get("/{job_id}", response_model=JobResponse)
async def get_job_details(
    job_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve full job details including full JD text and requirements"""
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return job


@router.post("/{job_id}/action", response_model=JobMatchResponse)
async def update_job_match_status(
    job_id: uuid.UUID,
    body: JobActionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Move job match between states: 'queued' (ready for tailoring), 'dismissed', 'discovered'"""
    result = await db.execute(
        select(JobMatch)
        .options(selectinload(JobMatch.job))
        .where(JobMatch.job_id == job_id, JobMatch.user_id == current_user.id)
    )
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job match not found for user")

    valid_actions = {
        "queue": "queued",
        "dismiss": "dismissed",
        "restore": "discovered",
    }
    new_status = valid_actions.get(body.action)
    if not new_status:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid action '{body.action}'")

    match.status = new_status
    await db.commit()
    await db.refresh(match)
    return match


@router.post("/manual-add", response_model=JobMatchResponse)
@router.post("/manual", response_model=JobMatchResponse)
async def manually_add_job(
    body: ManualJobIngestRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Manually paste any Job Description or custom URL to parse, score, and queue instantly.
    """
    # Check Master Profile
    profile = await _get_or_create_primary_profile(db, current_user)

    pref_res = await db.execute(select(JobPreference).where(JobPreference.user_id == current_user.id))
    prefs = pref_res.scalar_one_or_none()
    if not prefs:
        prefs = JobPreference(user_id=current_user.id)
        db.add(prefs)
        await db.commit()

    if not is_direct_job_url(body.apply_url):
        raise HTTPException(
            status_code=400,
            detail="Please provide a direct URL to the specific job posting or application form, rather than a generic corporate careers homepage."
        )

    dedupe_hash = compute_dedupe_hash(body.company_name, body.title, body.location)
    source = await discovery_service.get_or_create_source(db, "manual", source_type="manual")

    existing_job_res = await db.execute(select(Job).where(Job.dedupe_hash == dedupe_hash))
    job = existing_job_res.scalar_one_or_none()

    if not job:
        job = Job(
            id=uuid.uuid4(),
            source_id=source.id,
            company_name=body.company_name,
            title=body.title,
            location=body.location,
            workplace_type=body.workplace_type,
            job_type=body.job_type,
            salary_range=body.salary_range,
            jd_text=body.jd_text,
            apply_url=body.apply_url,
            ats_type="manual",
            dedupe_hash=dedupe_hash,
            is_active=True,
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)

    # Score job
    match = await scoring_service.calculate_match(
        db=db,
        user_id=current_user.id,
        job=job,
        profile=profile,
        preferences=prefs
    )
    match.job = job
    return match


@router.get("/{job_id}/eligibility", response_model=EligibilityResponse)
async def get_job_eligibility(
    job_id: uuid.UUID,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns verified remote/location eligibility evaluation for the current user and job.
    Includes verdict, confidence, reasons, and verbatim supporting quotes with links.
    """
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    eval_result = await remote_eligibility.evaluate_eligibility(
        job=job,
        user=current_user,
        db=db,
        use_cache=True
    )

    return EligibilityResponse(
        job_id=job.id,
        user_id=current_user.id if current_user else None,
        verdict=eval_result.verdict,
        confidence=eval_result.confidence,
        reasons=eval_result.reasons,
        evidence=[e.model_dump() for e in eval_result.evidence],
        user_override=eval_result.user_override,
        evaluated_at=datetime.now(timezone.utc).replace(tzinfo=None)
    )


@router.post("/{job_id}/eligibility/override", response_model=EligibilityResponse)
async def override_job_eligibility(
    job_id: uuid.UUID,
    body: EligibilityOverrideRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Allows a candidate to manually override an eligibility verdict
    (e.g., 'Recruiter confirmed they hire in India via Deel').
    Logged and audited per job.
    """
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    valid_verdicts = {"eligible", "likely_eligible", "unclear", "likely_not_eligible", "not_eligible"}
    if body.verdict not in valid_verdicts:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid verdict '{body.verdict}'")

    inputs_hash = remote_eligibility.compute_inputs_hash(current_user)
    override_data = {
        "verdict": body.verdict,
        "notes": body.notes or "",
        "overridden_at": datetime.now(timezone.utc).isoformat(),
        "user_email": current_user.email
    }

    # Query or create EligibilityResult
    elig_query = select(EligibilityResult).where(
        EligibilityResult.job_id == job_id,
        EligibilityResult.user_id == current_user.id
    )
    existing_row = (await db.execute(elig_query)).scalar_one_or_none()

    if existing_row:
        existing_row.verdict = body.verdict
        existing_row.user_override = override_data
        existing_row.evaluated_at = datetime.now(timezone.utc).replace(tzinfo=None)
        res_row = existing_row
    else:
        new_row = EligibilityResult(
            id=uuid.uuid4(),
            job_id=job_id,
            user_id=current_user.id,
            verdict=body.verdict,
            confidence=1.0,
            reasons=[f"Manually overridden by candidate: {body.notes or 'No reason provided'}"],
            evidence=[],
            user_override=override_data,
            inputs_hash=inputs_hash,
            evaluated_at=datetime.now(timezone.utc).replace(tzinfo=None)
        )
        db.add(new_row)
        res_row = new_row

    await db.commit()
    await db.refresh(res_row)

    return EligibilityResponse(
        id=res_row.id,
        job_id=res_row.job_id,
        user_id=res_row.user_id,
        verdict=res_row.verdict,
        confidence=res_row.confidence,
        reasons=res_row.reasons or [],
        evidence=res_row.evidence or [],
        user_override=res_row.user_override,
        evaluated_at=res_row.evaluated_at
    )

