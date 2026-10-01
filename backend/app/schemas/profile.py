import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, EmailStr


class ContactInfo(BaseModel):
    full_name: str = ""
    email: str = ""
    phone: str = ""
    location: str = ""
    linkedin: Optional[str] = None
    github: Optional[str] = None
    portfolio: Optional[str] = None


class SkillCategories(BaseModel):
    languages: List[str] = Field(default_factory=list)
    frameworks: List[str] = Field(default_factory=list)
    databases: List[str] = Field(default_factory=list)
    tools: List[str] = Field(default_factory=list)
    cloud_devops: List[str] = Field(default_factory=list)
    soft_skills: List[str] = Field(default_factory=list)


class ExperienceItem(BaseModel):
    company: str = ""
    role: str = ""
    start_date: str = ""
    end_date: str = ""
    is_current: bool = False
    location: Optional[str] = None
    bullets: List[str] = Field(default_factory=list)


class ProjectItem(BaseModel):
    title: str = ""
    role: Optional[str] = None
    description: Optional[str] = None
    tech_stack: List[str] = Field(default_factory=list)
    bullets: List[str] = Field(default_factory=list)
    link: Optional[str] = None
    metrics: Optional[str] = None


class EducationItem(BaseModel):
    institution: str = ""
    degree: str = ""
    field_of_study: Optional[str] = None
    start_year: Optional[str] = None
    end_year: Optional[str] = None
    gpa: Optional[str] = None


class CertificationItem(BaseModel):
    name: str = ""
    issuer: str = ""
    date: Optional[str] = None
    url: Optional[str] = None


class LinkItem(BaseModel):
    label: str = ""
    url: str = ""


class MasterProfileData(BaseModel):
    contact_info: ContactInfo = Field(default_factory=ContactInfo)
    summary: Optional[str] = ""
    skills: SkillCategories = Field(default_factory=SkillCategories)
    experience: List[ExperienceItem] = Field(default_factory=list)
    projects: List[ProjectItem] = Field(default_factory=list)
    education: List[EducationItem] = Field(default_factory=list)
    certifications: List[CertificationItem] = Field(default_factory=list)
    links: List[LinkItem] = Field(default_factory=list)


class MasterProfileCreate(MasterProfileData):
    version_name: str = "Primary Master Profile"
    is_primary: bool = True
    original_filename: Optional[str] = None
    raw_extracted_text: Optional[str] = None


class MasterProfileUpdate(BaseModel):
    version_name: Optional[str] = None
    is_primary: Optional[bool] = None
    contact_info: Optional[ContactInfo] = None
    summary: Optional[str] = None
    skills: Optional[SkillCategories] = None
    experience: Optional[List[ExperienceItem]] = None
    projects: Optional[List[ProjectItem]] = None
    education: Optional[List[EducationItem]] = None
    certifications: Optional[List[CertificationItem]] = None
    links: Optional[List[LinkItem]] = None


class MasterProfileResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    version_name: str
    is_primary: bool
    contact_info: Dict[str, Any]
    summary: Optional[str]
    skills: Dict[str, Any]
    experience: List[Dict[str, Any]]
    projects: List[Dict[str, Any]]
    education: List[Dict[str, Any]]
    certifications: List[Dict[str, Any]]
    links: List[Dict[str, Any]]
    original_filename: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ResumeParseResponse(BaseModel):
    success: bool
    parsed_profile: MasterProfileData
    raw_text: str
    detected_name: Optional[str] = None
    detected_email: Optional[str] = None
    confidence_score: float = 0.95
    parsing_mode: str = "gemini_ai"  # "gemini_ai" or "heuristic_fallback"


class QuestionBankData(BaseModel):
    work_authorization: Optional[str] = "Authorized to work in country"
    needs_sponsorship: bool = False
    notice_period: Optional[str] = "Immediate"
    expected_ctc: Optional[str] = None
    current_ctc: Optional[str] = None
    willing_to_relocate: bool = True
    earliest_start_date: Optional[str] = "Immediately"
    portfolio_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    diversity_answers: Dict[str, Any] = Field(default_factory=dict)
    custom_answers: Dict[str, Any] = Field(default_factory=dict)


class QuestionBankResponse(QuestionBankData):
    id: uuid.UUID
    user_id: uuid.UUID
    updated_at: datetime

    model_config = {"from_attributes": True}
