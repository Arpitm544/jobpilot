import os
import uuid
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from datetime import datetime, timezone

from app.config import settings

logger = logging.getLogger(__name__)


class FormFillerResult:
    def __init__(
        self,
        success: bool,
        is_dry_run: bool = True,
        screenshot_path: Optional[str] = None,
        proof_text: Optional[str] = None,
        error_message: Optional[str] = None,
        requires_user_input: bool = False,
        deep_link: Optional[str] = None,
        filled_fields: Optional[Dict[str, Any]] = None
    ):
        self.success = success
        self.is_dry_run = is_dry_run
        self.screenshot_path = screenshot_path
        self.proof_text = proof_text
        self.error_message = error_message
        self.requires_user_input = requires_user_input
        self.deep_link = deep_link
        self.filled_fields = filled_fields or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "is_dry_run": self.is_dry_run,
            "screenshot_path": self.screenshot_path,
            "proof_text": self.proof_text,
            "error_message": self.error_message,
            "requires_user_input": self.requires_user_input,
            "deep_link": self.deep_link,
            "filled_fields": self.filled_fields,
        }


class BaseFormFiller(ABC):
    def __init__(self):
        self.screenshot_dir = os.path.join(settings.UPLOAD_DIR, "screenshots")
        os.makedirs(self.screenshot_dir, exist_ok=True)

    @abstractmethod
    async def fill_application(
        self,
        apply_url: str,
        resume_pdf_path: str,
        candidate_data: Dict[str, Any],
        cover_letter: Optional[str] = None,
        question_bank: Optional[Dict[str, Any]] = None,
        is_dry_run: bool = True
    ) -> FormFillerResult:
        """Fills application form via Playwright with isolated context"""
        pass
