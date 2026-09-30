import asyncio
import logging
import uuid
from typing import List, Dict, Any

from app.workers.apply_tasks import async_apply_job, async_batch_apply, run_auto_apply_job, run_batch_apply_jobs
from app.config import settings

logger = logging.getLogger(__name__)


class TaskRunner:
    def __init__(self):
        self.celery_available = None

    def is_celery_connected(self) -> bool:
        if self.celery_available is not None:
            return self.celery_available
        try:
            import redis
            r = redis.Redis.from_url(settings.REDIS_URL, socket_timeout=1)
            r.ping()
            self.celery_available = True
            logger.info("Celery/Redis broker is reachable.")
        except Exception:
            self.celery_available = False
            logger.info("Celery/Redis broker not reachable; running tasks in FastAPI background worker pool.")
        return self.celery_available

    def dispatch_apply_job(
        self,
        user_id: uuid.UUID,
        match_id: uuid.UUID,
        is_dry_run: bool = True
    ):
        """Dispatches job apply task to Celery or async background task"""
        if self.is_celery_connected():
            try:
                task = run_auto_apply_job.delay(str(user_id), str(match_id), is_dry_run)
                return {"mode": "celery", "task_id": task.id}
            except Exception as e:
                logger.warning(f"Failed to dispatch to Celery, falling back to asyncio: {e}")

        # Asyncio background fallback
        asyncio.create_task(async_apply_job(user_id=user_id, match_id=match_id, is_dry_run=is_dry_run))
        return {"mode": "asyncio", "task_id": str(uuid.uuid4())}

    def dispatch_batch_apply(
        self,
        user_id: uuid.UUID,
        match_ids: List[uuid.UUID],
        is_dry_run: bool = True
    ):
        """Dispatches batch apply task"""
        if self.is_celery_connected():
            try:
                task = run_batch_apply_jobs.delay(str(user_id), [str(m) for m in match_ids], is_dry_run)
                return {"mode": "celery", "task_id": task.id}
            except Exception as e:
                logger.warning(f"Failed to dispatch batch to Celery: {e}")

        asyncio.create_task(async_batch_apply(user_id=user_id, match_ids=match_ids, is_dry_run=is_dry_run))
        return {"mode": "asyncio", "task_id": str(uuid.uuid4())}


task_runner = TaskRunner()
