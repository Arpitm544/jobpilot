import uuid
from enum import Enum
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


class ResumeStatus(str, Enum):
    QUEUED = "queued"
    EXTRACTING_TEXT = "extracting_text"
    ANALYZING = "analyzing"
    VALIDATING = "validating"
    READY = "ready"
    FAILED = "failed"


class ResumeUploadResponse(BaseModel):
    resume_id: uuid.UUID
    filename: str
    file_hash: str
    file_size: int
    status: ResumeStatus = ResumeStatus.QUEUED
    message: str = "Resume uploaded successfully. Analysis enqueued."
    is_cached: bool = False


class ResumeStatusResponse(BaseModel):
    id: uuid.UUID
    status: ResumeStatus
    step_message: str
    progress_percent: int
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ResumeDetailResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    filename: str
    file_size: int
    mime_type: str
    file_hash: str
    status: ResumeStatus
    error_message: Optional[str] = None
    ocr_used: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FieldMetaItem(BaseModel):
    field_path: str
    status: str  # "verified" | "unverified" | "missing"
    source_span: Optional[Dict[str, Any]] = None  # e.g. {"start": 0, "end": 10, "text": "..."}
    confidence: float = 1.0


class ResumeParsedResponse(BaseModel):
    resume_id: uuid.UUID
    status: ResumeStatus
    profile: Optional[Dict[str, Any]] = None
    field_meta: List[FieldMetaItem] = Field(default_factory=list)
    needs_attention: List[str] = Field(default_factory=list)
    summary_counts: Dict[str, int] = Field(default_factory=dict)
    raw_text_preview: Optional[str] = None
