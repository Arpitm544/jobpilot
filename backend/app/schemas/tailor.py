import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class TailorRequest(BaseModel):
    job_match_id: uuid.UUID
    master_profile_id: Optional[uuid.UUID] = None
    custom_instructions: Optional[str] = None


class TailoredResumeResponse(BaseModel):
    id: uuid.UUID
    job_match_id: uuid.UUID
    master_profile_id: uuid.UUID
    tailored_summary: Optional[str]
    tailored_bullets: List[Dict[str, Any]]
    cover_letter: Optional[str]
    custom_question_answers: Dict[str, Any]
    pdf_storage_path: Optional[str]
    claim_verification_passed: bool
    claim_verification_notes: Dict[str, Any]
    ats_keyword_match_pct: float
    created_at: datetime

    model_config = {"from_attributes": True}


class JDParsedOutput(BaseModel):
    """Pydantic schema for Gemini structured JD parsing"""
    role_title: str
    seniority: str
    required_skills: List[str]
    nice_to_have_skills: List[str]
    tech_stack: List[str]
    core_responsibilities: List[str]
    keywords: List[str]


class TailoringVerificationOutput(BaseModel):
    """Pydantic schema for Gemini claim verification pass"""
    all_claims_verified: bool
    verified_points: List[str]
    unsupported_claims: List[str]
    hallucination_detected: bool
    overall_confidence: float
