import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Text, Float, Integer, ForeignKey, JSON
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.user import GUID


class TailoredResume(Base):
    __tablename__ = "tailored_resumes"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    job_match_id = Column(GUID(), ForeignKey("job_matches.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    master_profile_id = Column(GUID(), ForeignKey("master_profiles.id", ondelete="CASCADE"), nullable=False, index=True)

    tailored_profile_json = Column(JSON, default=dict, nullable=False) # The filtered & emphasized profile
    tailored_summary = Column(Text, nullable=True)
    tailored_bullets = Column(JSON, default=list, nullable=False)      # Modified bullets with action + tech + impact
    cover_letter = Column(Text, nullable=True)
    custom_question_answers = Column(JSON, default=dict, nullable=False)
    
    pdf_storage_path = Column(String(512), nullable=True)
    claim_verification_passed = Column(Boolean, default=False, nullable=False)
    claim_verification_notes = Column(JSON, default=dict, nullable=False)
    ats_keyword_match_pct = Column(Float, default=0.0, nullable=False)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    job_match = relationship("JobMatch", back_populates="tailored_resume")
    master_profile = relationship("MasterProfile", back_populates="tailored_resumes")
    application = relationship("Application", back_populates="tailored_resume", uselist=False)


class Application(Base):
    __tablename__ = "applications"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    job_id = Column(GUID(), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    tailored_resume_id = Column(GUID(), ForeignKey("tailored_resumes.id", ondelete="SET NULL"), nullable=True)

    # Funnel status:
    # "queued", "tailoring", "tailored", "review_ready", "applying", "applied", "viewed", "interview", "offer", "rejected", "failed", "requires_user_input"
    status = Column(String(50), default="queued", nullable=False, index=True)
    apply_mode_used = Column(String(50), default="review_then_apply", nullable=False)
    is_dry_run = Column(Boolean, default=False, nullable=False)
    
    submission_proof_screenshot = Column(String(512), nullable=True)
    submission_proof_text = Column(Text, nullable=True)
    failure_reason = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0, nullable=False)
    deep_link_url = Column(String(1024), nullable=True) # Deep link if CAPTCHA or user intervention is required
    
    applied_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User", back_populates="applications")
    job = relationship("Job", back_populates="applications")
    tailored_resume = relationship("TailoredResume", back_populates="application")
    events = relationship("ApplicationEvent", back_populates="application", cascade="all, delete-orphan")


class ApplicationEvent(Base):
    __tablename__ = "application_events"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    application_id = Column(GUID(), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(100), nullable=False) # "STATUS_CHANGED", "AI_TAILORED", "FORM_FILLED", "SUBMITTED", "INTERVENTION_REQUIRED", "ERROR"
    message = Column(Text, nullable=False)
    event_payload = Column(JSON, default=dict, nullable=False)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationship
    application = relationship("Application", back_populates="events")
