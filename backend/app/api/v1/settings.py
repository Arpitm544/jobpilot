from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.profile import MasterProfile, QuestionBank
from app.api.deps import get_current_user
from app.services.country_registry import country_registry
from app.services.location_resolver import location_resolver
from app.schemas.location import (
    LocationSettingsUpdate,
    LocationSettingsResponse,
    ResolveLocationRequest,
    ResolveLocationResponse,
)

router = APIRouter(tags=["Settings & Location"])


@router.get("/settings/location", response_model=LocationSettingsResponse)
async def get_user_location_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns user's home country, preferred cities, citizenship, and remote work authorization.
    Fallback chain:
    1. Explicit User model fields
    2. QuestionBank saved location fields
    3. Master profile resume contact location (auto-geocoded)
    4. Default country (IN)
    """
    home_country = current_user.home_country
    home_city = current_user.home_city
    preferred_cities = current_user.preferred_cities or []
    timezone = current_user.timezone or "Asia/Kolkata"
    citizenship = current_user.citizenship
    work_auth_countries = current_user.work_authorization_countries or []
    needs_sponsorship = current_user.needs_visa_sponsorship or False
    willing_to_relocate = current_user.willing_to_relocate or False
    open_to_intl = current_user.open_to_international or False
    per_country_sources = current_user.per_country_sources or {}

    # Check QuestionBank if User fields are unset
    qb_res = await db.execute(select(QuestionBank).where(QuestionBank.user_id == current_user.id))
    qb = qb_res.scalar_one_or_none()
    if qb:
        if not home_country and qb.home_country:
            home_country = qb.home_country
        if not home_city and qb.home_city:
            home_city = qb.home_city
        if not preferred_cities and qb.preferred_cities:
            preferred_cities = qb.preferred_cities
        if not citizenship and qb.citizenship:
            citizenship = qb.citizenship
        if not work_auth_countries and qb.work_authorization_countries:
            work_auth_countries = qb.work_authorization_countries
        if qb.needs_sponsorship is not None:
            needs_sponsorship = qb.needs_sponsorship
        if qb.willing_to_relocate is not None:
            willing_to_relocate = qb.willing_to_relocate
        if qb.open_to_international is not None:
            open_to_intl = qb.open_to_international

    # Check Master Profile resume location if still unset
    if not home_country or not home_city:
        mp_res = await db.execute(
            select(MasterProfile).where(
                MasterProfile.user_id == current_user.id,
                MasterProfile.is_primary == True
            )
        )
        mp = mp_res.scalar_one_or_none()
        if mp and mp.contact_info:
            loc_str = mp.contact_info.get("location")
            if loc_str:
                resolved = await location_resolver.resolve_location(loc_str)
                if not home_country and resolved.country:
                    home_country = resolved.country
                if not home_city and resolved.city:
                    home_city = resolved.city

    # Final safe default
    home_country = (home_country or "IN").upper()
    country_cfg = country_registry.get_country(home_country) or country_registry.get_default_country()
    country_name = country_cfg.name if country_cfg else "India"

    # Default citizenship & work authorization to home country if empty
    if not citizenship:
        citizenship = home_country
    if not work_auth_countries:
        work_auth_countries = [home_country]

    currency_dict = country_cfg.currency.model_dump() if country_cfg else {}
    available_countries = country_registry.list_countries()

    return LocationSettingsResponse(
        home_country=home_country,
        home_country_name=country_name,
        home_city=home_city,
        preferred_cities=preferred_cities,
        timezone=timezone,
        citizenship=citizenship,
        work_authorization_countries=work_auth_countries,
        needs_visa_sponsorship=needs_sponsorship,
        willing_to_relocate=willing_to_relocate,
        open_to_international=open_to_intl,
        per_country_sources=per_country_sources,
        currency=currency_dict,
        available_countries=available_countries
    )


@router.put("/settings/location", response_model=LocationSettingsResponse)
async def update_user_location_settings(
    body: LocationSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Updates the user's home country, preferred cities, citizenship, and work authorization.
    Automatically synchronizes with QuestionBank and triggers country-aware preferences.
    """
    norm_country = (body.home_country or "IN").strip().upper()
    if not country_registry.is_valid_country(norm_country):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Country '{norm_country}' is not recognized in the registry."
        )

    country_cfg = country_registry.get_country(norm_country)

    # Update User model
    current_user.home_country = norm_country
    current_user.home_city = body.home_city
    current_user.preferred_cities = body.preferred_cities or []
    current_user.timezone = body.timezone or (country_cfg.timezones[0] if country_cfg and country_cfg.timezones else "UTC")
    current_user.citizenship = (body.citizenship or norm_country).strip().upper()
    current_user.work_authorization_countries = [
        c.strip().upper() for c in (body.work_authorization_countries or [norm_country])
    ]
    current_user.needs_visa_sponsorship = bool(body.needs_visa_sponsorship)
    current_user.willing_to_relocate = bool(body.willing_to_relocate)
    current_user.open_to_international = bool(body.open_to_international)
    if body.per_country_sources:
        current_user.per_country_sources = body.per_country_sources

    # Synchronize with QuestionBank
    qb_res = await db.execute(select(QuestionBank).where(QuestionBank.user_id == current_user.id))
    qb = qb_res.scalar_one_or_none()
    if qb:
        qb.home_country = current_user.home_country
        qb.home_city = current_user.home_city
        qb.preferred_cities = current_user.preferred_cities
        qb.citizenship = current_user.citizenship
        qb.work_authorization_countries = current_user.work_authorization_countries
        qb.needs_sponsorship = current_user.needs_visa_sponsorship
        qb.willing_to_relocate = current_user.willing_to_relocate
        qb.open_to_international = current_user.open_to_international

    await db.commit()
    await db.refresh(current_user)

    currency_dict = country_cfg.currency.model_dump() if country_cfg else {}
    available_countries = country_registry.list_countries()

    return LocationSettingsResponse(
        home_country=current_user.home_country,
        home_country_name=country_cfg.name if country_cfg else norm_country,
        home_city=current_user.home_city,
        preferred_cities=current_user.preferred_cities or [],
        timezone=current_user.timezone or "UTC",
        citizenship=current_user.citizenship,
        work_authorization_countries=current_user.work_authorization_countries or [],
        needs_visa_sponsorship=current_user.needs_visa_sponsorship,
        willing_to_relocate=current_user.willing_to_relocate,
        open_to_international=current_user.open_to_international,
        per_country_sources=current_user.per_country_sources or {},
        currency=currency_dict,
        available_countries=available_countries
    )


@router.post("/location/resolve", response_model=ResolveLocationResponse)
async def resolve_arbitrary_location(body: ResolveLocationRequest):
    """
    Test & utility endpoint to geocode/resolve any free-text location string
    into standard country, city, work mode, and remote scope.
    """
    resolved = await location_resolver.resolve_location(body.raw_location)
    return ResolveLocationResponse(
        raw_location=resolved.raw_location,
        country=resolved.country,
        country_name=resolved.country_name,
        region=resolved.region,
        city=resolved.city,
        work_mode=resolved.work_mode,
        remote_scope=resolved.remote_scope,
        allowed_countries=resolved.allowed_countries,
        excluded_countries=resolved.excluded_countries,
        confidence=resolved.confidence,
        resolution_method=resolved.resolution_method
    )
