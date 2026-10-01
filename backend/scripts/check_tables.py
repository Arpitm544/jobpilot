import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text
from app.database import AsyncSessionLocal

async def main():
    async with AsyncSessionLocal() as s:
        res = await s.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"))
        tables = [row[0] for row in res.fetchall()]
        print("Existing tables:", tables, flush=True)

        col_res = await s.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='jobs' ORDER BY column_name"))
        cols = [row[0] for row in col_res.fetchall()]
        print("Jobs columns count:", len(cols), flush=True)
        print("Has country:", 'country' in cols, flush=True)
        print("Has remote_scope:", 'remote_scope' in cols, flush=True)

if __name__ == "__main__":
    asyncio.run(main())
