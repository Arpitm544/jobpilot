import logging
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

from sqlalchemy.pool import NullPool
from app.config import settings

logger = logging.getLogger(__name__)

# Determine database engine URL
db_url = settings.DATABASE_URL
connect_args = {}
if "sqlite" in db_url:
    connect_args = {"check_same_thread": False}

engine = create_async_engine(
    db_url,
    echo=False,
    future=True,
    poolclass=NullPool,
    connect_args=connect_args
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def seed_demo_user():
    async with AsyncSessionLocal() as session:
        try:
            from sqlalchemy import select
            from app.models.user import User
            from app.models.profile import MasterProfile, QuestionBank
            from app.models.preference import JobPreference
            from app.services.security import hash_password
            import uuid

            res = await session.execute(select(User).where(User.email == "demo@jobpilot.io"))
            if not res.scalar_one_or_none():
                demo_user = User(
                    id=uuid.uuid4(),
                    email="demo@jobpilot.io",
                    hashed_password=hash_password("password123"),
                    full_name="Alex Mercer",
                    role="user",
                    is_active=True,
                )
                session.add(demo_user)
                await session.flush()

                prefs = JobPreference(
                    id=uuid.uuid4(),
                    user_id=demo_user.id,
                    target_roles=["Full-Stack Developer", "Software Engineer", "Backend Developer", "Frontend Developer"],
                    locations=["Remote", "San Francisco", "New York"],
                    apply_mode="review_then_apply",
                    daily_cap=20,
                    min_salary=90000,
                )
                session.add(prefs)

                profile = MasterProfile(
                    id=uuid.uuid4(),
                    user_id=demo_user.id,
                    version_name="Primary Master Profile",
                    is_primary=True,
                    contact_info={
                        "full_name": "Alex Mercer",
                        "email": "demo@jobpilot.io",
                        "phone": "+1 (555) 382-9901",
                        "location": "San Francisco, CA",
                        "linkedin": "https://linkedin.com/in/alexmercer",
                        "github": "https://github.com/alexmercer"
                    },
                    summary="Full-Stack Software Engineer with 4+ years of experience building high-scale distributed systems, microservices, and React/Next.js frontends.",
                    skills={
                        "languages": ["Python", "JavaScript", "TypeScript", "SQL", "HTML", "CSS"],
                        "frameworks": ["FastAPI", "React", "Next.js", "Node.js", "Express", "Tailwind CSS"],
                        "databases": ["PostgreSQL", "Redis", "MongoDB"],
                        "tools": ["Git", "Docker", "Linux", "CI/CD", "AWS"]
                    },
                    experience=[
                        {
                            "company": "CloudScale Inc.",
                            "role": "Senior Software Engineer",
                            "start_date": "2022-06",
                            "end_date": "Present",
                            "bullets": [
                                "Architected distributed backend microservices handling 25k req/sec with FastAPI and Redis.",
                                "Redesigned core web platform using Next.js and Tailwind CSS, improving load speed by 42%.",
                                "Implemented CI/CD pipelines reducing deployment failure rates by 35%."
                            ]
                        }
                    ],
                    projects=[
                        {
                            "title": "JobPilot Automation Engine",
                            "description": "Autonomous job search agent with resume tailoring and ATS form filling.",
                            "technologies": ["Python", "FastAPI", "Playwright", "Next.js"]
                        }
                    ],
                    education=[
                        {
                            "institution": "University of California, Berkeley",
                            "degree": "B.S. in Computer Science",
                            "graduation_year": "2022"
                        }
                    ]
                )
                session.add(profile)

                qb = QuestionBank(
                    id=uuid.uuid4(),
                    user_id=demo_user.id,
                    work_authorization="Authorized to work in US without sponsorship",
                    needs_sponsorship=False,
                    notice_period="Immediate",
                    expected_ctc="$120,000 / year",
                    willing_to_relocate=True,
                    earliest_start_date="Immediate"
                )
                session.add(qb)

                await session.commit()
                logger.info("Demo user seeded successfully (demo@jobpilot.io).")
        except Exception as e:
            logger.warning(f"Could not seed demo user: {e}")


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database initialized successfully.")
    # Remove demo/hardcoded users from production paths
    if settings.ENVIRONMENT != "production" and getattr(settings, "SEED_DEMO_USER", False):
        await seed_demo_user()


