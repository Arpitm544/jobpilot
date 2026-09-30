import hashlib
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Set
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import Job, Source
from app.models.preference import JobPreference
from app.models.application import Application
from app.adapters.greenhouse import GreenhouseAdapter
from app.adapters.lever import LeverAdapter
from app.adapters.ashby import AshbyAdapter

logger = logging.getLogger(__name__)

# Curated list of tech companies on public ATS boards
DEFAULT_ATS_COMPANIES = {
    "greenhouse": [
        "cloudflare", "figma", "stripe", "discord", "gitlab", "databricks", "airbnb", "doordash", "affirm"
    ],
    "lever": [
        "netflix", "atlassian", "palantir", "affirm", "postman"
    ],
    "ashby": [
        "retool", "linear", "ramp", "supabase", "sentry", "cursor", "perplexity"
    ]
}


def compute_dedupe_hash(company: str, title: str, location: str) -> str:
    """Compute normalized SHA-256 deduplication hash across company + title + location"""
    norm_company = re.sub(r"[^a-z0-9]", "", company.lower())
    norm_title = re.sub(r"[^a-z0-9]", "", title.lower())
    norm_loc = re.sub(r"[^a-z0-9]", "", location.lower())
    raw_str = f"{norm_company}|{norm_title}|{norm_loc}"
    return hashlib.sha256(raw_str.encode("utf-8")).hexdigest()


class DiscoveryService:
    def __init__(self):
        self.adapters = {
            "greenhouse": GreenhouseAdapter(),
            "lever": LeverAdapter(),
            "ashby": AshbyAdapter(),
        }

    async def get_or_create_source(self, db: AsyncSession, name: str, source_type: str = "ats_api") -> Source:
        result = await db.execute(select(Source).where(Source.name == name))
        source = result.scalar_one_or_none()
        if not source:
            source = Source(
                id=uuid.uuid4(),
                name=name,
                source_type=source_type,
                is_active=True,
                source_metadata={"ats": name}
            )
            db.add(source)
            await db.flush()
        return source

    async def fetch_from_source(self, ats_type: str, company: str) -> List[Dict[str, Any]]:
        adapter = self.adapters.get(ats_type)
        if not adapter:
            logger.warning(f"No adapter found for ATS type: {ats_type}")
            return []
        try:
            return await adapter.fetch_jobs(company)
        except Exception as e:
            logger.error(f"Error fetching from {ats_type}/{company}: {e}")
            return []

    async def discover_jobs_for_user(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        preferences: JobPreference,
        target_companies: Optional[Dict[str, List[str]]] = None
    ) -> List[Job]:
        """
        Runs discovery across ATS sources filtered by user's preferences,
        deduplicating and saving unique jobs into the database.
        """
        companies_map = target_companies or DEFAULT_ATS_COMPANIES
        discovered_jobs: List[Job] = []

        # Get existing applied job IDs to avoid re-discovering applied roles
        applied_res = await db.execute(
            select(Application.job_id).where(Application.user_id == user_id)
        )
        applied_job_ids = set(applied_res.scalars().all())

        blacklist_set: Set[str] = {c.lower().strip() for c in (preferences.company_blacklist or [])}
        exclude_kw: List[str] = [kw.lower().strip() for kw in (preferences.exclude_keywords or []) if kw.strip()]
        target_roles: List[str] = [r.lower().strip() for r in (preferences.target_roles or []) if r.strip()]

        for ats_type, companies in companies_map.items():
            source = await self.get_or_create_source(db, ats_type)

            for comp in companies:
                if comp.lower() in blacklist_set:
                    logger.info(f"Skipping blacklisted company: {comp}")
                    continue

                raw_jobs = await self.fetch_from_source(ats_type, comp)
                for raw_job in raw_jobs:
                    # 1. Company blacklist filter
                    if raw_job["company_name"].lower() in blacklist_set:
                        continue

                    title_lower = raw_job["title"].lower()
                    jd_lower = raw_job["jd_text"].lower()

                    # 2. Exclude keywords filter (e.g. "Director", "10+ years")
                    if any(ekw in title_lower or ekw in jd_lower[:300] for ekw in exclude_kw):
                        continue

                    # 3. Target roles match (keep software/developer jobs or matching roles)
                    role_matched = False
                    if not target_roles:
                        role_matched = True
                    else:
                        for tr in target_roles:
                            # Fuzzy role keywords: "frontend", "backend", "full-stack", "react", "software", "engineer", "developer"
                            keywords = tr.split()
                            if any(kw in title_lower for kw in keywords if len(kw) > 3):
                                role_matched = True
                                break
                    
                    # Also include any software engineer / developer postings
                    if not role_matched and any(w in title_lower for w in ["software", "developer", "frontend", "backend", "full stack", "fullstack", "web", "ai", "machine learning"]):
                        role_matched = True

                    if not role_matched:
                        continue

                    # 4. Deduplication
                    dedupe_hash = compute_dedupe_hash(
                        company=raw_job["company_name"],
                        title=raw_job["title"],
                        location=raw_job["location"]
                    )

                    # Check if already in DB
                    existing_job_res = await db.execute(select(Job).where(Job.dedupe_hash == dedupe_hash))
                    existing_job = existing_job_res.scalar_one_or_none()

                    if existing_job:
                        if existing_job.id not in applied_job_ids:
                            discovered_jobs.append(existing_job)
                        continue

                    # Create new Job record
                    new_job = Job(
                        id=uuid.uuid4(),
                        source_id=source.id,
                        external_id=raw_job.get("external_id"),
                        company_name=raw_job["company_name"],
                        title=raw_job["title"],
                        location=raw_job["location"],
                        workplace_type=raw_job.get("workplace_type", "Remote"),
                        job_type=raw_job.get("job_type", "Full-time"),
                        salary_range=raw_job.get("salary_range"),
                        jd_text=raw_job["jd_text"],
                        apply_url=raw_job["apply_url"],
                        ats_type=raw_job["ats_type"],
                        dedupe_hash=dedupe_hash,
                        is_active=True,
                        posted_date=raw_job.get("posted_date") or datetime.now(timezone.utc),
                        discovered_at=datetime.now(timezone.utc),
                    )
                    db.add(new_job)
                    discovered_jobs.append(new_job)

        await db.commit()
        logger.info(f"Discovery complete. Found {len(discovered_jobs)} matching jobs for user {user_id}")
        return discovered_jobs


discovery_service = DiscoveryService()
