import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey, Integer, Float, JSON
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.user import GUID, utc_now


class Resume(Base):
    __tablename__ = "resumes"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    storage_path = Column(String(500), nullable=False)
    file_hash = Column(String(64), nullable=False, index=True)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=False)
    status = Column(String(50), default="queued", nullable=False)  # queued, extracting_text, analyzing, validating, ready, failed
    error_message = Column(Text, nullable=True)
    raw_text = Column(Text, nullable=True)
    ocr_used = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    # Relationships
    user = relationship("User", back_populates="resumes")
    master_profiles = relationship(
        "MasterProfile",
        back_populates="resume",
        foreign_keys="MasterProfile.created_from_resume_id"
    )


class ProfileFieldMeta(Base):
    __tablename__ = "profile_field_meta"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    profile_id = Column(GUID(), ForeignKey("master_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    field_path = Column(String(255), nullable=False)  # e.g., "basics.email", "experience[0].company"
    status = Column(String(50), nullable=False, default="verified")  # verified | unverified | missing
    source_span = Column(JSON, nullable=True)  # {"start": int, "end": int, "text": str}
    confidence = Column(Float, default=1.0, nullable=False)

    created_at = Column(DateTime, default=utc_now, nullable=False)

    # Relationship
    master_profile = relationship("MasterProfile", back_populates="field_meta")
