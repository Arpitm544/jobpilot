import uuid
from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel


class ApplicationEventResponse(BaseModel):
    id: uuid.UUID
    application_id: uuid.UUID
    event_type: str
    message: str
    event_payload: Dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


class ApplicationResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    job_id: uuid.UUID
    tailored_resume_id: Optional[uuid.UUID]
    status: str
    apply_mode_used: str
    is_dry_run: bool
    submission_proof_screenshot: Optional[str]
    submission_proof_text: Optional[str]
    failure_reason: Optional[str]
    retry_count: int
    deep_link_url: Optional[str]
    applied_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    events: Optional[List[ApplicationEventResponse]] = None

    model_config = {"from_attributes": True}


class ApplyActionRequest(BaseModel):
    application_id: uuid.UUID
    action: str  # "approve", "reject", "retry", "dry_run"
