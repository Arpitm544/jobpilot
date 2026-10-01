from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class LocationSettingsUpdate(BaseModel):
    home_country: Optional[str] = Field("IN", description="2-letter ISO-3166-1 alpha-2 code")
    home_city: Optional[str] = None
    preferred_cities: Optional[List[str]] = Field(default_factory=list)
    timezone: Optional[str] = Field("Asia/Kolkata", description="IANA timezone name, e.g. Asia/Kolkata")
    citizenship: Optional[str] = Field(None, description="2-letter ISO-3166-1 alpha-2 code")
    work_authorization_countries: Optional[List[str]] = Field(default_factory=list)
    needs_visa_sponsorship: Optional[bool] = False
    willing_to_relocate: Optional[bool] = False
    open_to_international: Optional[bool] = False
    per_country_sources: Optional[Dict[str, List[str]]] = Field(default_factory=dict)


class LocationSettingsResponse(BaseModel):
    home_country: str = "IN"
    home_country_name: str = "India"
    home_city: Optional[str] = None
    preferred_cities: List[str] = Field(default_factory=list)
    timezone: str = "Asia/Kolkata"
    citizenship: Optional[str] = None
    work_authorization_countries: List[str] = Field(default_factory=list)
    needs_visa_sponsorship: bool = False
    willing_to_relocate: bool = False
    open_to_international: bool = False
    per_country_sources: Dict[str, List[str]] = Field(default_factory=dict)
    currency: Dict[str, Any] = Field(default_factory=dict)
    available_countries: List[Dict[str, Any]] = Field(default_factory=list)


class ResolveLocationRequest(BaseModel):
    raw_location: str


class ResolveLocationResponse(BaseModel):
    raw_location: str
    country: Optional[str] = None
    country_name: Optional[str] = None
    region: Optional[str] = None
    city: Optional[str] = None
    work_mode: str = "onsite"
    remote_scope: str = "unknown"
    allowed_countries: List[str] = Field(default_factory=list)
    excluded_countries: List[str] = Field(default_factory=list)
    confidence: float = 1.0
    resolution_method: str = "lookup"
