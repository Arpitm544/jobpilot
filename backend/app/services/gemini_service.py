import asyncio
import json
import logging
import re
from typing import Optional, Type, TypeVar, List, Any
from pydantic import BaseModel, ValidationError
from app.config import settings

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

_genai_client = None
try:
    from google import genai
    from google.genai import types
    if settings.GEMINI_API_KEY:
        _genai_client = genai.Client(api_key=settings.GEMINI_API_KEY)
except ImportError:
    logger.warning("google-genai SDK not installed, using fallback mock AI responses.")
except Exception as e:
    logger.warning(f"Failed to initialize google-genai Client: {e}")


class GeminiService:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.model = settings.GEMINI_MODEL or "gemini-2.5-flash"
        self.embedding_model = settings.GEMINI_EMBEDDING_MODEL or "text-embedding-004"
        self.fallback_models = [
            self.model,
            "gemini-3.5-flash-lite",
            "gemini-3.5-flash",
            "gemini-3.1-flash-lite",
            "gemini-2.5-flash-lite",
            "gemini-2.5-flash",
            "gemini-flash-latest",
        ]
        self._model_cooldowns: dict[str, float] = {}
        self.client = _genai_client
        if not self.client and self.api_key:
            try:
                from google import genai
                self.client = genai.Client(api_key=self.api_key)
            except Exception as e:
                logger.warning(f"Could not initialize genai.Client: {e}")

    def is_available(self) -> bool:
        return self.client is not None and bool(self.api_key)

    def get_candidate_models(self) -> List[str]:
        """Returns models ordered by availability, prioritizing those not in quota cooldown."""
        import time
        now = time.time()
        # Clean expired cooldowns
        self._model_cooldowns = {m: exp for m, exp in self._model_cooldowns.items() if exp > now}

        unique_models = []
        for m in self.fallback_models:
            if m and m not in unique_models:
                unique_models.append(m)

        available = [m for m in unique_models if m not in self._model_cooldowns]
        cooling = [m for m in unique_models if m in self._model_cooldowns]
        return available + cooling if available else unique_models

    def mark_quota_exhausted(self, model_name: str, cooldown_seconds: float = 60.0):
        """Places a model in cooldown so subsequent requests don't waste time retrying it."""
        import time
        self._model_cooldowns[model_name] = time.time() + cooldown_seconds
        logger.warning(f"Marking model '{model_name}' as quota-exhausted for {cooldown_seconds:.0f}s cooldown.")

    @staticmethod
    def clean_json_text(raw_text: str) -> str:
        """Strips markdown fences and extra whitespace around JSON output"""
        text = raw_text.strip()
        # Strip ```json ... ``` or ``` ... ```
        if "```" in text:
            # find first { or [
            match = re.search(r"(\{|\[.*)", text, re.DOTALL)
            if match:
                text = match.group(1)
            # trim trailing markdown fence
            if "```" in text:
                text = text.split("```")[0]
        return text.strip()

    async def generate_structured(
        self,
        prompt: str,
        response_schema: Type[T],
        system_instruction: Optional[str] = None,
        max_retries_per_model: int = 2
    ) -> Optional[T]:
        """
        Generate structured JSON adhering to a Pydantic schema using Gemini.
        Tries primary model, with exponential backoff on 503/429, and falls back
        across supported Gemini models.
        """
        if not self.is_available():
            logger.warning("Gemini API not configured. Returning None for fallback.")
            return None

        from google.genai import types

        models_to_try = self.get_candidate_models()
        last_error = None

        for model_name in models_to_try:
            for attempt in range(max_retries_per_model):
                try:
                    logger.info(f"Attempting Gemini generation with model '{model_name}' (attempt {attempt + 1})")
                    config = types.GenerateContentConfig(
                        response_mime_type="application/json",
                        system_instruction=system_instruction,
                        temperature=0.0,
                        max_output_tokens=8192,
                    )
                    
                    try:
                        config.response_schema = response_schema
                        response = await asyncio.to_thread(
                            self.client.models.generate_content,
                            model=model_name,
                            contents=prompt,
                            config=config,
                        )
                    except ValueError as ve:
                        # Handles schemas with unsupported constraints in Gemini
                        if "additionalProperties" in str(ve) or "schema" in str(ve).lower():
                            logger.info(f"Retrying with prompt-based schema for model {model_name}")
                            config.response_schema = None
                            schema_desc = json.dumps(response_schema.model_json_schema(), indent=2)
                            fallback_prompt = (
                                f"{prompt}\n\nCRITICAL: Respond with strictly valid JSON matching this JSON schema:\n{schema_desc}"
                            )
                            response = await asyncio.to_thread(
                                self.client.models.generate_content,
                                model=model_name,
                                contents=fallback_prompt,
                                config=config,
                            )
                        else:
                            raise ve

                    if not response or not response.text:
                        raise ValueError(f"Empty response from Gemini model {model_name}")

                    cleaned = self.clean_json_text(response.text)
                    try:
                        data = json.loads(cleaned)
                    except json.JSONDecodeError as jde:
                        logger.warning(f"JSON decode failed on model {model_name}: {jde}. Retrying with repair prompt...")
                        repair_prompt = f"The following JSON is malformed:\n{cleaned}\n\nFix it and output ONLY valid JSON:"
                        repair_resp = await asyncio.to_thread(
                            self.client.models.generate_content,
                            model=model_name,
                            contents=repair_prompt,
                            config=config,
                        )
                        cleaned_repair = self.clean_json_text(repair_resp.text or "")
                        data = json.loads(cleaned_repair)

                    try:
                        return response_schema.model_validate(data)
                    except ValidationError as val_err:
                        logger.warning(f"Pydantic validation error with {model_name}: {val_err}. Retrying with corrected feedback...")
                        feedback_prompt = (
                            f"{prompt}\n\nYour previous JSON failed schema validation with these errors:\n"
                            f"{str(val_err)[:500]}\n"
                            f"Please correct and output valid JSON matching the schema."
                        )
                        fb_resp = await asyncio.to_thread(
                            self.client.models.generate_content,
                            model=model_name,
                            contents=feedback_prompt,
                            config=config,
                        )
                        cleaned_fb = self.clean_json_text(fb_resp.text or "")
                        fb_data = json.loads(cleaned_fb)
                        return response_schema.model_validate(fb_data)

                except Exception as e:
                    last_error = e
                    err_msg = str(e)
                    is_quota_exhausted = (
                        "429" in err_msg or
                        "RESOURCE_EXHAUSTED" in err_msg or
                        "quota" in err_msg.lower() or
                        "rate limit" in err_msg.lower()
                    )
                    is_not_found = "404" in err_msg or "NOT_FOUND" in err_msg
                    
                    if is_not_found:
                        logger.warning(f"Model '{model_name}' not found or deprecated: {e}. Moving to next fallback model.")
                        break  # move to next model immediately

                    if is_quota_exhausted:
                        self.mark_quota_exhausted(model_name, cooldown_seconds=60.0)
                        logger.warning(f"Quota exhausted on model '{model_name}'. Switching immediately to next fallback model without retrying.")
                        break  # Immediately advance to next fallback model

                    is_transient = "503" in err_msg or "UNAVAILABLE" in err_msg or "500" in err_msg
                    if is_transient and attempt < max_retries_per_model - 1:
                        backoff = (2 ** attempt) * 1.5
                        logger.warning(f"Transient error on model '{model_name}': {e}. Retrying in {backoff:.1f}s...")
                        await asyncio.sleep(backoff)
                        continue
                    else:
                        logger.warning(f"Error on model '{model_name}': {e}. Trying fallback model if available.")
                        break

        logger.error(f"All Gemini models exhausted. Final error: {last_error}", exc_info=True)
        return None

    async def extract_text_via_vision(self, image_bytes_list: List[bytes]) -> str:
        """
        Multimodal OCR fallback: Extracts text from images of scanned pages using Gemini Vision.
        """
        if not self.is_available() or not image_bytes_list:
            return ""

        from google.genai import types

        extracted_pages = []
        for i, img_bytes in enumerate(image_bytes_list):
            for model_name in self.fallback_models:
                try:
                    contents = [
                        types.Part.from_bytes(data=img_bytes, mime_type="image/png"),
                        "Extract all text from this resume page verbatim. Preserve reading order and layout."
                    ]
                    response = await asyncio.to_thread(
                        self.client.models.generate_content,
                        model=model_name,
                        contents=contents,
                    )
                    if response and response.text:
                        extracted_pages.append(response.text.strip())
                        break
                except Exception as e:
                    logger.warning(f"Vision OCR failed for page {i+1} on model {model_name}: {e}")

        return "\n\n".join(extracted_pages)

    async def get_embedding(self, text: str) -> List[float]:
        """Get embedding vector using Gemini embeddings"""
        if not self.is_available():
            return [0.0] * 768

        try:
            result = await asyncio.to_thread(
                self.client.models.embed_content,
                model=self.embedding_model,
                contents=text,
            )
            if hasattr(result, "embedding") and hasattr(result.embedding, "values"):
                return list(result.embedding.values)
            elif hasattr(result, "embeddings") and len(result.embeddings) > 0:
                return list(result.embeddings[0].values)
        except Exception as e:
            logger.error(f"Gemini embedding generation failed: {e}")
    async def generate_text(
        self,
        prompt: str,
        system_instruction: Optional[str] = None
    ) -> Optional[str]:
        """Generate freeform text using Gemini with model fallback and error handling."""
        if not self.is_available():
            return None

        from google.genai import types

        models_to_try = self.get_candidate_models()

        for model_name in models_to_try:
            try:
                config = types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.3,
                    max_output_tokens=2048,
                )
                response = await asyncio.to_thread(
                    self.client.models.generate_content,
                    model=model_name,
                    contents=prompt,
                    config=config,
                )
                if response and response.text:
                    return response.text.strip()
            except Exception as e:
                err_msg = str(e)
                if "429" in err_msg or "RESOURCE_EXHAUSTED" in err_msg or "quota" in err_msg.lower():
                    self.mark_quota_exhausted(model_name, cooldown_seconds=60.0)
                logger.warning(f"generate_text failed with {model_name}: {e}")
                continue
        return None


gemini_service = GeminiService()
