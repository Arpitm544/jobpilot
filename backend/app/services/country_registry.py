import os
import json
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class CurrencyConfig(BaseModel):
    code: str
    symbol: str
    salary_unit_annual: str
    salary_unit_stipend: str
    stipend_period_default: str = "monthly"


class LocalSourceConfig(BaseModel):
    id: str
    name: str
    type: str  # "internship_native", "aggregator", "direct", "startup", "social_board", "ats", "government"
    terms_restricted: bool = False
    description: str = ""


class CountryConfig(BaseModel):
    code: str  # ISO-3166-1 alpha-2, e.g. "IN"
    name: str
    currency: CurrencyConfig
    cities: List[str] = Field(default_factory=list)
    timezones: List[str] = Field(default_factory=list)
    phone_prefix: str = ""
    date_format: str = "YYYY-MM-DD"
    local_sources: List[LocalSourceConfig] = Field(default_factory=list)
    internship_keywords: List[str] = Field(default_factory=list)
    fresher_keywords: List[str] = Field(default_factory=list)
    language_codes: List[str] = Field(default_factory=list)


class CountryRegistryService:
    """
    Config-driven registry for country-specific settings, sources, currencies,
    cities, and localized internship/fresher terminology.
    Zero hardcoded country branches in business logic.
    """

    def __init__(self, search_paths: Optional[List[Path]] = None):
        self._registry: Dict[str, CountryConfig] = {}
        self._city_to_country: Dict[str, Tuple[str, str]] = {}  # lowercase city -> (country_code, canonical_city)

        if not search_paths:
            base_dir = Path(__file__).resolve().parent.parent.parent  # backend/
            repo_dir = base_dir.parent  # repo root
            search_paths = [
                base_dir / "app" / "config" / "countries",
                repo_dir / "config" / "countries",
                Path("/config/countries"),
            ]

        self.search_paths = search_paths
        self.reload()

    def reload(self) -> None:
        """Scan directory and load all JSON country files."""
        self._registry.clear()
        self._city_to_country.clear()

        loaded_files = 0
        for p in self.search_paths:
            if not p.exists() or not p.is_dir():
                continue
            for json_file in p.glob("*.json"):
                iso = json_file.stem.upper()
                if iso in self._registry:
                    continue
                try:
                    with open(json_file, "r", encoding="utf-8") as f:
                        raw = json.load(f)
                    cfg = CountryConfig(**raw)
                    self._registry[cfg.code.upper()] = cfg
                    loaded_files += 1

                    # Index cities for fast geographic resolution
                    for c in cfg.cities:
                        self._city_to_country[c.lower().strip()] = (cfg.code.upper(), c)
                except Exception as e:
                    logger.error(f"Error loading country config {json_file}: {e}")

        logger.info(f"CountryRegistry loaded {len(self._registry)} country definitions ({loaded_files} files parsed).")

    def get_country(self, code: Optional[str]) -> Optional[CountryConfig]:
        """Fetch country config by ISO-3166-1 alpha-2 code."""
        if not code:
            return None
        return self._registry.get(code.strip().upper())

    def list_countries(self) -> List[Dict[str, Any]]:
        """List summary info for all configured countries."""
        res = []
        for code, cfg in sorted(self._registry.items()):
            res.append({
                "code": cfg.code,
                "name": cfg.name,
                "currency": cfg.currency.model_dump(),
                "city_count": len(cfg.cities),
                "primary_timezone": cfg.timezones[0] if cfg.timezones else "UTC",
                "phone_prefix": cfg.phone_prefix,
                "sources_count": len(cfg.local_sources)
            })
        return res

    def get_all_country_codes(self) -> List[str]:
        return list(self._registry.keys())

    def get_cities_for_country(self, code: str) -> List[str]:
        cfg = self.get_country(code)
        return cfg.cities if cfg else []

    def get_sources_for_country(self, code: str) -> List[LocalSourceConfig]:
        cfg = self.get_country(code)
        return cfg.local_sources if cfg else []

    def get_currency_for_country(self, code: str) -> Optional[CurrencyConfig]:
        cfg = self.get_country(code)
        return cfg.currency if cfg else None

    def find_country_by_name(self, name: str) -> Optional[CountryConfig]:
        if not name:
            return None
        target = name.strip().lower()
        for cfg in self._registry.values():
            if cfg.name.lower() == target or cfg.code.lower() == target:
                return cfg
        return None

    def find_country_by_city(self, city: str) -> Optional[Tuple[CountryConfig, str]]:
        """Find country and canonical city name by city string."""
        if not city:
            return None
        key = city.strip().lower()
        match = self._city_to_country.get(key)
        if match:
            country_code, canonical = match
            cfg = self.get_country(country_code)
            if cfg:
                return cfg, canonical
        return None

    def is_valid_country(self, code: str) -> bool:
        return code.strip().upper() in self._registry

    def get_default_country(self) -> CountryConfig:
        return self._registry.get("IN") or next(iter(self._registry.values()))


# Singleton instance
country_registry = CountryRegistryService()
