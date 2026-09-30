import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class JobPreferenceBase(BaseModel):
    target_roles: List[str] = Field(default_factory=lambda: ["Full-Stack Developer", "Frontend Developer"])
    experience_level: str = "Junior"  # "Intern", "Fresher", "Junior", "Mid", "Senior"
    locations: List[str] = Field(default_factory=lambda: ["Remote", "Bengaluru", "San Francisco"])
    workplace_type: str = "Any"       # "Remote", "Hybrid", "Onsite", "Any"
    job_type: str = "Full-time"       # "Full-time", "Internship", "Contract"
    min_salary: int = 0
    company_blacklist: List[str] = Field(default_factory=list)
    include_keywords: List[str] = Field(default_factory=list)
    exclude_keywords: List[str] = Field(default_factory=list)
    apply_mode: str = "review_then_apply"  # "review_then_apply", "auto_with_cap", "full_auto"
    daily_cap: int = 20
    match_threshold: int = 70
    kill_switch: bool = False


class JobPreferenceCreate(JobPreferenceBase):
    pass


class JobPreferenceUpdate(BaseModel):
    target_roles: Optional[List[str]] = None
    experience_level: Optional[str] = None
    locations: Optional[List[str]] = None
    workplace_type: Optional[str] = None
    job_type: Optional[str] = None
    min_salary: Optional[int] = None
    company_blacklist: Optional[List[str]] = None
    include_keywords: Optional[List[str]] = None
    exclude_keywords: Optional[List[str]] = None
    apply_mode: Optional[str] = None
    daily_cap: Optional[int] = None
    match_threshold: Optional[int] = None
    kill_switch: Optional[bool] = None


class JobPreferenceResponse(JobPreferenceBase):
    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
