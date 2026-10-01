import uuid
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from pydantic import BaseModel, Field, EmailStr, HttpUrl, field_validator


class Location(BaseModel):
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None


class BasicsLinks(BaseModel):
    linkedin: Optional[str] = None
    github: Optional[str] = None
    portfolio: Optional[str] = None
    leetcode: Optional[str] = None
    codeforces: Optional[str] = None
    kaggle: Optional[str] = None
    other: List[str] = Field(default_factory=list)


class Basics(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[Location] = Field(default_factory=Location)
    headline: Optional[str] = None
    summary: Optional[str] = None
    links: BasicsLinks = Field(default_factory=BasicsLinks)


class EducationItem(BaseModel):
    institution: str
    degree: Optional[str] = None
    field_of_study: Optional[str] = None
    start: Optional[str] = None
    end: Optional[str] = None
    grade_value: Optional[str] = None  # e.g., "8.7", "85%"
    grade_type: Optional[str] = None   # "CGPA", "Percentage", "GPA"
    tenth_percentage: Optional[str] = None
    twelfth_percentage: Optional[str] = None
    raw_date: Optional[str] = None


class ExperienceItem(BaseModel):
    company: str
    title: str
    employment_type: Optional[str] = None  # "full-time", "internship", "contract", "freelance"
    location: Optional[str] = None
    start: Optional[str] = None
    end: Optional[str] = None
    is_current: bool = False
    bullets: List[str] = Field(default_factory=list)
    technologies: List[str] = Field(default_factory=list)
    raw_date: Optional[str] = None


class ProjectLinks(BaseModel):
    github: Optional[str] = None
    live: Optional[str] = None


class ProjectItem(BaseModel):
    name: str
    description: Optional[str] = None
    bullets: List[str] = Field(default_factory=list)
    technologies: List[str] = Field(default_factory=list)
    links: ProjectLinks = Field(default_factory=ProjectLinks)


class SkillsData(BaseModel):
    languages: List[str] = Field(default_factory=list)
    frameworks: List[str] = Field(default_factory=list)
    databases: List[str] = Field(default_factory=list)
    tools: List[str] = Field(default_factory=list)
    cloud: List[str] = Field(default_factory=list)
    concepts: List[str] = Field(default_factory=list)
    soft: List[str] = Field(default_factory=list)


class CertificationItem(BaseModel):
    name: str
    issuer: Optional[str] = None
    date: Optional[str] = None
    credential_url: Optional[str] = None


class AchievementItem(BaseModel):
    text: str
    issuer: Optional[str] = None
    date: Optional[str] = None


class PublicationItem(BaseModel):
    title: str
    publisher: Optional[str] = None
    date: Optional[str] = None
    url: Optional[str] = None
    description: Optional[str] = None


class VolunteeringItem(BaseModel):
    organization: str
    role: Optional[str] = None
    start: Optional[str] = None
    end: Optional[str] = None
    description: Optional[str] = None


class LanguageSpoken(BaseModel):
    language: str
    proficiency: Optional[str] = None  # "Native", "Fluent", "Conversational", "Basic"


class ProfileMeta(BaseModel):
    ocr_used: bool = False
    section_confidence: Dict[str, float] = Field(default_factory=dict)
    detected_experience_level: Optional[str] = None  # "student", "fresher", "junior", "mid", "senior"
    total_experience_months: Optional[int] = None


class MasterProfileSchema(BaseModel):
    """Full structured Master Profile schema as specified in Deliverable 1 & Section 3"""
    basics: Basics = Field(default_factory=Basics)
    education: List[EducationItem] = Field(default_factory=list)
    experience: List[ExperienceItem] = Field(default_factory=list)
    projects: List[ProjectItem] = Field(default_factory=list)
    skills: SkillsData = Field(default_factory=SkillsData)
    certifications: List[CertificationItem] = Field(default_factory=list)
    achievements: List[AchievementItem] = Field(default_factory=list)
    publications: List[PublicationItem] = Field(default_factory=list)
    volunteering: List[VolunteeringItem] = Field(default_factory=list)
    languages_spoken: List[LanguageSpoken] = Field(default_factory=list)
    meta: ProfileMeta = Field(default_factory=ProfileMeta)
