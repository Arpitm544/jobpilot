import asyncio
import os
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy import text, select
from app.database import AsyncSessionLocal
from app.models.job import Job
from app.services.location_resolver import location_resolver

DDL_STATEMENTS = [
    # jobs table additions
    "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS country VARCHAR(2);",
    "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS region VARCHAR(100);",
    "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS city VARCHAR(100);",
    "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS work_mode VARCHAR(20) DEFAULT 'onsite';",
    "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS remote_scope VARCHAR(30) DEFAULT 'unknown';",
    "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS allowed_countries JSONB DEFAULT '[]'::jsonb;",
    "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS excluded_countries JSONB DEFAULT '[]'::jsonb;",
    "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS employment_type VARCHAR(30) DEFAULT 'full_time';",
    "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT TRUE;",
    "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS stipend_min FLOAT;",
    "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS stipend_max FLOAT;",
    "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS stipend_currency VARCHAR(10);",
    "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS stipend_period VARCHAR(20) DEFAULT 'monthly';",
    "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS duration_months FLOAT;",
    "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS student_eligibility JSONB DEFAULT '{}'::jsonb;",
    "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS language_requirements JSONB DEFAULT '[]'::jsonb;",
    "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS source_country VARCHAR(2);",
    "CREATE INDEX IF NOT EXISTS ix_jobs_country ON jobs (country);",
    "CREATE INDEX IF NOT EXISTS ix_jobs_city ON jobs (city);",
    "CREATE INDEX IF NOT EXISTS ix_jobs_work_mode ON jobs (work_mode);",
    "CREATE INDEX IF NOT EXISTS ix_jobs_employment_type ON jobs (employment_type);",
    "CREATE INDEX IF NOT EXISTS ix_jobs_country_emp_mode_posted ON jobs (country, employment_type, work_mode, posted_date);",

    # job_classifications table
    """
    CREATE TABLE IF NOT EXISTS job_classifications (
        id CHAR(36) PRIMARY KEY,
        job_id CHAR(36) REFERENCES jobs(id) ON DELETE CASCADE UNIQUE NOT NULL,
        employment_type VARCHAR(50) NOT NULL,
        confidence FLOAT DEFAULT 1.0 NOT NULL,
        evidence JSONB DEFAULT '[]'::jsonb NOT NULL,
        classified_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
    );
    """,
    "CREATE INDEX IF NOT EXISTS ix_job_classifications_job_id ON job_classifications (job_id);",
    "CREATE INDEX IF NOT EXISTS ix_job_classifications_emp_type ON job_classifications (employment_type);",

    # eligibility_results table
    """
    CREATE TABLE IF NOT EXISTS eligibility_results (
        id CHAR(36) PRIMARY KEY,
        job_id CHAR(36) REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
        user_id CHAR(36) REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        verdict VARCHAR(30) NOT NULL,
        confidence FLOAT DEFAULT 1.0 NOT NULL,
        reasons JSONB DEFAULT '[]'::jsonb NOT NULL,
        evidence JSONB DEFAULT '[]'::jsonb NOT NULL,
        user_override JSONB,
        inputs_hash VARCHAR(64) NOT NULL,
        evaluated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
    );
    """,
    "CREATE INDEX IF NOT EXISTS ix_eligibility_job_id ON eligibility_results (job_id);",
    "CREATE INDEX IF NOT EXISTS ix_eligibility_user_id ON eligibility_results (user_id);",
    "CREATE INDEX IF NOT EXISTS ix_eligibility_verdict ON eligibility_results (verdict);",
    "CREATE INDEX IF NOT EXISTS ix_eligibility_inputs_hash ON eligibility_results (inputs_hash);",
    "CREATE UNIQUE INDEX IF NOT EXISTS ix_eligibility_job_user ON eligibility_results (job_id, user_id);",

    # company_policies table
    """
    CREATE TABLE IF NOT EXISTS company_policies (
        id CHAR(36) PRIMARY KEY,
        company_name VARCHAR(255) NOT NULL,
        source_url VARCHAR(1024),
        extracted_data JSONB DEFAULT '{}'::jsonb NOT NULL,
        fetched_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
        expires_at TIMESTAMP WITHOUT TIME ZONE
    );
    """,
    "CREATE INDEX IF NOT EXISTS ix_company_policies_company_name ON company_policies (company_name);",
    "CREATE INDEX IF NOT EXISTS ix_company_policies_expires_at ON company_policies (expires_at);"
]

async def run_migration():
    print("Executing DDL migrations...")
    async with AsyncSessionLocal() as session:
        for stmt in DDL_STATEMENTS:
            cleaned = stmt.strip()
            if cleaned:
                await session.execute(text(cleaned))
        await session.commit()
        print("DDL migrations successfully applied.")

        # Fast deterministic backfill without external API calls
        jobs = (await session.execute(select(Job))).scalars().all()
        print(f"Normalizing {len(jobs)} existing jobs...")
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
        print(f"Successfully normalized and backfilled {updated} jobs!")

if __name__ == "__main__":
    asyncio.run(run_migration())
