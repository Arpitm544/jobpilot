import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class JobBase(BaseModel):
    company_name: str
    title: str
    location: str = "Remote"
    workplace_type: str = "Remote"
    job_type: str = "Full-time"
    salary_range: Optional[str] = None
    jd_text: str
    apply_url: str
    ats_type: str = "generic"


class JobCreate(JobBase):
    source_name: Optional[str] = "manual"
    external_id: Optional[str] = None
    posted_date: Optional[datetime] = None


class JobResponse(JobBase):
    id: uuid.UUID
    source_id: Optional[uuid.UUID]
    external_id: Optional[str]
    jd_parsed_skills: Dict[str, Any]
    is_active: bool
    posted_date: Optional[datetime]
    discovered_at: datetime

    model_config = {"from_attributes": True}


class JobMatchResponse(BaseModel):
    id: uuid.UUID
    job_id: uuid.UUID
    user_id: uuid.UUID
    match_score: float
    embedding_score: float
    skill_overlap_score: float
    matched_skills: List[str]
    missing_skills: List[str]
    match_rationale: Optional[str]
    status: str
    evaluated_at: datetime
    job: JobResponse

    model_config = {"from_attributes": True}
