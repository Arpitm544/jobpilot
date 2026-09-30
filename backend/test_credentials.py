import asyncio
import os
import sys

# Ensure backend folder is on PYTHONPATH
sys.path.insert(0, os.path.abspath("backend"))

from app.config import settings
from app.database import engine, init_db, Base
from sqlalchemy import text
from google import genai
import app.models

async def test_all():
    print("==================================================")
    print("      JobPilot Cloud Services Verification        ")
    print("==================================================")
    
    # 1. Neon DB Connection Check
    print("\n[1/4] Connecting to Neon PostgreSQL...")
    try:
        async with engine.connect() as conn:
            res = await conn.execute(text("SELECT current_database(), current_user, version()"))
            row = res.fetchone()
            print("  Status: CONNECTED")
            print(f"  Database Name : {row[0]}")
            print(f"  Database User : {row[1]}")
            print(f"  Version Info  : {row[2][:50]}...")
    except Exception as e:
        print(f"  Connection FAILED: {e}")
        return

    # 2. Table Creation on Neon Cloud DB
    print("\n[2/4] Initializing / Syncing Schema (10 Tables) on Neon DB...")
    try:
        import app.models
        await init_db()
        async with engine.connect() as conn:
            res = await conn.execute(text(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
            ))
            tables = [r[0] for r in res.fetchall()]
            print(f"  Status: SUCCESS ({len(tables)} tables found)")
            print(f"  Tables: {', '.join(tables)}")
    except Exception as e:
        print(f"  Schema sync FAILED: {e}")
        return

    # 3. Gemini API Chat / Generation Check
    print("\n[3/4] Testing Google Gemini API Key...")
    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents="Say 'JobPilot Gemini integration active!' in one sentence."
        )
        print(f"  Model    : {settings.GEMINI_MODEL}")
        print(f"  Response : {response.text.strip()}")
        print("  Status   : GEMINI API KEY IS VALID & ACTIVE")
    except Exception as e:
        print(f"  Gemini API Call FAILED: {e}")
        return

    # 4. Gemini Embeddings Check
    print("\n[4/4] Testing Gemini Embeddings Model...")
    try:
        emb_res = client.models.embed_content(
            model=settings.GEMINI_EMBEDDING_MODEL,
            contents="Full-stack engineer Python FastAPI Next.js Playwright"
        )
        vec = emb_res.embeddings[0].values
        print(f"  Model    : {settings.GEMINI_EMBEDDING_MODEL}")
        print(f"  Vector Dimensions: {len(vec)}")
        print("  Status   : EMBEDDINGS WORKING")
    except Exception as e:
        print(f"  Gemini Embeddings FAILED: {e}")
        return

    print("\n==================================================")
    print("    ALL CREDENTIALS VERIFIED & WORKING 100%!     ")
    print("==================================================")

if __name__ == "__main__":
    asyncio.run(test_all())
