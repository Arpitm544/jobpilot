import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class JobBase(BaseModel):
    company_name: str
    title: str
    location: str = "Remote"
    workplace_type: str = "Remote" # Legacy field
    job_type: str = "Full-time" # Legacy field
    salary_range: Optional[str] = None
    jd_text: str
    apply_url: str
    ats_type: str = "generic"

    # Country-aware discovery fields
    country: Optional[str] = None
    region: Optional[str] = None
    city: Optional[str] = None
    work_mode: str = "onsite"
    remote_scope: str = "unknown"
    allowed_countries: List[str] = Field(default_factory=list)
    excluded_countries: List[str] = Field(default_factory=list)
    employment_type: str = "full_time"
    is_paid: bool = True
    stipend_min: Optional[float] = None
    stipend_max: Optional[float] = None
    stipend_currency: Optional[str] = None
    stipend_period: Optional[str] = "monthly"
    duration_months: Optional[float] = None
    student_eligibility: Dict[str, Any] = Field(default_factory=dict)
    language_requirements: List[str] = Field(default_factory=list)
    source_country: Optional[str] = None


class JobCreate(JobBase):
    source_name: Optional[str] = "manual"
    external_id: Optional[str] = None
    posted_date: Optional[datetime] = None


class JobResponse(JobBase):
    id: uuid.UUID
    source_id: Optional[uuid.UUID] = None
    external_id: Optional[str] = None
    jd_parsed_skills: Dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True
    posted_date: Optional[datetime] = None
    discovered_at: datetime
    eligibility_verdict: Optional[str] = None # Attached dynamically during ranking/filtering
    is_actively_hiring: bool = True
    days_since_posted: Optional[int] = None
    classification_confidence: Optional[float] = None
    classification_evidence: List[Dict[str, Any]] = Field(default_factory=list)
    is_maybe_internship: bool = False
    experience_level: Optional[str] = None # "fresher", "junior", "mid", "senior", "lead"

    model_config = {"from_attributes": True}


class JobMatchResponse(BaseModel):
    id: uuid.UUID
    job_id: uuid.UUID
    user_id: uuid.UUID
    match_score: float
    embedding_score: float
    skill_overlap_score: float
    matched_skills: List[str] = Field(default_factory=list)
    missing_skills: List[str] = Field(default_factory=list)
    match_rationale: Optional[str] = None
    status: str
    evaluated_at: datetime
    job: JobResponse

    model_config = {"from_attributes": True}


class EligibilityResponse(BaseModel):
    id: Optional[uuid.UUID] = None
    job_id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    verdict: str  # eligible | likely_eligible | unclear | likely_not_eligible | not_eligible
    confidence: float
    reasons: List[str] = Field(default_factory=list)
    evidence: List[Dict[str, Any]] = Field(default_factory=list)
    user_override: Optional[Dict[str, Any]] = None
    evaluated_at: Optional[datetime] = None
    disclaimer: str = "This is a guide based on public information, confirm with the employer if unsure."

    model_config = {"from_attributes": True}


class EligibilityOverrideRequest(BaseModel):
    verdict: str  # eligible | likely_eligible | unclear | likely_not_eligible | not_eligible
    notes: Optional[str] = None
