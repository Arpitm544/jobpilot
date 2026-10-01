import urllib.request
import json
import sys

__test__ = False

def fetch_url(url, desc):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=5) as res:
            status = res.getcode()
            print(f"  [PASS] {desc} (Status {status}): {url}")
            return res.read().decode("utf-8", errors="ignore")
    except Exception as e:
        print(f"  [FAIL] {desc}: {url} -> {e}")
        return None

def run_live_e2e():
    print("=" * 60)
    print("  JOBPILOT LIVE END-TO-END SYSTEM VERIFICATION  ")
    print("=" * 60)

    print("\n[PHASE 1: FRONTEND NEXT.JS ROUTE VERIFICATION]")
    routes = [
        ("/", "Landing Route"),
        ("/login", "Sign-in / Demo Access Route"),
        ("/register", "Registration Route"),
        ("/onboarding", "Interactive Resume Onboarding Route"),
        ("/dashboard", "Main Application Pipeline"),
        ("/dashboard/jobs", "Job Match Feed & Manual Ingestion"),
        ("/dashboard/analytics", "Analytics Hub & Email Sync"),
        ("/dashboard/profile", "Master Profile Management"),
    ]
    for path, desc in routes:
        html = fetch_url(f"http://localhost:3000{path}", desc)
        assert html is not None, f"Frontend route failed: {path}"

    print("\n[PHASE 2: BACKEND FASTAPI & DB HEALTH]")
    health_raw = fetch_url("http://127.0.0.1:8000/health", "Backend Health Probe")
    assert health_raw is not None
    health_data = json.loads(health_raw)
    assert health_data.get("status") == "healthy"
    assert health_data.get("database") == "connected"
    print(f"  [PASS] Database state: {health_data['database']}")

    print("\n[PHASE 3: AUTHENTICATION & JWT TOKENS (DEMO USER)]")
    login_body = json.dumps({
        "email": "demo@jobpilot.io",
        "password": "password123"
    }).encode("utf-8")
    
    login_req = urllib.request.Request(
        "http://127.0.0.1:8000/api/v1/auth/login",
        data=login_body,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(login_req) as res:
        login_res = json.loads(res.read().decode("utf-8"))
        tokens = login_res.get("tokens", {})
        access_token = tokens.get("access_token")
        assert access_token, "No access token received!"
        print(f"  [PASS] Logged in as demo@jobpilot.io (Token: {access_token[:20]}...)")

    auth_headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }

    print("\n[PHASE 4: MASTER PROFILE & METADATA VERIFICATION]")
    prof_req = urllib.request.Request("http://127.0.0.1:8000/api/v1/profile/master", headers=auth_headers)
    with urllib.request.urlopen(prof_req) as res:
        prof = json.loads(res.read().decode("utf-8"))
        contact = prof.get("contact_info", {})
        skills = prof.get("skills", {})
        print(f"  [PASS] Profile loaded: {contact.get('full_name')} ({contact.get('email')})")
        print(f"  [PASS] Skill taxonomy categories: {list(skills.keys())}")

    print("\n[PHASE 5: PREFERENCES CONFIGURATION]")
    pref_req = urllib.request.Request("http://127.0.0.1:8000/api/v1/preferences", headers=auth_headers)
    with urllib.request.urlopen(pref_req) as res:
        pref = json.loads(res.read().decode("utf-8"))
        roles = pref.get("target_roles", [])
        print(f"  [PASS] Target roles: {roles}")

    print("\n[PHASE 6: APPLICATION PIPELINE & STAGING]")
    apps_req = urllib.request.Request("http://127.0.0.1:8000/api/v1/apply/pipeline", headers=auth_headers)
    with urllib.request.urlopen(apps_req) as res:
        pipeline = json.loads(res.read().decode("utf-8"))
        total_items = sum(len(items) for items in pipeline.values())
        print(f"  [PASS] Pipeline board loaded: {total_items} items across stages: {list(pipeline.keys())}")

    print("\n[PHASE 7: REAL-TIME ANALYTICS OVERVIEW]")
    analytics_req = urllib.request.Request("http://127.0.0.1:8000/api/v1/analytics/overview", headers=auth_headers)
    with urllib.request.urlopen(analytics_req) as res:
        analytics = json.loads(res.read().decode("utf-8"))
        print(f"  [PASS] Funnel conversion: {analytics.get('funnel')}")
        print(f"  [PASS] Total applications: {analytics.get('total_applications')}")
        print(f"  [PASS] Weekly velocity: {analytics.get('velocity')} applications")
        print(f"  [PASS] Average ATS keyword score: {analytics.get('avg_ats_score')}%")

    print("\n" + "=" * 60)
    print("  ALL END-TO-END VERIFICATION CHECKS PASSED SUCCESSFULLY!  ")
    print("=" * 60)

if __name__ == "__main__":
    try:
        run_live_e2e()
    except Exception as e:
        print(f"\n[ERROR] E2E verification failed: {e}")
        sys.exit(1)
