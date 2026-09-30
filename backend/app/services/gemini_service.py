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
                logger.error(f"Error creating genai.Client: {e}")

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
                response_schema=response_schema,
                system_instruction=system_instruction,
                temperature=0.2,
            )
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=config,
            )
            if response.text:
                data = json.loads(response.text)
                return response_schema.model_validate(data)
        except Exception as e:
            logger.error(f"Gemini structured generation failed: {e}", exc_info=True)
        return None

    async def get_embedding(self, text: str) -> List[float]:
        """Get embedding vector using Gemini embeddings"""
        if not self.is_available():
            # Return dummy 768-dim vector for dev testing
            return [0.0] * 768

        try:
            result = self.client.models.embed_content(
                model=self.embedding_model,
                contents=text
            )
            if hasattr(result, "embeddings") and result.embeddings:
                return result.embeddings[0].values
        except Exception as e:
            logger.error(f"Gemini embedding error: {e}")
        return [0.0] * 768


gemini_service = GeminiService()
