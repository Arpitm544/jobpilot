import asyncio
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

# Curated list of tech companies on public ATS boards with active public endpoints
DEFAULT_ATS_COMPANIES = {
    "greenhouse": [
        "figma", "stripe", "gitlab"
    ],
    "lever": [
        "spotify"
    ],
    "ashby": [
        "linear", "ramp", "supabase", "sentry"
    ]
}


def compute_dedupe_hash(company: str, title: str, location: str) -> str:
    """Compute normalized SHA-256 deduplication hash across company + title + location"""
    norm_company = re.sub(r"[^a-z0-9]", "", company.lower())
    norm_title = re.sub(r"[^a-z0-9]", "", title.lower())
    norm_loc = re.sub(r"[^a-z0-9]", "", location.lower())
    raw_str = f"{norm_company}|{norm_title}|{norm_loc}"
    return hashlib.sha256(raw_str.encode("utf-8")).hexdigest()


def to_naive_utc(dt: Any) -> datetime:
    """Ensure datetime is a timezone-naive UTC datetime object for Postgres TIMESTAMP WITHOUT TIME ZONE"""
    if not dt or not isinstance(dt, datetime):
        return datetime.now(timezone.utc).replace(tzinfo=None)
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


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
                source_metadata={"ats": name},
                created_at=datetime.now(timezone.utc).replace(tzinfo=None)
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

        # 1. Pre-fetch and ensure sources exist in a single query
        sources_res = await db.execute(select(Source))
        sources_map = {s.name: s for s in sources_res.scalars().all()}
        new_sources = False
        for ats_name in list(companies_map.keys()) + ["manual"]:
            if ats_name not in sources_map:
                s = Source(
                    id=uuid.uuid4(),
                    name=ats_name,
                    source_type="ats_api",
                    is_active=True,
                    source_metadata={"ats": ats_name},
                    created_at=datetime.now(timezone.utc).replace(tzinfo=None)
                )
                db.add(s)
                sources_map[ats_name] = s
                new_sources = True
        if new_sources:
            await db.flush()

        # 2. Get existing applied job IDs
        applied_res = await db.execute(
            select(Application.job_id).where(Application.user_id == user_id)
        )
        applied_job_ids = set(applied_res.scalars().all())

        blacklist_set: Set[str] = {c.lower().strip() for c in (preferences.company_blacklist or [])}
        exclude_kw: List[str] = [kw.lower().strip() for kw in (preferences.exclude_keywords or []) if kw.strip()]
        target_roles: List[str] = [r.lower().strip() for r in (preferences.target_roles or []) if r.strip()]

        # 3. Parallel fetch from all ATS boards with a concurrency limit
        sem = asyncio.Semaphore(10)
        async def _fetch_safe(ats: str, comp: str):
            async with sem:
                try:
                    jobs = await asyncio.wait_for(self.fetch_from_source(ats, comp), timeout=5.0)
                    return ats, jobs
                except Exception as e:
                    logger.warning(f"Error fetching from {ats}/{comp}: {e}")
                    return ats, []

        fetch_tasks = []
        for ats_type, companies in companies_map.items():
            for comp in companies:
                if comp.lower() not in blacklist_set:
                    fetch_tasks.append(_fetch_safe(ats_type, comp))

        fetch_results = await asyncio.gather(*fetch_tasks, return_exceptions=True)

        # 4. In-memory filtering and candidate aggregation
        candidate_items = []
        for res in fetch_results:
            if isinstance(res, Exception) or not isinstance(res, tuple):
                continue
            ats_type, raw_jobs = res
            for raw_job in raw_jobs:
                if raw_job.get("company_name", "").lower() in blacklist_set:
                    continue

                title_lower = (raw_job.get("title") or "").lower()
                jd_lower = (raw_job.get("jd_text") or "").lower()

                if any(ekw in title_lower or ekw in jd_lower[:300] for ekw in exclude_kw):
                    continue

                role_matched = False
                if not target_roles:
                    role_matched = True
                else:
                    for tr in target_roles:
                        keywords = tr.split()
                        if any(kw in title_lower for kw in keywords if len(kw) > 3):
                            role_matched = True
                            break

                if not role_matched and any(w in title_lower for w in ["software", "developer", "frontend", "backend", "full stack", "fullstack", "web", "ai", "machine learning"]):
                    role_matched = True

                if not role_matched:
                    continue

                dedupe_hash = compute_dedupe_hash(
                    company=raw_job["company_name"],
                    title=raw_job["title"],
                    location=raw_job["location"]
                )

                candidate_items.append({
                    "ats_type": ats_type,
                    "dedupe_hash": dedupe_hash,
                    "raw_job": raw_job
                })

        # 5. Single batch query for existing jobs in database
        unique_candidate_hashes = list({item["dedupe_hash"] for item in candidate_items})
        existing_jobs_map: Dict[str, Job] = {}
        if unique_candidate_hashes:
            for i in range(0, len(unique_candidate_hashes), 300):
                chunk = unique_candidate_hashes[i:i+300]
                chunk_res = await db.execute(select(Job).where(Job.dedupe_hash.in_(chunk)))
                for ej in chunk_res.scalars().all():
                    existing_jobs_map[ej.dedupe_hash] = ej

        # 6. Bulk add new jobs and assemble discovered list
        seen_ids = set()
        for item in candidate_items:
            dhash = item["dedupe_hash"]
            if dhash in existing_jobs_map:
                ej = existing_jobs_map[dhash]
                if ej.id not in applied_job_ids and ej.id not in seen_ids:
                    discovered_jobs.append(ej)
                    seen_ids.add(ej.id)
            else:
                raw_job = item["raw_job"]
                src = sources_map.get(item["ats_type"])
                new_job = Job(
                    id=uuid.uuid4(),
                    source_id=src.id if src else None,
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
                    dedupe_hash=dhash,
                    is_active=True,
                    posted_date=to_naive_utc(raw_job.get("posted_date")),
                    discovered_at=datetime.now(timezone.utc).replace(tzinfo=None),
                )
                db.add(new_job)
                existing_jobs_map[dhash] = new_job
                discovered_jobs.append(new_job)
                seen_ids.add(new_job.id)

        await db.commit()
        logger.info(f"Discovery complete. Found {len(discovered_jobs)} matching jobs for user {user_id}")
        return discovered_jobs


discovery_service = DiscoveryService()
