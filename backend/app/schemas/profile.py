import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, EmailStr, model_validator


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


class ProjectLinks(BaseModel):
    github_repo: Optional[str] = None
    live_demo: Optional[str] = None


class ProjectItem(BaseModel):
    title: str = ""
    role: Optional[str] = None
    description: Optional[str] = None
    tech_stack: List[str] = Field(default_factory=list)
    bullets: List[str] = Field(default_factory=list)
    link: Optional[str] = None
    github_url: Optional[str] = None
    demo_url: Optional[str] = None
    links: Optional[ProjectLinks] = Field(default_factory=ProjectLinks)
    metrics: Optional[str] = None

    @classmethod
    def _normalize_dict_links(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        links = data.get("links")
        gh = data.get("github_url") or data.get("repo_url")
        demo = data.get("demo_url") or data.get("live_url")
        if hasattr(links, "github_repo"):
            gh = gh or links.github_repo
            demo = demo or links.live_demo
        elif isinstance(links, dict):
            gh = gh or links.get("github_repo") or links.get("github") or links.get("repo")
            demo = demo or links.get("live_demo") or links.get("demo") or links.get("live")
        data["github_url"] = gh
        data["demo_url"] = demo
        if not data.get("link"):
            data["link"] = demo or gh
        data["links"] = ProjectLinks(github_repo=gh, live_demo=demo)
        return data

    @model_validator(mode="before")
    @classmethod
    def pre_sync_links(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return cls._normalize_dict_links(dict(data))
        return data

    @model_validator(mode="after")
    def post_sync_links(self) -> "ProjectItem":
        gh = self.github_url or (self.links.github_repo if self.links else None)
        demo = self.demo_url or (self.links.live_demo if self.links else None)
        self.github_url = gh
        self.demo_url = demo
        if not self.links:
            self.links = ProjectLinks(github_repo=gh, live_demo=demo)
        else:
            self.links.github_repo = gh
            self.links.live_demo = demo
        if not self.link:
            self.link = demo or gh
        return self


class EducationItem(BaseModel):
    institution: str = ""
    degree: str = ""
    field_of_study: Optional[str] = None
    start_year: Optional[str] = None
    end_year: Optional[str] = None
    gpa: Optional[str] = None
    grade_type: Optional[str] = "CGPA"
    grade_value: Optional[str] = ""
    secondary_percentage: Optional[str] = None


class CertificationItem(BaseModel):
    name: str = ""
    issuer: str = ""
    date: Optional[str] = None
    url: Optional[str] = None


class AchievementItem(BaseModel):
    title: str = ""
    description: Optional[str] = None
    date: Optional[str] = None
    issuer: Optional[str] = None


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
    achievements: List[AchievementItem] = Field(default_factory=list)
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
    achievements: Optional[List[AchievementItem]] = None
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
    achievements: List[Dict[str, Any]] = Field(default_factory=list)
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
