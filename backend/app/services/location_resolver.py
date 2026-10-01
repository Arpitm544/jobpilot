import re
import logging
from typing import Optional, List, Dict, Tuple, Any
from pydantic import BaseModel, Field

from app.services.country_registry import country_registry
from app.services.gemini_service import gemini_service

logger = logging.getLogger(__name__)


class ResolvedLocation(BaseModel):
    raw_location: str
    country: Optional[str] = None  # ISO-3166-1 alpha-2, e.g. "IN", "US", "GB", "DE"
    country_name: Optional[str] = None
    region: Optional[str] = None  # State/Province/Region, e.g. "Karnataka", "California"
    city: Optional[str] = None
    work_mode: str = "onsite"  # "onsite" | "hybrid" | "remote"
    remote_scope: str = "unknown"  # "worldwide" | "country_specific" | "region_specific" | "timezone_specific" | "unknown"
    allowed_countries: List[str] = Field(default_factory=list)  # ISO-3166 codes
    excluded_countries: List[str] = Field(default_factory=list)
    confidence: float = 1.0
    resolution_method: str = "lookup"  # "lookup" | "gemini" | "fallback"


class GeminiLocationSchema(BaseModel):
    country_iso: Optional[str] = Field(None, description="2-letter ISO-3166-1 code or null if worldwide or unspecified")
    country_name: Optional[str] = Field(None, description="Canonical country name")
    region: Optional[str] = Field(None, description="State, province or administrative region")
    city: Optional[str] = Field(None, description="Canonical city name")
    work_mode: str = Field("onsite", description="One of: onsite, hybrid, remote")
    remote_scope: str = Field("unknown", description="One of: worldwide, country_specific, region_specific, timezone_specific, unknown")
    allowed_countries: List[str] = Field(default_factory=list, description="List of ISO 2-letter country codes allowed")
    excluded_countries: List[str] = Field(default_factory=list, description="List of ISO 2-letter country codes explicitly excluded")
    confidence: float = Field(0.9, description="Confidence between 0 and 1")


# Comprehensive country names and ISO codes mapping
COUNTRY_ALIASES: Dict[str, Tuple[str, str]] = {
    "india": ("IN", "India"),
    "in": ("IN", "India"),
    "ind": ("IN", "India"),
    "bharat": ("IN", "India"),
    "united states": ("US", "United States"),
    "united states of america": ("US", "United States"),
    "usa": ("US", "United States"),
    "u.s.a.": ("US", "United States"),
    "u.s.": ("US", "United States"),
    "us": ("US", "United States"),
    "united kingdom": ("GB", "United Kingdom"),
    "uk": ("GB", "United Kingdom"),
    "u.k.": ("GB", "United Kingdom"),
    "great britain": ("GB", "United Kingdom"),
    "britain": ("GB", "United Kingdom"),
    "england": ("GB", "United Kingdom"),
    "scotland": ("GB", "United Kingdom"),
    "wales": ("GB", "United Kingdom"),
    "germany": ("DE", "Germany"),
    "deutschland": ("DE", "Germany"),
    "de": ("DE", "Germany"),
    "deu": ("DE", "Germany"),
    "canada": ("CA", "Canada"),
    "ca": ("CA", "Canada"),
    "can": ("CA", "Canada"),
    "singapore": ("SG", "Singapore"),
    "sg": ("SG", "Singapore"),
    "australia": ("AU", "Australia"),
    "au": ("AU", "Australia"),
    "ireland": ("IE", "Ireland"),
    "netherlands": ("NL", "Netherlands"),
    "france": ("FR", "France"),
    "switzerland": ("CH", "Switzerland"),
    "poland": ("PL", "Poland"),
    "japan": ("JP", "Japan"),
    "brazil": ("BR", "Brazil"),
    "nigeria": ("NG", "Nigeria"),
}

# City -> (Canonical City, Region/State, Country ISO, Country Name)
CITY_LOOKUP: Dict[str, Tuple[str, str, str, str]] = {
    # India
    "bengaluru": ("Bengaluru", "Karnataka", "IN", "India"),
    "bangalore": ("Bengaluru", "Karnataka", "IN", "India"),
    "pune": ("Pune", "Maharashtra", "IN", "India"),
    "hyderabad": ("Hyderabad", "Telangana", "IN", "India"),
    "mumbai": ("Mumbai", "Maharashtra", "IN", "India"),
    "delhi": ("Delhi", "Delhi", "IN", "India"),
    "new delhi": ("New Delhi", "Delhi", "IN", "India"),
    "delhi-ncr": ("Delhi-NCR", "Delhi", "IN", "India"),
    "delhi ncr": ("Delhi-NCR", "Delhi", "IN", "India"),
    "gurgaon": ("Gurgaon", "Haryana", "IN", "India"),
    "gurugram": ("Gurgaon", "Haryana", "IN", "India"),
    "noida": ("Noida", "Uttar Pradesh", "IN", "India"),
    "greater noida": ("Greater Noida", "Uttar Pradesh", "IN", "India"),
    "chennai": ("Chennai", "Tamil Nadu", "IN", "India"),
    "madras": ("Chennai", "Tamil Nadu", "IN", "India"),
    "kolkata": ("Kolkata", "West Bengal", "IN", "India"),
    "calcutta": ("Kolkata", "West Bengal", "IN", "India"),
    "ahmedabad": ("Ahmedabad", "Gujarat", "IN", "India"),
    "kochi": ("Kochi", "Kerala", "IN", "India"),
    "cochin": ("Kochi", "Kerala", "IN", "India"),
    "trivandrum": ("Thiruvananthapuram", "Kerala", "IN", "India"),
    "thiruvananthapuram": ("Thiruvananthapuram", "Kerala", "IN", "India"),
    "jaipur": ("Jaipur", "Rajasthan", "IN", "India"),
    "chandigarh": ("Chandigarh", "Punjab", "IN", "India"),
    "indore": ("Indore", "Madhya Pradesh", "IN", "India"),
    "coimbatore": ("Coimbatore", "Tamil Nadu", "IN", "India"),
    "nagpur": ("Nagpur", "Maharashtra", "IN", "India"),
    "mysuru": ("Mysuru", "Karnataka", "IN", "India"),
    "mysore": ("Mysuru", "Karnataka", "IN", "India"),

    # United States
    "san francisco": ("San Francisco", "California", "US", "United States"),
    "sf": ("San Francisco", "California", "US", "United States"),
    "new york": ("New York", "New York", "US", "United States"),
    "new york city": ("New York", "New York", "US", "United States"),
    "nyc": ("New York", "New York", "US", "United States"),
    "seattle": ("Seattle", "Washington", "US", "United States"),
    "austin": ("Austin", "Texas", "US", "United States"),
    "boston": ("Boston", "Massachusetts", "US", "United States"),
    "los angeles": ("Los Angeles", "California", "US", "United States"),
    "la": ("Los Angeles", "California", "US", "United States"),
    "chicago": ("Chicago", "Illinois", "US", "United States"),
    "denver": ("Denver", "Colorado", "US", "United States"),
    "atlanta": ("Atlanta", "Georgia", "US", "United States"),
    "san jose": ("San Jose", "California", "US", "United States"),
    "sunnyvale": ("Sunnyvale", "California", "US", "United States"),
    "mountain view": ("Mountain View", "California", "US", "United States"),
    "palo alto": ("Palo Alto", "California", "US", "United States"),
    "san diego": ("San Diego", "California", "US", "United States"),
    "redmond": ("Redmond", "Washington", "US", "United States"),
    "dallas": ("Dallas", "Texas", "US", "United States"),
    "houston": ("Houston", "Texas", "US", "United States"),
    "portland": ("Portland", "Oregon", "US", "United States"),
    "washington dc": ("Washington", "District of Columbia", "US", "United States"),
    "washington, dc": ("Washington", "District of Columbia", "US", "United States"),

    # United Kingdom
    "london": ("London", "Greater London", "GB", "United Kingdom"),
    "manchester": ("Manchester", "Greater Manchester", "GB", "United Kingdom"),
    "birmingham": ("Birmingham", "West Midlands", "GB", "United Kingdom"),
    "edinburgh": ("Edinburgh", "Scotland", "GB", "United Kingdom"),
    "cambridge": ("Cambridge", "Cambridgeshire", "GB", "United Kingdom"),
    "oxford": ("Oxford", "Oxfordshire", "GB", "United Kingdom"),
    "bristol": ("Bristol", "Bristol", "GB", "United Kingdom"),
    "leeds": ("Leeds", "West Yorkshire", "GB", "United Kingdom"),
    "glasgow": ("Glasgow", "Scotland", "GB", "United Kingdom"),

    # Germany
    "berlin": ("Berlin", "Berlin", "DE", "Germany"),
    "munich": ("Munich", "Bavaria", "DE", "Germany"),
    "münchen": ("Munich", "Bavaria", "DE", "Germany"),
    "frankfurt": ("Frankfurt", "Hesse", "DE", "Germany"),
    "frankfurt am main": ("Frankfurt", "Hesse", "DE", "Germany"),
    "hamburg": ("Hamburg", "Hamburg", "DE", "Germany"),
    "cologne": ("Cologne", "North Rhine-Westphalia", "DE", "Germany"),
    "köln": ("Cologne", "North Rhine-Westphalia", "DE", "Germany"),
    "stuttgart": ("Stuttgart", "Baden-Württemberg", "DE", "Germany"),
    "düsseldorf": ("Düsseldorf", "North Rhine-Westphalia", "DE", "Germany"),
    "dusseldorf": ("Düsseldorf", "North Rhine-Westphalia", "DE", "Germany"),

    # Canada
    "toronto": ("Toronto", "Ontario", "CA", "Canada"),
    "vancouver": ("Vancouver", "British Columbia", "CA", "Canada"),
    "montreal": ("Montreal", "Quebec", "CA", "Canada"),
    "ottawa": ("Ottawa", "Ontario", "CA", "Canada"),
    "calgary": ("Calgary", "Alberta", "CA", "Canada"),
    "waterloo": ("Waterloo", "Ontario", "CA", "Canada"),
    "edmonton": ("Edmonton", "Alberta", "CA", "Canada"),

    # Singapore
    "singapore": ("Singapore", "Singapore", "SG", "Singapore"),
}

# State abbreviations
STATE_ABBR_TO_REGION = {
    # India
    "ka": ("Karnataka", "IN", "India"),
    "mh": ("Maharashtra", "IN", "India"),
    "ts": ("Telangana", "IN", "India"),
    "tg": ("Telangana", "IN", "India"),
    "dl": ("Delhi", "IN", "India"),
    "hr": ("Haryana", "IN", "India"),
    "up": ("Uttar Pradesh", "IN", "India"),
    "tn": ("Tamil Nadu", "IN", "India"),
    "wb": ("West Bengal", "IN", "India"),
    "gj": ("Gujarat", "IN", "India"),
    "kl": ("Kerala", "IN", "India"),
    "rj": ("Rajasthan", "IN", "India"),
    "pb": ("Punjab", "IN", "India"),
    "mp": ("Madhya Pradesh", "IN", "India"),

    # US
    "ca": ("California", "US", "United States"),
    "ny": ("New York", "US", "United States"),
    "wa": ("Washington", "US", "United States"),
    "tx": ("Texas", "US", "United States"),
    "ma": ("Massachusetts", "US", "United States"),
    "il": ("Illinois", "US", "United States"),
    "co": ("Colorado", "US", "United States"),
    "ga": ("Georgia", "US", "United States"),
    "or": ("Oregon", "US", "United States"),
    "va": ("Virginia", "US", "United States"),
    "nc": ("North Carolina", "US", "United States"),
    "fl": ("Florida", "US", "United States"),

    # Canada
    "on": ("Ontario", "CA", "Canada"),
    "bc": ("British Columbia", "CA", "Canada"),
    "qc": ("Quebec", "CA", "Canada"),
    "ab": ("Alberta", "CA", "Canada"),
}


class LocationResolverService:
    """
    Parses and geocodes free-text locations into standardized countries,
    cities, work modes, and remote eligibility scopes.
    Uses multi-stage resolution:
    1. Deterministic fast rule & lookup table matching
    2. Gemini structured LLM fallback for ambiguous text
    3. Safe default fallback (never assumes source website country)
    """

    def __init__(self):
        self._cache: Dict[str, ResolvedLocation] = {}

    def _normalize_key(self, text: str) -> str:
        return re.sub(r"\s+", " ", text or "").strip().lower()

    async def resolve_location(self, raw_location: Optional[str]) -> ResolvedLocation:
        """Main entry point to resolve any free-text location."""
        if not raw_location or not raw_location.strip():
            return ResolvedLocation(
                raw_location="",
                work_mode="onsite",
                remote_scope="unknown",
                confidence=0.5,
                resolution_method="fallback"
            )

        norm_key = self._normalize_key(raw_location)
        if norm_key in self._cache:
            return self._cache[norm_key]

        # Stage 1: Fast deterministic lookup
        resolved = self._try_lookup_resolution(raw_location)
        if resolved and resolved.confidence >= 0.85:
            self._cache[norm_key] = resolved
            return resolved

        # Stage 2: Gemini structured fallback for ambiguous/unresolved strings
        if gemini_service.is_available():
            try:
                gemini_res = await self._resolve_with_gemini(raw_location)
                if gemini_res:
                    self._cache[norm_key] = gemini_res
                    return gemini_res
            except Exception as e:
                logger.warning(f"Gemini location resolution failed for '{raw_location}': {e}")

        # Stage 3: Return the best effort lookup or unknown fallback
        fallback = resolved or ResolvedLocation(
            raw_location=raw_location,
            work_mode="remote" if "remote" in norm_key else "onsite",
            remote_scope="unknown",
            confidence=0.5,
            resolution_method="fallback"
        )
        self._cache[norm_key] = fallback
        return fallback

    def _try_lookup_resolution(self, raw: str) -> Optional[ResolvedLocation]:
        norm = self._normalize_key(raw)

        # 1. Determine Work Mode
        is_hybrid = bool(re.search(r"\bhybrid\b", norm))
        is_remote = bool(re.search(r"\b(remote|wfh|telecommute|anywhere|virtual)\b", norm))

        work_mode = "onsite"
        if is_hybrid:
            work_mode = "hybrid"
        elif is_remote:
            work_mode = "remote"

        # 2. Determine Remote Scope & Allowed Countries
        remote_scope = "unknown"
        allowed_countries: List[str] = []
        excluded_countries: List[str] = []

        # Check worldwide signals
        if re.search(r"\b(worldwide|anywhere|global|work from anywhere|wfa|any country)\b", norm):
            remote_scope = "worldwide"
        # Check specific region signals
        elif re.search(r"\b(apac|asia pacific)\b", norm):
            remote_scope = "region_specific"
        elif re.search(r"\b(emea|europe|eu only|european union)\b", norm):
            remote_scope = "region_specific"
        elif re.search(r"\b(latam|latin america)\b", norm):
            remote_scope = "region_specific"
        elif re.search(r"\b(na|north america)\b", norm):
            remote_scope = "region_specific"
        # Check timezone signals
        elif re.search(r"\b(est|pst|cst|mst|cet|ist|gmt|utc|timezone|overlap)\b", norm) and "remote" in norm:
            remote_scope = "timezone_specific"

        # Check country-specific remote restrictions: "Remote (US only)", "Remote - India", etc.
        for alias, (iso, cname) in COUNTRY_ALIASES.items():
            pattern = rf"\b(remote\s*[-–(]?\s*{alias}|{alias}\s*only|only\s*{alias}|{alias}\s*remote)\b"
            if re.search(pattern, norm):
                remote_scope = "country_specific"
                if iso not in allowed_countries:
                    allowed_countries.append(iso)

        # 3. Detect Cities, Regions, and Countries in Text
        detected_city: Optional[str] = None
        detected_region: Optional[str] = None
        detected_country_iso: Optional[str] = None
        detected_country_name: Optional[str] = None

        # Clean string for token matching: split by comma, hyphen, slash, parens
        tokens = [t.strip() for t in re.split(r"[,/()\-–|]", norm) if t.strip()]

        # Direct token city matching
        for token in tokens:
            if token in CITY_LOOKUP:
                canonical_city, reg, iso, cname = CITY_LOOKUP[token]
                detected_city = canonical_city
                detected_region = reg
                detected_country_iso = iso
                detected_country_name = cname
                break

        # Substring city matching if direct token didn't hit
        if not detected_city:
            for city_key, (canonical_city, reg, iso, cname) in CITY_LOOKUP.items():
                if re.search(rf"\b{city_key}\b", norm):
                    detected_city = canonical_city
                    detected_region = reg
                    detected_country_iso = iso
                    detected_country_name = cname
                    break

        # Match State abbreviation (e.g. "Bengaluru, KA" or "San Francisco, CA")
        for token in tokens:
            if token in STATE_ABBR_TO_REGION:
                st_name, iso, cname = STATE_ABBR_TO_REGION[token]
                if not detected_region:
                    detected_region = st_name
                if not detected_country_iso:
                    detected_country_iso = iso
                    detected_country_name = cname

        # Match Country alias directly
        for token in tokens:
            if token in COUNTRY_ALIASES:
                iso, cname = COUNTRY_ALIASES[token]
                if not detected_country_iso:
                    detected_country_iso = iso
                    detected_country_name = cname

        # If country found in text and not worldwide/region, mark allowed_countries
        if detected_country_iso:
            if detected_country_iso not in allowed_countries and remote_scope == "country_specific":
                allowed_countries.append(detected_country_iso)
        elif allowed_countries and not detected_country_iso:
            detected_country_iso = allowed_countries[0]
            cfg = country_registry.get_country(detected_country_iso)
            if cfg:
                detected_country_name = cfg.name

        # Confidence calculation
        confidence = 0.5
        if detected_country_iso and (detected_city or remote_scope != "unknown"):
            confidence = 0.95
        elif detected_country_iso:
            confidence = 0.85
        elif remote_scope in ("worldwide", "region_specific", "timezone_specific"):
            confidence = 0.90
        elif is_remote and remote_scope == "unknown":
            confidence = 0.85

        return ResolvedLocation(
            raw_location=raw,
            country=detected_country_iso,
            country_name=detected_country_name,
            region=detected_region,
            city=detected_city,
            work_mode=work_mode,
            remote_scope=remote_scope,
            allowed_countries=allowed_countries,
            excluded_countries=excluded_countries,
            confidence=confidence,
            resolution_method="lookup"
        )

    async def _resolve_with_gemini(self, raw_location: str) -> Optional[ResolvedLocation]:
        """Gemini fallback for ambiguous/unresolved locations."""
        prompt = f"""
You are a precise geographic and employment location resolver for an ATS.
Analyze the following free-text job location and extract standard geographic fields:
"{raw_location}"

Rules:
1. "work_mode": "remote", "hybrid", or "onsite".
2. "remote_scope":
   - "worldwide" if anywhere/global/worldwide without restrictions.
   - "country_specific" if limited to specific countries (e.g. US only, India only).
   - "region_specific" if limited to a region (e.g. APAC, EMEA, LATAM, EU).
   - "timezone_specific" if limited to specific timezones or hours overlap (e.g. PST, EST, CET).
   - "unknown" if remote is mentioned without stated geography.
3. "country_iso": Standard 2-letter ISO-3166-1 alpha-2 code (e.g. "IN", "US", "GB", "DE", "CA", "SG").
4. "city": Canonical city name or null.
5. "region": State/Province or null.
6. "allowed_countries": List of 2-letter ISO country codes allowed to apply.
7. NEVER guess or invent a country if none is stated or implied by city.
"""
        parsed: Optional[GeminiLocationSchema] = await gemini_service.generate_structured(
            prompt=prompt,
            response_schema=GeminiLocationSchema,
            system_instruction="You are an expert location resolver returning structured JSON.",
            max_retries_per_model=2
        )

        if not parsed:
            return None

        country_iso = (parsed.country_iso or "").strip().upper() if parsed.country_iso else None
        if country_iso and len(country_iso) != 2:
            country_iso = None

        allowed = [c.strip().upper() for c in (parsed.allowed_countries or []) if len(c.strip()) == 2]

        return ResolvedLocation(
            raw_location=raw_location,
            country=country_iso,
            country_name=parsed.country_name,
            region=parsed.region,
            city=parsed.city,
            work_mode=parsed.work_mode if parsed.work_mode in ("onsite", "hybrid", "remote") else "onsite",
            remote_scope=parsed.remote_scope if parsed.remote_scope in ("worldwide", "country_specific", "region_specific", "timezone_specific", "unknown") else "unknown",
            allowed_countries=allowed,
            excluded_countries=[c.strip().upper() for c in (parsed.excluded_countries or []) if len(c.strip()) == 2],
            confidence=max(0.7, min(1.0, parsed.confidence or 0.85)),
            resolution_method="gemini"
        )


# Singleton instance
location_resolver = LocationResolverService()
