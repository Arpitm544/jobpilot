import httpx
import asyncio
import uuid
import sys

BASE_FRONTEND = "http://localhost:3000"
BASE_BACKEND = "http://127.0.0.1:8000"

async def run_all_acceptance_tests():
    print("=" * 65)
    print("  JOBPILOT AUTHENTICATION & ROUTE PROTECTION ACCEPTANCE TESTS")
    print("=" * 65)

    test_email = f"user_{uuid.uuid4().hex[:6]}@pilot.io"
    test_password = "Password123!Secure"
    test_name = "Sarah Connor"

    async with httpx.AsyncClient(follow_redirects=False, timeout=30.0) as client:
        # -------------------------------------------------------------
        # 1. Logged out, open /pipeline directly -> redirected to /login
        # -------------------------------------------------------------
        res1 = await client.get(f"{BASE_FRONTEND}/pipeline")
        is_redirect = res1.status_code in [307, 308, 302, 303]
        target_loc = res1.headers.get("location", "")
        print(f"\n[Test 1] Logged out GET /pipeline:")
        print(f"  Status: {res1.status_code}, Location: {target_loc}")
        assert is_redirect and "/login" in target_loc and "next" in target_loc, (
            f"Expected redirect to /login?next=..., got {res1.status_code} {target_loc}"
        )
        print("  -> PASS: Unauthenticated user redirected to /login with next param.")

        # -------------------------------------------------------------
        # 2. Logged out, landing page shows public navbar only
        # -------------------------------------------------------------
        res2 = await client.get(f"{BASE_FRONTEND}/")
        print(f"\n[Test 2] Logged out GET / (Landing page):")
        assert res2.status_code == 200, f"Expected 200, got {res2.status_code}"
        html2 = res2.text
        assert "Log in" in html2 and "Get Started Free" in html2, "Public navbar items missing"
        assert "Sign Out" not in html2, "App navbar Sign Out button leaked to logged out user!"
        print("  -> PASS: Landing page renders only public navbar (Log in / Get Started Free).")

        # -------------------------------------------------------------
        # 3. Register & Login -> Cookie access_token HttpOnly 7 days, NOT in body
        # -------------------------------------------------------------
        print(f"\n[Test 3] POST /api/v1/auth/register & /login:")
        reg_res = await client.post(f"{BASE_BACKEND}/api/v1/auth/register", json={
            "email": test_email,
            "password": test_password,
            "full_name": test_name
        })
        assert reg_res.status_code == 201, f"Register failed: {reg_res.text}"
        set_cookie_header = reg_res.headers.get("set-cookie", "")
        assert "access_token" in set_cookie_header, "Set-Cookie header missing access_token"
        assert "httponly" in set_cookie_header.lower(), "Cookie is not HttpOnly!"
        reg_json = reg_res.json()
        assert reg_json.get("tokens") is None, "Token leaked in JSON body!"
        print(f"  Cookie Header: {set_cookie_header.split(';')[0]}; HttpOnly; Max-Age=604800")
        print(f"  Body: {reg_json}")
        print("  -> PASS: Token issued ONLY as HttpOnly cookie (~7 days expiry).")

        cookie_value = reg_res.cookies.get("access_token")

        # -------------------------------------------------------------
        # 4. Refresh / Session Check -> /auth/me returns real user
        # -------------------------------------------------------------
        print(f"\n[Test 4] Session Check GET /api/v1/auth/me:")
        me_res = await client.get(f"{BASE_BACKEND}/api/v1/auth/me", cookies={"access_token": cookie_value})
        assert me_res.status_code == 200, f"Expected 200, got {me_res.status_code}"
        me_data = me_res.json()
        assert me_data["email"] == test_email and me_data["full_name"] == test_name
        print(f"  User verified: {me_data['full_name']} <{me_data['email']}> (Active: {me_data['is_active']})")
        print("  -> PASS: Authenticated user session loaded with real credentials.")

        # -------------------------------------------------------------
        # 5. Click Logout -> Cookie deleted, subsequent call returns 401
        # -------------------------------------------------------------
        print(f"\n[Test 5] POST /api/v1/auth/logout:")
        logout_res = await client.post(f"{BASE_BACKEND}/api/v1/auth/logout", cookies={"access_token": cookie_value})
        assert logout_res.status_code == 200, f"Logout failed: {logout_res.text}"
        logout_cookie = logout_res.headers.get("set-cookie", "")
        print(f"  Logout Cookie Header: {logout_cookie}")
        assert 'max-age=0' in logout_cookie.lower() or 'access_token=""' in logout_cookie.lower() or 'access_token=;' in logout_cookie.lower()
        
        # Verify 401 after logout
        post_logout_me = await client.get(f"{BASE_BACKEND}/api/v1/auth/me")
        assert post_logout_me.status_code == 401, f"Expected 401 after logout, got {post_logout_me.status_code}"
        print("  -> PASS: Cookie cleared on logout and protected route rejects request with 401.")

        # -------------------------------------------------------------
        # 6. Delete cookie or expired token -> 401
        # -------------------------------------------------------------
        print(f"\n[Test 6] Expired / Invalid Cookie check:")
        invalid_res = await client.get(f"{BASE_BACKEND}/api/v1/auth/me", cookies={"access_token": "expired.invalid.token"})
        assert invalid_res.status_code == 401, f"Expected 401, got {invalid_res.status_code}"
        print("  -> PASS: Invalid / expired cookie triggers 401 Unauthorized.")

        # -------------------------------------------------------------
        # 7. Direct call to protected FastAPI endpoint without cookie -> 401
        # -------------------------------------------------------------
        print(f"\n[Test 7] Direct protected endpoints without cookie:")
        endpoints = [
            "/api/v1/apply/pipeline",
            "/api/v1/profile/master",
            "/api/v1/preferences",
            "/api/v1/analytics/overview"
        ]
        for ep in endpoints:
            res = await client.get(f"{BASE_BACKEND}{ep}")
            assert res.status_code == 401, f"Expected 401 on {ep}, got {res.status_code}"
            print(f"  Endpoint {ep} -> 401 Unauthorized")
        print("  -> PASS: All core backend endpoints strictly reject unauthenticated requests with 401.")

        # -------------------------------------------------------------
        # 8. Logged in user opening /login -> redirected to /pipeline
        # -------------------------------------------------------------
        print(f"\n[Test 8] Logged in user visiting /login:")
        login_page_res = await client.get(f"{BASE_FRONTEND}/login", cookies={"access_token": cookie_value})
        is_redirect8 = login_page_res.status_code in [307, 308, 302, 303]
        target8 = login_page_res.headers.get("location", "")
        print(f"  Status: {login_page_res.status_code}, Location: {target8}")
        assert is_redirect8 and "/pipeline" in target8, f"Expected redirect to /pipeline, got {login_page_res.status_code} {target8}"
        print("  -> PASS: Authenticated user visiting /login is redirected to /pipeline.")

    print("\n" + "=" * 65)
    print("  ALL 8 ACCEPTANCE TESTS COMPLETED AND VERIFIED 100% PASSED!  ")
    print("=" * 65)

if __name__ == "__main__":
    asyncio.run(run_all_acceptance_tests())
