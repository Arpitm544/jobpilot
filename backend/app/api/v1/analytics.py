import uuid
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.models.application import Application, ApplicationEvent
from app.api.deps import get_current_user
from app.services.analytics_service import analytics_service
from app.services.email_tracker import email_tracker

router = APIRouter(prefix="/analytics", tags=["Analytics & Email Tracking"])


@router.get("/overview")
async def get_analytics_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns application conversion funnel, daily velocity, and ATS performance metrics"""
    try:
        return await analytics_service.get_dashboard_analytics(db=db, user_id=current_user.id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate analytics: {str(e)}")


class FollowUpRequest(BaseModel):
    follow_up_type: Optional[str] = "7_day"


@router.post("/follow-up-draft/{application_id}")
async def generate_follow_up(
    application_id: uuid.UUID,
    request: FollowUpRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Generates an AI-drafted follow-up email tailored to the application JD & company"""
    try:
        draft = await analytics_service.generate_follow_up_draft(
            db=db,
            user_id=current_user.id,
            application_id=application_id,
            follow_up_type=request.follow_up_type or "7_day"
        )
        return draft
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate follow-up draft: {str(e)}")


class InboundEmailPayload(BaseModel):
    sender: str
    subject: str
    body: str


@router.post("/email-sync")
async def sync_recruiter_email(
    payload: InboundEmailPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Parses recruiter email (invitation, rejection, or receipt)
    and updates application status in the Kanban pipeline.
    """
    try:
        res = await email_tracker.process_inbound_email(
            db=db,
            user_id=current_user.id,
            sender=payload.sender,
            subject=payload.subject,
            body=payload.body
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process email sync: {str(e)}")


@router.get("/audit-log")
async def get_application_audit_log(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 30
):
    """Returns chronological audit log of all application events for compliance & transparency"""
    res = await db.execute(
        select(ApplicationEvent)
        .join(Application, Application.id == ApplicationEvent.application_id)
        .where(Application.user_id == current_user.id)
        .order_by(desc(ApplicationEvent.created_at))
        .limit(limit)
    )
    events = res.scalars().all()
    return [
        {
            "id": str(e.id),
            "application_id": str(e.application_id),
            "event_type": e.event_type,
            "message": e.message,
            "payload": e.event_payload,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in events
    ]
