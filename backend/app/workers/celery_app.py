import os
from celery import Celery
from celery.schedules import crontab
from app.config import settings

celery_app = Celery(
    "jobpilot_worker",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.workers.discovery_tasks",
        "app.workers.apply_tasks",
    ]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,  # 5 minutes max per task
)

# Celery Beat Schedule: Run discovery every 3 hours
celery_app.conf.beat_schedule = {
    "run-periodic-job-discovery": {
        "task": "app.workers.discovery_tasks.run_scheduled_discovery",
        "schedule": crontab(minute=0, hour="*/3"),
    },
}
