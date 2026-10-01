import os
import io
import re
import hashlib
import zipfile
import logging
from typing import Tuple, Optional
from app.config import settings

logger = logging.getLogger(__name__)

# Constants
MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024  # 5 Megabytes limit


class StorageValidationError(Exception):
    """Raised when file validation (size, MIME, signature) fails"""
    pass


class StorageService:
    def __init__(self, base_upload_dir: Optional[str] = None):
        self.base_dir = base_upload_dir or settings.UPLOAD_DIR
        self.resumes_dir = os.path.join(self.base_dir, "resumes")
        os.makedirs(self.resumes_dir, exist_ok=True)

    def compute_sha256(self, content: bytes) -> str:
        """Computes SHA-256 hex digest of file bytes"""
        return hashlib.sha256(content).hexdigest()

    def validate_file(self, content: bytes, original_filename: str) -> Tuple[str, str]:
        """
        Validates:
        1. File size <= 5 MB
        2. File signature (magic bytes) + MIME type matching PDF, DOCX, or plain text
        
        Returns: (detected_mime, detected_extension)
        Raises: StorageValidationError with a user-friendly message
        """
        if not content or len(content) == 0:
            raise StorageValidationError("The uploaded file is empty.")

        if len(content) > MAX_RESUME_SIZE_BYTES:
            max_mb = MAX_RESUME_SIZE_BYTES / (1024 * 1024)
            actual_mb = len(content) / (1024 * 1024)
            raise StorageValidationError(
                f"File size ({actual_mb:.1f} MB) exceeds maximum allowed limit of {max_mb:.0f} MB."
            )

        # 1. PDF Check
        if content.startswith(b"%PDF-"):
            return "application/pdf", ".pdf"

        # 2. DOCX Check (Zip archive with word/document.xml)
        if content.startswith(b"PK\x03\x04"):
            try:
                with zipfile.ZipFile(io.BytesIO(content)) as zf:
                    namelist = zf.namelist()
                    if any("word/document.xml" in name for name in namelist):
                        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"
            except Exception:
                pass
            raise StorageValidationError("The ZIP/DOCX file is corrupted or not a valid Microsoft Word document.")

        # 3. Plain text / UTF-8 Check
        # Ensure it has .txt extension and valid UTF-8 without binary null bytes
        ext = os.path.splitext(original_filename.lower())[1]
        if ext in [".txt", ".text"]:
            if b"\x00" not in content[:1024]:
                try:
                    content.decode("utf-8")
                    return "text/plain", ".txt"
                except UnicodeDecodeError:
                    pass

        # Check for legacy DOC (OLE file)
        if content.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"):
            raise StorageValidationError(
                "Legacy .doc format is not directly supported. Please save or export your resume as .pdf or .docx and re-upload."
            )

        # Unsupported or spoofed file signature
        raise StorageValidationError(
            "Invalid file format or signature. Only valid PDF and DOCX documents (up to 5 MB) are supported."
        )

    def sanitize_filename(self, filename: str) -> str:
        """Sanitizes filename against path traversal attacks"""
        # Strip directories
        clean = os.path.basename(filename)
        # Remove suspicious chars
        clean = re.sub(r"[^\w\.-]", "_", clean)
        return clean or "resume.pdf"

    def store_resume(self, user_id: str, content: bytes, original_filename: str) -> Tuple[str, str]:
        """
        Stores the resume file securely.
        Returns: (storage_path, file_hash)
        """
        file_hash = self.compute_sha256(content)
        sanitized = self.sanitize_filename(original_filename)
        
        user_dir = os.path.join(self.resumes_dir, str(user_id))
        os.makedirs(user_dir, exist_ok=True)
        
        # Unique safe filename: <hash_prefix>_<sanitized>
        safe_name = f"{file_hash[:16]}_{sanitized}"
        full_path = os.path.join(user_dir, safe_name)
        
        # Write to disk
        with open(full_path, "wb") as f:
            f.write(content)
            
        return full_path, file_hash

    def get_resume_bytes(self, storage_path: str) -> Optional[bytes]:
        """Reads file bytes from disk if exists, resolving across working directories"""
        if not storage_path:
            return None
            
        candidates = [
            storage_path,
            os.path.abspath(storage_path),
            os.path.join(os.getcwd(), storage_path),
            os.path.join(os.getcwd(), "backend", storage_path.lstrip("./\\")),
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), storage_path.lstrip("./\\")),
        ]
        for p in candidates:
            if os.path.exists(p) and os.path.isfile(p):
                with open(p, "rb") as f:
                    return f.read()
        return None

    def delete_resume(self, storage_path: str) -> bool:
        """Deletes physical file from disk"""
        try:
            if os.path.exists(storage_path):
                os.remove(storage_path)
                return True
        except Exception as e:
            logger.error(f"Failed to delete resume at {storage_path}: {e}")
        return False


storage_service = StorageService()
