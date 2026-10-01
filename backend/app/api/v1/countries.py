from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, status
from app.services.country_registry import country_registry

router = APIRouter(prefix="/countries", tags=["Countries & Localization"])


@router.get("", response_model=List[Dict[str, Any]])
async def list_countries():
    """
    List all configured countries with currencies, cities, and local job sources.
    Used by onboarding selectors, settings, and discovery filters.
    """
    return country_registry.list_countries()


@router.get("/{code}")
async def get_country_details(code: str):
    """
    Get comprehensive localization config for a specific country (e.g. IN, US, GB, DE, CA, SG).
    Returns cities, currency units, local source definitions, internship terms, and timezones.
    """
    cfg = country_registry.get_country(code)
    if not cfg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Country '{code}' is not supported or configured."
        )
    return cfg.model_dump()
