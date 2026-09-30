import asyncio
import logging
import uuid
from typing import List
from sqlalchemy import select

from app.workers.celery_app import celery_app
from app.database import AsyncSessionLocal
from app.models.user import User
from app.models.preference import JobPreference
from app.models.profile import MasterProfile
from app.services.discovery_service import discovery_service
from app.services.scoring_service import scoring_service

logger = logging.getLogger(__name__)


async def _async_run_scheduled_discovery():
    logger.info("Starting background scheduled job discovery...")
    async with AsyncSessionLocal() as db:
        # Find all active users with primary profiles
        res = await db.execute(
            select(User)
            .join(MasterProfile, MasterProfile.user_id == User.id)
            .where(User.is_active == True, MasterProfile.is_primary == True)
        )
        users = res.scalars().all()
        logger.info(f"Discovered {len(users)} active candidates for automated job matching.")

        for user in users:
            try:
                # Fetch user preferences & profile
                pref_res = await db.execute(select(JobPreference).where(JobPreference.user_id == user.id))
                prefs = pref_res.scalar_one_or_none()
                if not prefs or prefs.kill_switch:
                    continue

                prof_res = await db.execute(
                    select(MasterProfile).where(MasterProfile.user_id == user.id, MasterProfile.is_primary == True)
                )
                profile = prof_res.scalar_one_or_none()
                if not profile:
                    continue

                # Run discovery
                jobs = await discovery_service.discover_jobs_for_user(
                    db=db,
                    user_id=user.id,
                    preferences=prefs
                )

                # Score discovered jobs
                for job in jobs[:15]:
                    await scoring_service.calculate_match(
                        db=db,
                        user_id=user.id,
                        job=job,
                        profile=profile,
                        preferences=prefs
                    )
            except Exception as e:
                logger.error(f"Error in discovery for user {user.id}: {e}", exc_info=True)


@celery_app.task(name="app.workers.discovery_tasks.run_scheduled_discovery")
def run_scheduled_discovery():
    """Celery task entrypoint running async discovery in event loop"""
    loop = asyncio.get_event_loop()
    if loop.is_running():
        loop.create_task(_async_run_scheduled_discovery())
    else:
        asyncio.run(_async_run_scheduled_discovery())
