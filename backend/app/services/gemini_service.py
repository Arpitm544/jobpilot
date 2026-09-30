import asyncio
import json
import logging
from typing import Optional, Type, TypeVar, List
from pydantic import BaseModel
from app.config import settings

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

# Try importing the modern google-genai SDK
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
        self.model = settings.GEMINI_MODEL
        self.embedding_model = settings.GEMINI_EMBEDDING_MODEL
        self.client = _genai_client
        if not self.client and self.api_key:
            try:
                from google import genai
                self.client = genai.Client(api_key=self.api_key)
            except Exception as e:
                logger.warning(f"Could not initialize genai.Client: {e}")

    def is_available(self) -> bool:
        return self.client is not None and bool(self.api_key)

    async def generate_structured(
        self,
        prompt: str,
        response_schema: Type[T],
        system_instruction: Optional[str] = None
    ) -> Optional[T]:
        """Generate structured JSON adhering to a Pydantic schema using Gemini"""
        if not self.is_available():
            logger.warning("Gemini API not configured. Returning None for fallback.")
            return None

        try:
            from google.genai import types
            config = types.GenerateContentConfig(
                response_mime_type="application/json",
                system_instruction=system_instruction,
                temperature=0.2,
            )
            try:
                config.response_schema = response_schema
                response = await asyncio.to_thread(
                    self.client.models.generate_content,
                    model=self.model,
                    contents=prompt,
                    config=config,
                )
            except ValueError as ve:
                if "additionalProperties" in str(ve):
                    config.response_schema = None
                    schema_desc = json.dumps(response_schema.model_json_schema())
                    fallback_prompt = f"{prompt}\n\nRespond with strictly valid JSON matching this schema:\n{schema_desc}"
                    response = await asyncio.to_thread(
                        self.client.models.generate_content,
                        model=self.model,
                        contents=fallback_prompt,
                        config=config,
                    )
                else:
                    raise ve

            if response.text:
                raw_text = response.text.strip()
                if "```json" in raw_text:
                    raw_text = raw_text.split("```json")[1].split("```")[0].strip()
                elif "```" in raw_text:
                    raw_text = raw_text.split("```")[1].split("```")[0].strip()
                data = json.loads(raw_text)
                return response_schema.model_validate(data)
        except Exception as e:
            logger.error(f"Gemini structured generation failed: {e}", exc_info=True)
        return None

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
        return [0.0] * 768


gemini_service = GeminiService()
