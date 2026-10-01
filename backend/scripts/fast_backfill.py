import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select, update
from app.database import AsyncSessionLocal
from app.models.job import Job
from app.services.location_resolver import location_resolver

async def main():
    print("Starting fast chunked backfill...", flush=True)
    async with AsyncSessionLocal() as session:
        jobs = (await session.execute(select(Job))).scalars().all()
        print(f"Total jobs: {len(jobs)}", flush=True)

        batch_size = 50
        for i in range(0, len(jobs), batch_size):
            chunk = jobs[i:i + batch_size]
            for j in chunk:
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

            await session.commit()
            print(f"Committed {min(i + batch_size, len(jobs))}/{len(jobs)} jobs", flush=True)

        print("Backfill complete!", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
