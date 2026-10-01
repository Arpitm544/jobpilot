import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Text, Float, ForeignKey, JSON, Index
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.user import GUID, utc_now


class Source(Base):
    __tablename__ = "sources"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False) # "greenhouse", "lever", "ashby", "internshala", "naukri", etc.
    source_type = Column(String(50), default="ats_api", nullable=False) # "ats_api", "scraper", "rss", "aggregator"
    base_url = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    terms_restricted = Column(Boolean, default=False, nullable=False) # Whether source restricts automation
    source_metadata = Column(JSON, default=dict, nullable=False)

    created_at = Column(DateTime, default=utc_now, nullable=False)

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
    workplace_type = Column(String(50), default="Remote", nullable=False) # Legacy: Remote / Hybrid / Onsite
    job_type = Column(String(50), default="Full-time", nullable=False) # Legacy: Full-time, Internship, etc.
    salary_range = Column(String(100), nullable=True)
    
    # Country-aware discovery fields
    country = Column(String(2), nullable=True, index=True) # ISO-3166-1 alpha-2, e.g. "IN", "US"
    region = Column(String(100), nullable=True) # State / province
    city = Column(String(100), nullable=True, index=True)
    work_mode = Column(String(20), default="onsite", nullable=False, index=True) # "onsite" | "hybrid" | "remote"
    remote_scope = Column(String(30), default="unknown", nullable=False) # "worldwide" | "country_specific" | "region_specific" | "timezone_specific" | "unknown"
    allowed_countries = Column(JSON, default=list, nullable=False) # ["IN", "US"]
    excluded_countries = Column(JSON, default=list, nullable=False) # ["US"]
    employment_type = Column(String(30), default="full_time", nullable=False, index=True) # "internship" | "full_time" | "part_time" | "contract" | "apprenticeship" | "trainee" | "freelance"
    is_paid = Column(Boolean, default=True, nullable=False)
    stipend_min = Column(Float, nullable=True)
    stipend_max = Column(Float, nullable=True)
    stipend_currency = Column(String(10), nullable=True) # "INR", "USD", "EUR"
    stipend_period = Column(String(20), default="monthly", nullable=True) # "monthly", "hourly", "annual", "lump_sum"
    duration_months = Column(Float, nullable=True)
    student_eligibility = Column(JSON, default=dict, nullable=False) # {grad_years: [], currently_enrolled: bool, ppo: bool}
    language_requirements = Column(JSON, default=list, nullable=False) # ["en", "de"]
    source_country = Column(String(2), nullable=True)

    jd_text = Column(Text, nullable=False)
    jd_parsed_skills = Column(JSON, default=dict, nullable=False) # {required: [], nice_to_have: [], stack: []}
    apply_url = Column(String(1024), nullable=False)
    ats_type = Column(String(50), default="generic", nullable=False) # greenhouse, lever, ashby, workable, etc.
    
    # Deduplication hash: sha256(lowercase(company + title + location))
    dedupe_hash = Column(String(64), unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    posted_date = Column(DateTime, nullable=True, index=True)
    discovered_at = Column(DateTime, default=utc_now, nullable=False)

    __table_args__ = (
        Index("ix_jobs_country_emp_mode_posted", "country", "employment_type", "work_mode", "posted_date"),
    )

    # Relationships
    source = relationship("Source", back_populates="jobs")
    matches = relationship("JobMatch", back_populates="job", cascade="all, delete-orphan")
    applications = relationship("Application", back_populates="job", cascade="all, delete-orphan")
    classifications = relationship("JobClassification", back_populates="job", cascade="all, delete-orphan")
    eligibility_results = relationship("EligibilityResult", back_populates="job", cascade="all, delete-orphan")


class JobClassification(Base):
    """Stores structured classification decisions with verbatim evidence quotes"""
    __tablename__ = "job_classifications"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    job_id = Column(GUID(), ForeignKey("jobs.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    employment_type = Column(String(50), nullable=False, index=True) # "internship" | "full_time" | "trainee" | "apprenticeship"
    confidence = Column(Float, default=1.0, nullable=False)
    evidence = Column(JSON, default=list, nullable=False) # [{quote, source_section, reason}]
    classified_at = Column(DateTime, default=utc_now, nullable=False)

    # Relationships
    job = relationship("Job", back_populates="classifications")


class EligibilityResult(Base):
    """Stores evaluated remote eligibility for a user-job pair"""
    __tablename__ = "eligibility_results"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    job_id = Column(GUID(), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    verdict = Column(String(30), nullable=False, index=True) # eligible | likely_eligible | unclear | likely_not_eligible | not_eligible
    confidence = Column(Float, default=1.0, nullable=False)
    reasons = Column(JSON, default=list, nullable=False) # List of human-readable reason strings
    evidence = Column(JSON, default=list, nullable=False) # [{quote, source_url, signal_type}]
    user_override = Column(JSON, nullable=True) # {verdict, notes, overridden_at}
    inputs_hash = Column(String(64), nullable=False, index=True) # hash of user location/citizenship/auth
    evaluated_at = Column(DateTime, default=utc_now, nullable=False)

    __table_args__ = (
        Index("ix_eligibility_job_user", "job_id", "user_id", unique=True),
    )

    # Relationships
    job = relationship("Job", back_populates="eligibility_results")
    user = relationship("User")


class CompanyPolicy(Base):
    """Caches public company remote hiring & sponsorship policy pages for 7-30 days"""
    __tablename__ = "company_policies"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    company_name = Column(String(255), index=True, nullable=False)
    source_url = Column(String(1024), nullable=True)
    extracted_data = Column(JSON, default=dict, nullable=False) # {allowed_countries, sponsorship, eor_hints, quotes}
    fetched_at = Column(DateTime, default=utc_now, nullable=False)
    expires_at = Column(DateTime, nullable=True, index=True)


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
    evaluated_at = Column(DateTime, default=utc_now, nullable=False)

    # Relationships
    job = relationship("Job", back_populates="matches")
    user = relationship("User", back_populates="job_matches")
    tailored_resume = relationship("TailoredResume", back_populates="job_match", uselist=False, cascade="all, delete-orphan")
