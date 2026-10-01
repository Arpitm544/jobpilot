import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey, JSON, Integer
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.user import GUID, utc_now


class MasterProfile(Base):
    __tablename__ = "master_profiles"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    version_name = Column(String(100), default="Primary Master Profile", nullable=False)
    version = Column(Integer, default=1, nullable=False)
    is_primary = Column(Boolean, default=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_from_resume_id = Column(GUID(), ForeignKey("resumes.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Core JSON structures
    data = Column(JSON, default=dict, nullable=True)  # Full MasterProfileSchema representation
    contact_info = Column(JSON, default=dict, nullable=False)  # {name, email, phone, location, linkedin, github, portfolio}
    summary = Column(Text, nullable=True)
    skills = Column(JSON, default=dict, nullable=False)        # {languages: [], frameworks: [], tools: [], soft_skills: []}
    experience = Column(JSON, default=list, nullable=False)    # [{company, role, start_date, end_date, is_current, location, bullets: []}]
    projects = Column(JSON, default=list, nullable=False)      # [{title, role, description, tech_stack: [], bullets: [], link: ""}]
    education = Column(JSON, default=list, nullable=False)     # [{institution, degree, field_of_study, start_year, end_year, gpa}]
    certifications = Column(JSON, default=list, nullable=False)# [{name, issuer, date, url}]
    links = Column(JSON, default=list, nullable=False)         # [{label, url}]
    
    original_filename = Column(String(255), nullable=True)
    raw_extracted_text = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    # Relationships
    user = relationship("User", back_populates="master_profiles")
    resume = relationship("Resume", back_populates="master_profiles", foreign_keys=[created_from_resume_id])
    field_meta = relationship("ProfileFieldMeta", back_populates="master_profile", cascade="all, delete-orphan")
    tailored_resumes = relationship("TailoredResume", back_populates="master_profile", cascade="all, delete-orphan")


class QuestionBank(Base):
    __tablename__ = "question_banks"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    
    # Common questions
    work_authorization = Column(String(100), default="Authorized to work in country", nullable=True)
    needs_sponsorship = Column(Boolean, default=False, nullable=False)
    notice_period = Column(String(100), default="Immediate", nullable=True)
    expected_ctc = Column(String(100), nullable=True)
    current_ctc = Column(String(100), nullable=True)
    willing_to_relocate = Column(Boolean, default=True, nullable=False)
    earliest_start_date = Column(String(100), default="Immediately", nullable=True)
    
    # URLs and links
    portfolio_url = Column(String(255), nullable=True)
    linkedin_url = Column(String(255), nullable=True)
    github_url = Column(String(255), nullable=True)
    
    # Diversity & custom free-text questions
    diversity_answers = Column(JSON, default=dict, nullable=False)
    custom_answers = Column(JSON, default=dict, nullable=False)  # Key-value store of past answered freeform questions
    
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    # Relationship
    user = relationship("User", back_populates="question_bank")
