import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.job import Job
from app.services.location_resolver import location_resolver

async def backfill():
    print("Connecting to DB for backfilling...", flush=True)
    async with AsyncSessionLocal() as session:
        jobs = (await session.execute(select(Job))).scalars().all()
        print(f"Total jobs to normalize: {len(jobs)}", flush=True)

        updated = 0
        for j in jobs:
            loc = location_resolver._try_lookup_resolution(j.location)
            if loc:
                j.country = loc.country
                j.city = loc.city
                j.region = loc.region
                j.work_mode = loc.work_mode
                j.remote_scope = loc.remote_scope
                j.allowed_countries = loc.allowed_countries
                j.excluded_countries = loc.excluded_countries
            else:
                j.work_mode = "remote" if "remote" in (j.location or "").lower() else "onsite"
                j.remote_scope = "unknown"

            t_lower = (j.title or "").lower()
            if any(k in t_lower for k in ["intern", "internship", "trainee", "apprentice"]):
                j.employment_type = "internship"
            else:
                j.employment_type = "full_time"
            updated += 1

        await session.commit()
        print(f"Successfully normalized and backfilled {updated} jobs!", flush=True)

        # Verification sample
        sample = (await session.execute(select(Job).limit(5))).scalars().all()
        for s in sample:
            print(f"- {s.title[:30]} | {s.location[:20]} => country={s.country}, city={s.city}, mode={s.work_mode}, type={s.employment_type}", flush=True)

if __name__ == "__main__":
    asyncio.run(backfill())
