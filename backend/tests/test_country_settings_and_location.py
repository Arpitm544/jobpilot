import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import AsyncSessionLocal
from app.models.user import User
from app.services.auth_service import create_access_token
from app.services.country_registry import country_registry
from app.services.location_resolver import location_resolver


def test_country_registry_definitions():
    """Verify configured countries in registry."""
    codes = country_registry.get_all_country_codes()
    assert "IN" in codes
    assert "US" in codes
    assert "GB" in codes
    assert "DE" in codes
    assert "CA" in codes

    # Test India config
    india = country_registry.get_country("IN")
    assert india is not None
    assert india.name == "India"
    assert india.currency.code == "INR"
    assert india.currency.symbol == "₹"
    assert india.currency.salary_unit_annual == "LPA"
    assert "Bengaluru" in india.cities
    assert "internshala" in [s.id for s in india.local_sources]

    # Test Germany config
    germany = country_registry.get_country("DE")
    assert germany is not None
    assert "werkstudent" in [k.lower() for k in germany.internship_keywords]
    assert "praktikum" in [k.lower() for k in germany.internship_keywords]

    # Test city lookup
    lookup = country_registry.find_country_by_city("Pune")
    assert lookup is not None
    cfg, canon_city = lookup
    assert cfg.code == "IN"
    assert canon_city == "Pune"


@pytest.mark.asyncio
async def test_location_resolver_geocoding():
    """Verify deterministic geocoding of various free-text locations."""
    # 1. Indian Tech Hub
    res1 = await location_resolver.resolve_location("Bengaluru, KA")
    assert res1.country == "IN"
    assert res1.city == "Bengaluru"
    assert res1.region == "Karnataka"
    assert res1.work_mode == "onsite"

    # 2. Hybrid role in Pune
    res2 = await location_resolver.resolve_location("Hybrid, Pune")
    assert res2.country == "IN"
    assert res2.city == "Pune"
    assert res2.work_mode == "hybrid"

    # 3. US Tech Hub
    res3 = await location_resolver.resolve_location("San Francisco, CA")
    assert res3.country == "US"
    assert res3.city == "San Francisco"
    assert res3.region == "California"

    # 4. UK Role
    res4 = await location_resolver.resolve_location("London, UK")
    assert res4.country == "GB"
    assert res4.city == "London"

    # 5. German Role
    res5 = await location_resolver.resolve_location("Berlin, Germany")
    assert res5.country == "DE"
    assert res5.city == "Berlin"


@pytest.mark.asyncio
async def test_location_resolver_remote_scopes():
    """Verify remote scopes and country restrictions."""
    # 1. Remote APAC
    res_apac = await location_resolver.resolve_location("Remote - APAC")
    assert res_apac.work_mode == "remote"
    assert res_apac.remote_scope == "region_specific"

    # 2. Remote US Only
    res_us = await location_resolver.resolve_location("Remote (US only)")
    assert res_us.work_mode == "remote"
    assert res_us.remote_scope == "country_specific"
    assert "US" in res_us.allowed_countries

    # 3. Remote Worldwide
    res_world = await location_resolver.resolve_location("Remote, worldwide")
    assert res_world.work_mode == "remote"
    assert res_world.remote_scope == "worldwide"

    # 4. Remote without geography (must NOT assume country from any website)
    res_generic = await location_resolver.resolve_location("Remote")
    assert res_generic.work_mode == "remote"
    assert res_generic.remote_scope == "unknown"
    assert res_generic.country is None


@pytest.mark.asyncio
async def test_countries_api_endpoints():
    """Verify GET /api/v1/countries and /api/v1/countries/{code} endpoints."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # List all
        res = await client.get("/api/v1/countries")
        assert res.status_code == 200
        countries = res.json()
        assert len(countries) >= 5
        codes = [c["code"] for c in countries]
        assert "IN" in codes
        assert "US" in codes

        # Get IN details
        res_in = await client.get("/api/v1/countries/IN")
        assert res_in.status_code == 200
        in_data = res_in.json()
        assert in_data["name"] == "India"
        assert in_data["currency"]["code"] == "INR"

        # 404 on invalid
        res_404 = await client.get("/api/v1/countries/INVALID")
        assert res_404.status_code == 404


@pytest.mark.asyncio
async def test_user_location_settings_get_and_put():
    """Verify GET and PUT /api/v1/settings/location."""
    user_id = uuid.uuid4()
    test_email = f"loc_user_{user_id.hex[:8]}@example.com"

    async with AsyncSessionLocal() as db:
        user = User(
            id=user_id,
            email=test_email,
            hashed_password="test_dummy_hashed_pw",
            full_name="Location Test User",
            is_active=True,
            home_country="IN",
            home_city="Bengaluru",
            preferred_cities=["Bengaluru", "Hyderabad"],
            timezone="Asia/Kolkata",
            citizenship="IN",
            work_authorization_countries=["IN"],
            needs_visa_sponsorship=False,
            willing_to_relocate=True,
            open_to_international=True
        )
        db.add(user)
        await db.commit()

    token = create_access_token(user_id=user_id, email=test_email)
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        client.cookies.set("access_token", token)

        # GET initial settings
        get_res = await client.get("/api/v1/settings/location")
        assert get_res.status_code == 200
        data = get_res.json()
        assert data["home_country"] == "IN"
        assert data["home_city"] == "Bengaluru"
        assert "Bengaluru" in data["preferred_cities"]
        assert data["open_to_international"] is True
        assert data["currency"]["code"] == "INR"

        # PUT updated settings (e.g. user moved to Germany or changed preferences)
        put_payload = {
            "home_country": "DE",
            "home_city": "Berlin",
            "preferred_cities": ["Berlin", "Munich"],
            "timezone": "Europe/Berlin",
            "citizenship": "IN",
            "work_authorization_countries": ["DE", "IN"],
            "needs_visa_sponsorship": True,
            "willing_to_relocate": True,
            "open_to_international": True
        }
        put_res = await client.put("/api/v1/settings/location", json=put_payload)
        assert put_res.status_code == 200
        updated = put_res.json()
        assert updated["home_country"] == "DE"
        assert updated["home_city"] == "Berlin"
        assert updated["currency"]["code"] == "EUR"
        assert updated["needs_visa_sponsorship"] is True


@pytest.mark.asyncio
async def test_resolve_location_utility_endpoint():
    """Verify POST /api/v1/location/resolve."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/v1/location/resolve", json={"raw_location": "Remote - APAC"})
        assert res.status_code == 200
        data = res.json()
        assert data["work_mode"] == "remote"
        assert data["remote_scope"] == "region_specific"
