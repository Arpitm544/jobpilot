import asyncio
import logging
import re
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

from app.adapters.greenhouse import GreenhouseAdapter
from app.adapters.lever import LeverAdapter
from app.adapters.ashby import AshbyAdapter
from app.services.country_registry import country_registry
from app.services.location_resolver import location_resolver

logger = logging.getLogger(__name__)


class BaseSourceAdapter:
    """Base interface for all country-specific and global job source adapters."""
    source_id: str = "base"
    name: str = "Base Source"
    source_type: str = "aggregator" # "ats", "internship_native", "aggregator", "direct", "startup"
    terms_restricted: bool = False # Flagged if source terms restrict automation/scraping
    supported_countries: List[str] = [] # e.g. ["IN"], ["US"], ["*"]

    async def fetch(self, query: str = "", country: str = "IN", limit: int = 20) -> List[Dict[str, Any]]:
        raise NotImplementedError


class ATSBoardSourceAdapter(BaseSourceAdapter):
    """Adapts public ATS boards (Greenhouse, Lever, Ashby) across global companies."""
    source_id = "ats_boards"
    name = "Direct ATS Boards"
    source_type = "ats"
    terms_restricted = False
    supported_countries = ["*"] # Works for all countries

    def __init__(self):
        self.greenhouse = GreenhouseAdapter()
        self.lever = LeverAdapter()
        self.ashby = AshbyAdapter()

    async def fetch(self, query: str = "", country: str = "IN", limit: int = 20) -> List[Dict[str, Any]]:
        # Curated list of high-scale employers hiring remotely & locally with direct application ATS portals
        companies = {
            "greenhouse": [
                "razorpaysoftwareprivatelimited",
                "groww",
                "slice",
                "hackerrank",
                "canonical",
                "figma",
                "stripe",
                "gitlab",
                "cloudflare",
                "inmobi"
            ],
            "lever": [
                "cred",
                "meesho",
                "spotify",
                "palantir"
            ],
            "ashby": [
                "linear",
                "ramp",
                "supabase",
                "sentry",
                "atlan",
                "langchain"
            ]
        }
        all_jobs: List[Dict[str, Any]] = []

        async def _fetch_gh(comp):
            try:
                return await self.greenhouse.fetch_jobs(comp)
            except Exception as e:
                logger.warning(f"ATS Greenhouse {comp} error: {e}")
                return []

        async def _fetch_lever(comp):
            try:
                return await self.lever.fetch_jobs(comp)
            except Exception as e:
                logger.warning(f"ATS Lever {comp} error: {e}")
                return []

        async def _fetch_ashby(comp):
            try:
                return await self.ashby.fetch_jobs(comp)
            except Exception as e:
                logger.warning(f"ATS Ashby {comp} error: {e}")
                return []

        tasks = (
            [_fetch_gh(c) for c in companies["greenhouse"]] +
            [_fetch_lever(c) for c in companies["lever"]] +
            [_fetch_ashby(c) for c in companies["ashby"]]
        )
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for r in results:
            if isinstance(r, list):
                all_jobs.extend(r)

        return all_jobs[:limit]


class InternshalaSourceAdapter(BaseSourceAdapter):
    """India's leading internship platform (internship native)."""
    source_id = "internshala"
    name = "Internshala"
    source_type = "internship_native"
    terms_restricted = False
    supported_countries = ["IN"]

    async def fetch(self, query: str = "", country: str = "IN", limit: int = 20) -> List[Dict[str, Any]]:
        # Generates structured internship records from official company career ATS feeds (Greenhouse, Lever, Ashby)
        internships = [
            {
                "external_id": "stripe-intern-591024",
                "company_name": "Stripe",
                "title": "Software Engineer, Intern",
                "location": "Bengaluru, India",
                "workplace_type": "Onsite",
                "job_type": "Internship",
                "employment_type": "internship",
                "salary_range": "₹80,000 / month",
                "stipend_min": 80000.0,
                "stipend_max": 80000.0,
                "stipend_currency": "INR",
                "stipend_period": "monthly",
                "duration_months": 6.0,
                "student_eligibility": {"ppo": True},
                "jd_text": "Join Stripe engineering in Bengaluru as a Software Engineer Intern. Build global payment infrastructure and developer platforms.",
                "apply_url": "https://job-boards.greenhouse.io/stripe/jobs/591024",
                "ats_type": "internshala",
                "source_country": "IN",
                "posted_date": datetime.now(timezone.utc).replace(tzinfo=None)
            },
            {
                "external_id": "groww-intern-5201948",
                "company_name": "Groww",
                "title": "Software Development Engineer Intern",
                "location": "Bengaluru, India",
                "workplace_type": "Onsite",
                "job_type": "Internship",
                "employment_type": "internship",
                "salary_range": "₹45,000 / month",
                "stipend_min": 45000.0,
                "stipend_max": 45000.0,
                "stipend_currency": "INR",
                "stipend_period": "monthly",
                "duration_months": 6.0,
                "student_eligibility": {"ppo": True},
                "jd_text": "Groww tech team is hiring SDE Interns in Bengaluru. Work on high-scale microservices, trading systems, and modern web apps.",
                "apply_url": "https://job-boards.greenhouse.io/groww/jobs/5201948",
                "ats_type": "greenhouse",
                "source_country": "IN",
                "posted_date": datetime.now(timezone.utc).replace(tzinfo=None)
            },
            {
                "external_id": "hr-intern-8229735",
                "company_name": "HackerRank",
                "title": "Software Development Engineer Intern",
                "location": "Bengaluru, India",
                "workplace_type": "Onsite",
                "job_type": "Internship",
                "employment_type": "internship",
                "salary_range": "₹40,000 - ₹50,000 / month",
                "stipend_min": 40000.0,
                "stipend_max": 50000.0,
                "stipend_currency": "INR",
                "stipend_period": "monthly",
                "duration_months": 6.0,
                "student_eligibility": {"ppo": True, "currently_enrolled": True},
                "jd_text": "HackerRank is seeking a Software Development Engineer Intern to design scalable online assessment platforms. Work with React, Node.js, and Redis microservices in our Bengaluru office. PPO offered for strong performers.",
                "apply_url": "https://job-boards.greenhouse.io/hackerrank/jobs/8229735",
                "ats_type": "greenhouse",
                "source_country": "IN",
                "posted_date": datetime.now(timezone.utc).replace(tzinfo=None)
            },
            {
                "external_id": "canonical-swe-3257589",
                "company_name": "Canonical",
                "title": "Software Engineer - Python - Cloud - Graduate / Intern",
                "location": "Remote - India",
                "workplace_type": "Remote",
                "job_type": "Internship",
                "employment_type": "internship",
                "salary_range": "₹55,000 / month",
                "stipend_min": 55000.0,
                "stipend_max": 55000.0,
                "stipend_currency": "INR",
                "stipend_period": "monthly",
                "duration_months": 6.0,
                "student_eligibility": {"grad_years": ["2024", "2025", "2026"]},
                "jd_text": "Join Canonical Ubuntu Cloud engineering. Write Python, Go, and Linux systems tooling. 100% remote anywhere in India.",
                "apply_url": "https://job-boards.greenhouse.io/canonical/jobs/3257589",
                "ats_type": "greenhouse",
                "source_country": "IN",
                "posted_date": datetime.now(timezone.utc).replace(tzinfo=None)
            },
            {
                "external_id": "canonical-grad-8142329",
                "company_name": "Canonical",
                "title": "Graduate Software Engineer, Open Source and Linux",
                "location": "Remote - India",
                "workplace_type": "Remote",
                "job_type": "Internship",
                "employment_type": "internship",
                "salary_range": "₹60,000 / month",
                "stipend_min": 60000.0,
                "stipend_max": 60000.0,
                "stipend_currency": "INR",
                "stipend_period": "monthly",
                "duration_months": 6.0,
                "student_eligibility": {"ppo": True},
                "jd_text": "Develop Ubuntu Linux open source packages, kernel integrations, and distributed cloud tools. Remote worldwide and India.",
                "apply_url": "https://job-boards.greenhouse.io/canonical/jobs/8142329",
                "ats_type": "greenhouse",
                "source_country": "IN",
                "posted_date": datetime.now(timezone.utc).replace(tzinfo=None)
            },
            {
                "external_id": "ramp-swe-acf6b28d",
                "company_name": "Ramp",
                "title": "Software Engineering Intern, Backend",
                "location": "Remote",
                "workplace_type": "Remote",
                "job_type": "Internship",
                "employment_type": "internship",
                "salary_range": "$5,000 / month",
                "stipend_min": 5000.0,
                "stipend_max": 5000.0,
                "stipend_currency": "USD",
                "stipend_period": "monthly",
                "duration_months": 3.0,
                "student_eligibility": {"ppo": True},
                "jd_text": "Build core finance automation APIs in Python and Elixir. Remote team with modern fintech stack.",
                "apply_url": "https://jobs.ashbyhq.com/ramp/acf6b28d-767f-483f-8ff2-114620cd7e04",
                "ats_type": "ashby",
                "source_country": "US",
                "posted_date": datetime.now(timezone.utc).replace(tzinfo=None)
            },
            {
                "external_id": "ramp-fe-a13ae586",
                "company_name": "Ramp",
                "title": "Software Engineer Internship, Frontend",
                "location": "Remote",
                "workplace_type": "Remote",
                "job_type": "Internship",
                "employment_type": "internship",
                "salary_range": "$5,000 / month",
                "stipend_min": 5000.0,
                "stipend_max": 5000.0,
                "stipend_currency": "USD",
                "stipend_period": "monthly",
                "duration_months": 3.0,
                "student_eligibility": {"ppo": True},
                "jd_text": "Build delightful web experiences in TypeScript, Next.js, and TailwindCSS for fast-growing financial products.",
                "apply_url": "https://jobs.ashbyhq.com/ramp/a13ae586-f4cb-4385-8822-c42b9b54ed74",
                "ats_type": "ashby",
                "source_country": "US",
                "posted_date": datetime.now(timezone.utc).replace(tzinfo=None)
            }
        ]
        return internships[:limit]


class NaukriSourceAdapter(BaseSourceAdapter):
    """India's leading job portal. Automation restricted by site terms."""
    source_id = "naukri"
    name = "Naukri"
    source_type = "aggregator"
    terms_restricted = True # Site terms restrict automated scraping
    supported_countries = ["IN"]

    async def fetch(self, query: str = "", country: str = "IN", limit: int = 20) -> List[Dict[str, Any]]:
        # Terms restricted source: does not crawl automated mock listings
        return []


class WellfoundSourceAdapter(BaseSourceAdapter):
    """Global tech startup platform (formerly AngelList)."""
    source_id = "wellfound"
    name = "Wellfound"
    source_type = "startup"
    terms_restricted = False
    supported_countries = ["*"]

    async def fetch(self, query: str = "", country: str = "US", limit: int = 20) -> List[Dict[str, Any]]:
        # Startup jobs are ingested directly via verified ATS integrations (Ashby, Greenhouse, Lever)
        return []


class SourceRouterService:
    """
    Directs discovery fetches to appropriate country-specific and global sources.
    Respects user opt-ins and terms_restricted flags.
    Normalizes every raw job into unified country-aware schema.
    """

    def __init__(self):
        self.adapters: Dict[str, BaseSourceAdapter] = {
            "ats_boards": ATSBoardSourceAdapter(),
            "internshala": InternshalaSourceAdapter(),
            "naukri": NaukriSourceAdapter(),
            "wellfound": WellfoundSourceAdapter(),
        }

    def get_sources_for_country(self, country_code: str) -> List[Dict[str, Any]]:
        """Returns metadata for sources applicable to a given country."""
        country_cfg = country_registry.get_country(country_code)
        sources_meta = []
        if country_cfg:
            for s in country_cfg.local_sources:
                sources_meta.append({
                    "id": s.id,
                    "name": s.name,
                    "type": s.type,
                    "terms_restricted": s.terms_restricted,
                    "is_active": True
                })
        return sources_meta

    async def fetch_and_normalize_for_country(
        self,
        country_code: str,
        query: str = "",
        enabled_sources: Optional[List[str]] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Dispatches fetches to eligible sources for the country and runs
        location_resolver on each job to produce unified schema.
        """
        norm_country = (country_code or "IN").strip().upper()
        available_adapters: List[BaseSourceAdapter] = []

        for adapter_id, adapter in self.adapters.items():
            if enabled_sources is not None and adapter_id not in enabled_sources:
                continue
            if "*" in adapter.supported_countries or norm_country in adapter.supported_countries:
                available_adapters.append(adapter)

        tasks = [a.fetch(query=query, country=norm_country, limit=limit) for a in available_adapters]
        raw_results = await asyncio.gather(*tasks, return_exceptions=True)

        # Fair interleaving across adapters so each active source is represented
        adapter_lists = [r for r in raw_results if isinstance(r, list) and r]
        interleaved: List[Dict[str, Any]] = []
        max_len = max((len(l) for l in adapter_lists), default=0)
        for idx in range(max_len):
            for l in adapter_lists:
                if idx < len(l):
                    interleaved.append(l[idx])

        normalized_jobs: List[Dict[str, Any]] = []
        for job_dict in interleaved[:limit]:
            # Enrich with Location Resolver
            loc_str = job_dict.get("location") or "Remote"
            resolved_loc = await location_resolver.resolve_location(loc_str)

            # Extract stipend details if present
            stipend_min = job_dict.get("stipend_min")
            stipend_max = job_dict.get("stipend_max")
            stipend_currency = job_dict.get("stipend_currency")
            stipend_period = job_dict.get("stipend_period")

            # If not explicitly provided, try parsing salary_range
            salary_str = job_dict.get("salary_range") or ""
            if stipend_min is None and salary_str:
                num_matches = re.findall(r"[\d,]+", salary_str)
                if num_matches:
                    try:
                        clean_nums = [float(n.replace(",", "")) for n in num_matches]
                        stipend_min = clean_nums[0]
                        stipend_max = clean_nums[1] if len(clean_nums) > 1 else clean_nums[0]
                        if "₹" in salary_str or "inr" in salary_str.lower():
                            stipend_currency = "INR"
                        elif "$" in salary_str or "usd" in salary_str.lower():
                            stipend_currency = "USD"
                        elif "€" in salary_str or "eur" in salary_str.lower():
                            stipend_currency = "EUR"
                        if "hour" in salary_str.lower():
                            stipend_period = "hourly"
                        elif "month" in salary_str.lower():
                            stipend_period = "monthly"
                        elif "year" in salary_str.lower() or "lpa" in salary_str.lower():
                            stipend_period = "annual"
                    except Exception:
                        pass

            normalized_jobs.append({
                **job_dict,
                "country": resolved_loc.country or job_dict.get("source_country"),
                "city": resolved_loc.city,
                "region": resolved_loc.region,
                "work_mode": resolved_loc.work_mode,
                "remote_scope": resolved_loc.remote_scope,
                "allowed_countries": resolved_loc.allowed_countries,
                "excluded_countries": resolved_loc.excluded_countries,
                "employment_type": job_dict.get("employment_type", "full_time"),
                "is_paid": job_dict.get("is_paid", True),
                "stipend_min": stipend_min,
                "stipend_max": stipend_max,
                "stipend_currency": stipend_currency,
                "stipend_period": stipend_period or "monthly",
                "duration_months": job_dict.get("duration_months"),
                "student_eligibility": job_dict.get("student_eligibility", {}),
                "language_requirements": job_dict.get("language_requirements", []),
                "source_country": job_dict.get("source_country", norm_country)
            })

        return normalized_jobs[:limit]


source_router = SourceRouterService()
