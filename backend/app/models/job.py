import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Text, Float, ForeignKey, JSON
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.user import GUID


class Source(Base):
    __tablename__ = "sources"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False) # "greenhouse", "lever", "ashby", "workable", "linkedin"
    source_type = Column(String(50), default="ats_api", nullable=False) # "ats_api", "scraper", "rss"
    base_url = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    source_metadata = Column(JSON, default=dict, nullable=False)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    jobs = relationship("Job", back_populates="source", cascade="all, delete-orphan")


class Job(Base):
    __tablename__ = "jobs"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    source_id = Column(GUID(), ForeignKey("sources.id", ondelete="SET NULL"), nullable=True)
    external_id = Column(String(255), nullable=True, index=True)
    company_name = Column(String(255), nullable=False, index=True)
    title = Column(String(255), nullable=False, index=True)
    location = Column(String(255), default="Remote", nullable=False)
    workplace_type = Column(String(50), default="Remote", nullable=False) # Remote / Hybrid / Onsite
    job_type = Column(String(50), default="Full-time", nullable=False)
    salary_range = Column(String(100), nullable=True)
    
    jd_text = Column(Text, nullable=False)
    jd_parsed_skills = Column(JSON, default=dict, nullable=False) # {required: [], nice_to_have: [], stack: []}
    apply_url = Column(String(1024), nullable=False)
    ats_type = Column(String(50), default="generic", nullable=False) # greenhouse, lever, ashby, workable, etc.
    
    # Deduplication hash: sha256(lowercase(company + title + location))
    dedupe_hash = Column(String(64), unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    posted_date = Column(DateTime, nullable=True)
    discovered_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    source = relationship("Source", back_populates="jobs")
    matches = relationship("JobMatch", back_populates="job", cascade="all, delete-orphan")
    applications = relationship("Application", back_populates="job", cascade="all, delete-orphan")


class JobMatch(Base):
    __tablename__ = "job_matches"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    job_id = Column(GUID(), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    match_score = Column(Float, default=0.0, nullable=False)        # 0.0 to 100.0
    embedding_score = Column(Float, default=0.0, nullable=False)    # 0.0 to 1.0
    skill_overlap_score = Column(Float, default=0.0, nullable=False)# 0.0 to 1.0
    
    matched_skills = Column(JSON, default=list, nullable=False)
    missing_skills = Column(JSON, default=list, nullable=False)
    match_rationale = Column(Text, nullable=True)
    
    # Status in the candidate funnel: "discovered", "queued", "tailoring", "tailored", "dismissed", "applied"
    status = Column(String(50), default="discovered", nullable=False, index=True)
    evaluated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    job = relationship("Job", back_populates="matches")
    user = relationship("User", back_populates="job_matches")
    tailored_resume = relationship("TailoredResume", back_populates="job_match", uselist=False, cascade="all, delete-orphan")
