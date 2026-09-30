import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class JDParsedOutput(BaseModel):
    """Pydantic schema for Gemini structured JD parsing"""
    role_title: str
    seniority: str
    required_skills: List[str] = Field(default_factory=list)
    nice_to_have_skills: List[str] = Field(default_factory=list)
    tech_stack: List[str] = Field(default_factory=list)
    core_responsibilities: List[str] = Field(default_factory=list)
    keywords: List[str] = Field(default_factory=list)


class TailoredExperienceItem(BaseModel):
    company: str
    role: str
    start_date: str = ""
    end_date: str = ""
    is_current: bool = False
    location: Optional[str] = None
    bullets: List[str] = Field(default_factory=list)


class TailoredProjectItem(BaseModel):
    title: str
    role: Optional[str] = None
    description: Optional[str] = None
    tech_stack: List[str] = Field(default_factory=list)
    bullets: List[str] = Field(default_factory=list)
    link: Optional[str] = None


class TailoredProfilePayload(BaseModel):
    """Structured output from Gemini Tailoring Pass 1"""
    tailored_summary: str = Field(description="Summary tailored to the target JD without fabricating any claims")
    prioritized_skills: Dict[str, List[str]] = Field(
        default_factory=dict,
        description="Reordered skills prioritizing JD keywords that the user truthfully possesses"
    )
    tailored_experience: List[TailoredExperienceItem] = Field(
        default_factory=list,
        description="Experience with reordered & tailored bullets in Action + Tech + Impact format"
    )
    tailored_projects: List[TailoredProjectItem] = Field(
        default_factory=list,
        description="Most relevant projects selected and ordered for this JD"
    )
    cover_letter: str = Field(description="Short, compelling 3-paragraph tailored cover letter")
    custom_question_answers: Dict[str, str] = Field(
        default_factory=dict,
        description="Answers to common application questions derived strictly from master profile data"
    )
    ats_keywords_mirrored: List[str] = Field(
        default_factory=list,
        description="Keywords from JD successfully incorporated"
    )


class ClaimVerificationPassResult(BaseModel):
    """Pydantic schema for Gemini Claim Verification Pass 2"""
    all_claims_verified: bool = Field(description="True if every claim is grounded in the Master Profile")
    verified_points: List[str] = Field(default_factory=list)
    unsupported_claims: List[str] = Field(
        default_factory=list,
        description="Any fabricated metrics, unmentioned tools, or phantom degrees detected"
    )
    hallucination_detected: bool = False
    audit_notes: str = ""


class BulletDiffItem(BaseModel):
    section: str  # "Summary", "CloudScale Inc.", etc.
    original: str
    tailored: str
    status: str  # "modified", "reordered", "unchanged", "added"


class TailorRequest(BaseModel):
    job_match_id: uuid.UUID
    custom_instructions: Optional[str] = None


class TailorUpdateRequest(BaseModel):
    tailored_summary: Optional[str] = None
    cover_letter: Optional[str] = None
    custom_question_answers: Optional[Dict[str, Any]] = None


class TailoredResumeResponse(BaseModel):
    id: uuid.UUID
    job_match_id: uuid.UUID
    master_profile_id: uuid.UUID
    tailored_summary: Optional[str]
    tailored_profile_json: Dict[str, Any]
    cover_letter: Optional[str]
    custom_question_answers: Dict[str, Any]
    pdf_storage_path: Optional[str]
    pdf_download_url: Optional[str] = None
    claim_verification_passed: bool
    claim_verification_notes: Dict[str, Any]
    ats_keyword_match_pct: float
    diff_summary: List[BulletDiffItem] = []
    created_at: datetime

    model_config = {"from_attributes": True}
