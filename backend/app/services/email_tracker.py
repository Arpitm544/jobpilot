import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import utc_now
from app.models.job import Job
from app.models.application import Application, ApplicationEvent
from app.services.event_stream import event_stream

logger = logging.getLogger(__name__)


class EmailTrackerService:
    def classify_email_content(self, subject: str, body: str) -> Dict[str, Any]:
        """Classifies inbound email text into candidate application status"""
        text = f"{subject} {body}".lower()

        # 1. Offer Detection
        if any(w in text for w in ["pleased to offer", "offer of employment", "offer letter", "formal offer", "congratulations on your offer"]):
            return {
                "category": "OFFER",
                "new_status": "offer",
                "confidence": 0.95,
                "summary": "Job Offer Received!"
            }

        # 2. Interview Invitation
        if any(w in text for w in [
            "schedule an interview", "invitation to interview", "phone interview",
            "technical screen", "hiring manager conversation", "next steps in our interview process",
            "book a time on my calendar", "interview availability", "take-home assessment"
        ]):
            return {
                "category": "INTERVIEW_INVITE",
                "new_status": "interview",
                "confidence": 0.92,
                "summary": "Interview Request or Technical Screening"
            }

        # 3. Rejection / Not selected
        if any(w in text for w in [
            "decided to pursue other candidates", "pursue other applicants",
            "not moving forward", "will not be moving forward",
            "other candidates whose qualifications", "unsuccessful at this time",
            "unfortunately, we have decided"
        ]):
            return {
                "category": "REJECTION",
                "new_status": "rejected",
                "confidence": 0.90,
                "summary": "Application not moving forward"
            }

        # 4. Confirmation / Receipt
        if any(w in text for w in [
            "thank you for applying", "application received", "received your application",
            "we have received your resume", "application has been submitted"
        ]):
            return {
                "category": "CONFIRMATION",
                "new_status": "applied",
                "confidence": 0.88,
                "summary": "Application confirmation receipt"
            }

        return {
            "category": "GENERAL_UPDATE",
            "new_status": None,
            "confidence": 0.50,
            "summary": "General recruiting correspondence"
        }

    async def process_inbound_email(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        sender: str,
        subject: str,
        body: str
    ) -> Dict[str, Any]:
        """
        Matches email to an application by company name or domain,
        updates status, logs event, and broadcasts live WebSocket update.
        """
        classification = self.classify_email_content(subject, body)
        new_status = classification.get("new_status")

        # Find candidate's applications
        app_res = await db.execute(
            select(Application)
            .options(selectinload(Application.job))
            .where(Application.user_id == user_id)
        )
        applications = app_res.scalars().all()

        matched_app = None
        # Attempt to match by company name in subject/body/sender
        for app in applications:
            if not app.job:
                continue
            company_norm = app.job.company_name.lower().strip()
            if company_norm in subject.lower() or company_norm in body.lower() or company_norm in sender.lower():
                matched_app = app
                break

        # Fallback to the latest active application if not explicitly matched
        if not matched_app and applications:
            for app in applications:
                if app.status in ["applied", "interview", "review_ready"]:
                    matched_app = app
                    break

        if matched_app and new_status and matched_app.status != new_status:
            old_status = matched_app.status
            matched_app.status = new_status
            matched_app.updated_at = utc_now()

            event = ApplicationEvent(
                id=uuid.uuid4(),
                application_id=matched_app.id,
                event_type="EMAIL_STATUS_SYNC",
                message=f"Email sync: status transitioned from '{old_status}' to '{new_status}' ({classification['summary']})",
                event_payload={
                    "sender": sender,
                    "subject": subject,
                    "classification": classification
                },
                created_at=utc_now()
            )
            db.add(event)
            await db.commit()
            await db.refresh(matched_app)

            # Broadcast WebSocket notification
            await event_stream.emit_event(
                user_id=str(user_id),
                event_type="STATUS_CHANGED_VIA_EMAIL",
                message=f"Email update from {matched_app.job.company_name}: status changed to '{new_status.upper()}'!",
                payload={
                    "application_id": str(matched_app.id),
                    "company": matched_app.job.company_name,
                    "old_status": old_status,
                    "new_status": new_status,
                    "summary": classification["summary"]
                }
            )

            return {
                "matched": True,
                "application_id": str(matched_app.id),
                "company": matched_app.job.company_name,
                "old_status": old_status,
                "new_status": new_status,
                "classification": classification
            }

        return {
            "matched": bool(matched_app),
            "application_id": str(matched_app.id) if matched_app else None,
            "company": matched_app.job.company_name if matched_app else None,
            "new_status": new_status,
            "classification": classification,
            "note": "No status transition needed" if matched_app else "No matching application found"
        }


email_tracker = EmailTrackerService()
