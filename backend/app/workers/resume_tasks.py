import asyncio
import logging
import uuid
from typing import Optional
from sqlalchemy import select, delete

from app.workers.celery_app import celery_app
from app.database import AsyncSessionLocal
from app.models.resume import Resume, ProfileFieldMeta
from app.models.profile import MasterProfile
from app.services.storage_service import storage_service
from app.services.resume_parser import resume_parser_service
from app.services.resume_verifier import resume_verifier

logger = logging.getLogger(__name__)


async def async_process_resume(resume_id_str: str):
    """
    Executes the resume processing pipeline through state machine stages:
    queued -> extracting_text -> analyzing -> validating -> ready | failed
    Persists parsed profile and field metadata into database.
    """
    try:
        resume_uuid = uuid.UUID(resume_id_str)
    except ValueError:
        logger.error(f"Invalid resume UUID: {resume_id_str}")
        return

    async with AsyncSessionLocal() as session:
        # Fetch resume
        result = await session.execute(select(Resume).where(Resume.id == resume_uuid))
        resume = result.scalar_one_or_none()
        if not resume:
            logger.error(f"Resume {resume_id_str} not found in database.")
            return

        try:
            # 1. State: extracting_text
            resume.status = "extracting_text"
            await session.commit()
            logger.info(f"Resume {resume_id_str}: extracting_text")

            content = storage_service.get_resume_bytes(resume.storage_path)
            if not content:
                raise ValueError("Could not read resume file from storage.")

            parsed_data, raw_text, extracted_links, ocr_used, parsing_mode = await resume_parser_service.parse_resume_file(
                file_bytes=content,
                filename=resume.filename
            )
            resume.raw_text = raw_text
            resume.ocr_used = ocr_used

            # 2. State: analyzing
            resume.status = "analyzing"
            await session.commit()
            logger.info(f"Resume {resume_id_str}: analyzing (mode: {parsing_mode})")
            await asyncio.sleep(0.3)

            # 3. State: validating & deterministic verification
            resume.status = "validating"
            await session.commit()
            logger.info(f"Resume {resume_id_str}: validating with zero-hallucination verifier")

            verified_profile, field_metas, summary_counts = resume_verifier.verify_profile(
                profile=parsed_data,
                raw_text=raw_text,
                extracted_links=extracted_links
            )

            # 4. Persistence into MasterProfile & ProfileFieldMeta
            mp_res = await session.execute(
                select(MasterProfile).where(
                    MasterProfile.user_id == resume.user_id,
                    MasterProfile.is_primary == True
                )
            )
            profile = mp_res.scalar_one_or_none()

            prof_dict = verified_profile.model_dump()

            if not profile:
                profile = MasterProfile(
                    id=uuid.uuid4(),
                    user_id=resume.user_id,
                    version_name="Primary Master Profile",
                    version=1,
                    is_primary=True,
                    is_active=True,
                    created_from_resume_id=resume.id,
                    contact_info=prof_dict.get("contact_info", {}),
                    summary=prof_dict.get("summary", ""),
                    skills=prof_dict.get("skills", {}),
                    experience=prof_dict.get("experience", []),
                    projects=prof_dict.get("projects", []),
                    education=prof_dict.get("education", []),
                    certifications=prof_dict.get("certifications", []),
                    links=prof_dict.get("links", []),
                    data=prof_dict,
                    original_filename=resume.filename,
                    raw_extracted_text=raw_text
                )
                session.add(profile)
                await session.flush()
            else:
                profile.created_from_resume_id = resume.id
                profile.contact_info = prof_dict.get("contact_info", {})
                profile.summary = prof_dict.get("summary", "")
                profile.skills = prof_dict.get("skills", {})
                profile.experience = prof_dict.get("experience", [])
                profile.projects = prof_dict.get("projects", [])
                profile.education = prof_dict.get("education", [])
                profile.certifications = prof_dict.get("certifications", [])
                profile.links = prof_dict.get("links", [])
                profile.data = prof_dict
                profile.original_filename = resume.filename
                profile.raw_extracted_text = raw_text

            # Persist ProfileFieldMeta rows
            await session.execute(
                delete(ProfileFieldMeta).where(ProfileFieldMeta.profile_id == profile.id)
            )
            for fm_data in field_metas:
                meta_row = ProfileFieldMeta(
                    id=uuid.uuid4(),
                    profile_id=profile.id,
                    field_path=fm_data["field_path"],
                    status=fm_data["status"],
                    confidence=fm_data["confidence"],
                    source_span=fm_data.get("source_span")
                )
                session.add(meta_row)

            # 5. State: ready
            resume.status = "ready"
            resume.error_message = None
            await session.commit()
            logger.info(
                f"Resume {resume_id_str}: marked as ready successfully. "
                f"Verified {summary_counts.get('verified', 0)} fields."
            )

        except Exception as e:
            logger.error(f"Error processing resume {resume_id_str}: {e}", exc_info=True)
            resume.status = "failed"
            resume.error_message = str(e) or "An unexpected error occurred while parsing the resume."
            await session.commit()


@celery_app.task(name="app.workers.resume_tasks.process_resume_parsing", bind=True, max_retries=2)
def process_resume_parsing(self, resume_id: str):
    """Celery task entry point to process a resume"""
    logger.info(f"Celery task process_resume_parsing started for {resume_id}")
    try:
        asyncio.run(async_process_resume(resume_id))
    except Exception as exc:
        logger.error(f"Celery task failed for {resume_id}: {exc}")
        raise exc


def dispatch_resume_parsing(resume_id: str):
    """
    Dispatches the resume parsing task to Celery if broker is reachable.
    Instantly falls back to a background daemon thread if Redis/Celery broker is unavailable.
    """
    from app.config import settings
    import socket
    from urllib.parse import urlparse

    redis_available = False
    try:
        redis_url = getattr(settings, "REDIS_URL", "redis://localhost:6379/0")
        parsed = urlparse(redis_url)
        host = parsed.hostname or "127.0.0.1"
        port = parsed.port or 6379
        with socket.create_connection((host, port), timeout=0.5):
            redis_available = True
    except Exception as e:
        logger.debug(f"Redis probe failed ({e}); will use background worker thread.")
        redis_available = False

    if redis_available:
        try:
            # Check if Celery has any active worker before enqueueing to Redis
            from app.workers.celery_app import celery_app
            insp = celery_app.control.inspect(timeout=0.5)
            active_workers = insp.ping() if insp else None
            if active_workers:
                process_resume_parsing.delay(resume_id)
                logger.info(f"Dispatched resume parsing for {resume_id} to active Celery worker.")
                return
            else:
                logger.info("Redis is up but no active Celery workers found. Executing in background thread.")
        except Exception as e:
            logger.warning(f"Failed to dispatch to Celery worker: {e}. Falling back to background thread.")

    # Background thread fallback ensures parsing runs reliably in dev or offline environments
    import threading
    def run_worker_thread():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(async_process_resume(resume_id))
        except Exception as err:
            logger.error(f"Error in background worker thread for resume {resume_id}: {err}", exc_info=True)
        finally:
            loop.close()

    thread = threading.Thread(target=run_worker_thread, daemon=True)
    thread.start()
    logger.info(f"Dispatched resume parsing for {resume_id} to background worker thread.")
