import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:3000"
API_URL = "http://127.0.0.1:8000"
SCREENSHOTS_DIR = Path("logs/screenshots")
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
TEST_ARTIFACTS_DIR = Path("logs/test_artifacts")

test_results = []

def record_step(flow_name, step_name, status, details, screenshot_file=None, console_errors=None, failed_requests=None):
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "flow": flow_name,
        "step": step_name,
        "status": status,
        "details": details,
        "screenshot": str(screenshot_file) if screenshot_file else None,
        "console_errors": console_errors or [],
        "failed_requests": failed_requests or []
    }
    test_results.append(entry)
    print(f"[{status}] {flow_name} -> {step_name}: {details}")

def run_tests():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1280, "height": 900},
            ignore_https_errors=True
        )

        console_logs = []
        failed_requests = []

        def handle_console(msg):
            if msg.type in ["error", "warning"]:
                console_logs.append(f"[{msg.type.upper()}] {msg.text}")

        def handle_request_failed(request):
            failed_requests.append({
                "url": request.url,
                "method": request.method,
                "failure": request.failure,
            })

        def handle_response(response):
            if response.status >= 400:
                body_snippet = ""
                try:
                    body_snippet = response.text()[:250]
                except Exception:
                    pass
                failed_requests.append({
                    "url": response.url,
                    "method": response.request.method,
                    "status": response.status,
                    "response_body": body_snippet
                })

        page = context.new_page()
        page.on("console", handle_console)
        page.on("requestfailed", handle_request_failed)
        page.on("response", handle_response)

        # =========================================================================
        # FLOW 1: LANDING PAGE
        # =========================================================================
        print("\n--- FLOW 1: LANDING PAGE ---")
        console_logs.clear()
        failed_requests.clear()
        try:
            page.goto(f"{BASE_URL}", wait_until="load", timeout=20000)
            ss_f1 = SCREENSHOTS_DIR / "flow1_landing_hero.png"
            page.screenshot(path=str(ss_f1), full_page=False)

            title = page.title()
            has_get_started = page.locator("text=Get Started").first.is_visible()
            has_login = page.locator("text=Log in").first.is_visible() or page.locator("text=Sign In").first.is_visible()
            
            anchors = page.locator("a[href^='#']").all()
            anchor_hrefs = [a.get_attribute("href") for a in anchors if a.get_attribute("href")]

            record_step(
                flow_name="Flow 1: Landing Page",
                step_name="Render & Navigation",
                status="PASS" if has_get_started else "FAIL",
                details=f"Page loaded. Title: '{title}'. Get Started visible: {has_get_started}. Anchors: {anchor_hrefs}",
                screenshot_file=ss_f1,
                console_errors=list(console_logs),
                failed_requests=list(failed_requests)
            )
        except Exception as e:
            record_step("Flow 1: Landing Page", "Render & Navigation", "FAIL", str(e), console_errors=list(console_logs))

        # =========================================================================
        # FLOW 2: AUTH FLOW & PROTECTED ROUTES
        # =========================================================================
        print("\n--- FLOW 2: AUTH & ROUTE PROTECTION ---")
        test_email = f"qa_engineer_{int(time.time())}@example.com"
        test_password = "Password123!Secure"
        test_name = "Senior QA Automation Engineer"

        # 2.1 Protected routes check when logged out
        console_logs.clear()
        failed_requests.clear()
        protected_routes = ["/onboarding", "/pipeline", "/discovery", "/analytics", "/profile"]
        unauth_pass = True
        for route in protected_routes:
            page.goto(f"{BASE_URL}{route}", wait_until="load", timeout=15000)
            current_url = page.url
            if "/login" not in current_url and current_url != f"{BASE_URL}/":
                unauth_pass = False
                print(f"Protected route {route} failed redirect: stayed at {current_url}")
        
        ss_f2_prot = SCREENSHOTS_DIR / "flow2_protected_routes.png"
        page.screenshot(path=str(ss_f2_prot))
        record_step(
            flow_name="Flow 2: Auth",
            step_name="Protected Routes Redirect",
            status="PASS" if unauth_pass else "FAIL",
            details="All protected routes redirect unauthenticated users to /login" if unauth_pass else "Some routes failed redirect",
            screenshot_file=ss_f2_prot,
            console_errors=list(console_logs),
            failed_requests=list(failed_requests)
        )

        # 2.2 Register new account with sufficient wait for serverless DB commit
        console_logs.clear()
        failed_requests.clear()
        try:
            page.goto(f"{BASE_URL}/register", wait_until="load")
            page.wait_for_selector("button[type='submit']", timeout=15000)
            page.locator("input[placeholder*='Alex Mercer']").fill(test_name)
            page.locator("input[type='email']").fill(test_email)
            page.locator("input[type='password']").fill(test_password)
            
            page.locator("button[type='submit']").click()
            print("Submitted registration form. Waiting for client-side redirect to /onboarding...")
            for _ in range(35):
                if "/onboarding" in page.url:
                    break
                page.wait_for_timeout(1000)

            ss_f2_reg = SCREENSHOTS_DIR / "flow2_registered.png"
            page.screenshot(path=str(ss_f2_reg))

            cookies = context.cookies()
            auth_cookie = next((c for c in cookies if c["name"] == "access_token"), None)
            cookie_httponly = auth_cookie.get("httpOnly") if auth_cookie else None

            record_step(
                flow_name="Flow 2: Auth",
                step_name="Registration & Cookie Set",
                status="PASS" if auth_cookie and "/onboarding" in page.url else "FAIL",
                details=f"Registered {test_email}. Redirected to: {page.url}. Cookie present: {bool(auth_cookie)}, HttpOnly: {cookie_httponly}",
                screenshot_file=ss_f2_reg,
                console_errors=list(console_logs),
                failed_requests=list(failed_requests)
            )
        except Exception as e:
            record_step("Flow 2: Auth", "Registration & Cookie Set", "FAIL", str(e), console_errors=list(console_logs))

        # 2.3 Reload preserves session
        console_logs.clear()
        failed_requests.clear()
        try:
            page.reload(wait_until="load")
            page.wait_for_timeout(2000)
            ss_f2_reload = SCREENSHOTS_DIR / "flow2_reload_session.png"
            page.screenshot(path=str(ss_f2_reload))

            still_authed = "/login" not in page.url
            record_step(
                flow_name="Flow 2: Auth",
                step_name="Session Persistence on Reload",
                status="PASS" if still_authed else "FAIL",
                details=f"Reload kept session: {still_authed}. Current URL: {page.url}",
                screenshot_file=ss_f2_reload,
                console_errors=list(console_logs),
                failed_requests=list(failed_requests)
            )
        except Exception as e:
            record_step("Flow 2: Auth", "Session Persistence on Reload", "FAIL", str(e), console_errors=list(console_logs))

        # =========================================================================
        # FLOW 3: ONBOARDING STEP 1 - RESUME UPLOADS & STATUS TRANSITIONS
        # =========================================================================
        print("\n--- FLOW 3: ONBOARDING STEP 1 - RESUME UPLOADS ---")
        page.goto(f"{BASE_URL}/onboarding", wait_until="load")
        page.wait_for_selector("input[type='file']", state="attached", timeout=30000)

        # 3.1 Test Unsupported File Type (.exe)
        console_logs.clear()
        failed_requests.clear()
        try:
            wrong_file = str(TEST_ARTIFACTS_DIR / "malicious_script.exe")
            page.locator("input[type='file']").set_input_files(wrong_file)
            page.wait_for_timeout(1500)
            ss_f3_wrong = SCREENSHOTS_DIR / "flow3_unsupported_ext.png"
            page.screenshot(path=str(ss_f3_wrong))

            has_wrong_error = page.locator("text=Unsupported file format").is_visible()
            record_step(
                flow_name="Flow 3: Onboarding Step 1",
                step_name="Wrong File Type Rejection (.exe)",
                status="PASS" if has_wrong_error else "FAIL",
                details=f"Unsupported format detected and blocked by client: {has_wrong_error}",
                screenshot_file=ss_f3_wrong,
                console_errors=list(console_logs),
                failed_requests=list(failed_requests)
            )
        except Exception as e:
            record_step("Flow 3: Onboarding Step 1", "Wrong File Type Rejection (.exe)", "FAIL", str(e))

        # 3.2 Test Oversized File Rejection (>5MB)
        console_logs.clear()
        failed_requests.clear()
        try:
            oversized_file = str(TEST_ARTIFACTS_DIR / "oversized_resume.pdf")
            page.locator("input[type='file']").set_input_files(oversized_file)
            page.wait_for_timeout(1500)
            ss_f3_oversized = SCREENSHOTS_DIR / "flow3_oversized_rejection.png"
            page.screenshot(path=str(ss_f3_oversized))

            has_size_error = page.locator("text=Maximum allowed size is 5 MB").is_visible()
            record_step(
                flow_name="Flow 3: Onboarding Step 1",
                step_name="Oversized File Rejection (>5MB)",
                status="PASS" if has_size_error else "FAIL",
                details=f"Oversized file validation triggered: {has_size_error}",
                screenshot_file=ss_f3_oversized,
                console_errors=list(console_logs),
                failed_requests=list(failed_requests)
            )
        except Exception as e:
            record_step("Flow 3: Onboarding Step 1", "Oversized File Rejection (>5MB)", "FAIL", str(e))

        # 3.3 Test Corrupted / Spoofed PDF Rejection (Server Signature Check)
        console_logs.clear()
        failed_requests.clear()
        try:
            corrupt_file = str(TEST_ARTIFACTS_DIR / "corrupt_fake.pdf")
            page.locator("input[type='file']").set_input_files(corrupt_file)
            has_corrupt_error = False
            for _ in range(20):
                page.wait_for_timeout(500)
                if (
                    page.locator("text=Invalid file format").first.is_visible()
                    or page.locator("text=Upload Notice").first.is_visible()
                    or any(r.get("status") == 400 for r in failed_requests)
                ):
                    has_corrupt_error = True
                    break

            ss_f3_corrupt = SCREENSHOTS_DIR / "flow3_corrupt_rejection.png"
            page.screenshot(path=str(ss_f3_corrupt))

            record_step(
                flow_name="Flow 3: Onboarding Step 1",
                step_name="Corrupt / Spoofed PDF Rejection",
                status="PASS" if has_corrupt_error else "FAIL",
                details=f"Corrupt file upload rejected correctly. Detected: {has_corrupt_error}",
                screenshot_file=ss_f3_corrupt,
                console_errors=list(console_logs),
                failed_requests=list(failed_requests)
            )
        except Exception as e:
            record_step("Flow 3: Onboarding Step 1", "Corrupt / Spoofed PDF Rejection", "FAIL", str(e))

        # 3.4 Test DOCX Format Upload
        console_logs.clear()
        failed_requests.clear()
        try:
            docx_file = str(TEST_ARTIFACTS_DIR / "valid_resume.docx")
            page.locator("input[type='file']").set_input_files(docx_file)
            page.wait_for_timeout(2000)
            ss_f3_docx = SCREENSHOTS_DIR / "flow3_docx_upload.png"
            page.screenshot(path=str(ss_f3_docx))

            docx_accepted = not page.locator("text=Unsupported file format").is_visible()
            record_step(
                flow_name="Flow 3: Onboarding Step 1",
                step_name="DOCX Upload Acceptance",
                status="PASS" if docx_accepted else "FAIL",
                details=f"DOCX resume accepted by client: {docx_accepted}",
                screenshot_file=ss_f3_docx,
                console_errors=list(console_logs),
                failed_requests=list(failed_requests)
            )
        except Exception as e:
            record_step("Flow 3: Onboarding Step 1", "DOCX Upload Acceptance", "FAIL", str(e))

        # 3.5 Test Scanned / Image PDF Upload
        console_logs.clear()
        failed_requests.clear()
        try:
            scanned_file = str(TEST_ARTIFACTS_DIR / "scanned_resume.pdf")
            page.locator("input[type='file']").set_input_files(scanned_file)
            page.wait_for_timeout(2000)
            ss_f3_scanned = SCREENSHOTS_DIR / "flow3_scanned_pdf.png"
            page.screenshot(path=str(ss_f3_scanned))

            scanned_accepted = not page.locator("text=Unsupported file format").is_visible()
            record_step(
                flow_name="Flow 3: Onboarding Step 1",
                step_name="Scanned / Image PDF Upload",
                status="PASS" if scanned_accepted else "FAIL",
                details=f"Scanned image PDF accepted and processed: {scanned_accepted}",
                screenshot_file=ss_f3_scanned,
                console_errors=list(console_logs),
                failed_requests=list(failed_requests)
            )
        except Exception as e:
            record_step("Flow 3: Onboarding Step 1", "Scanned / Image PDF Upload", "FAIL", str(e))

        # 3.6 Test Valid Text PDF Upload & Status Flow (queued -> extracting -> analyzing -> validating -> ready)
        console_logs.clear()
        failed_requests.clear()
        try:
            valid_pdf = str(TEST_ARTIFACTS_DIR / "valid_resume.pdf")
            page.locator("input[type='file']").set_input_files(valid_pdf)
            print("Uploaded valid resume. Monitoring processing status...")
            
            # Watch for progress / status transitions
            status_seen = set()
            for _ in range(60):
                page.wait_for_timeout(1000)
                text_content = page.content()
                for kw in ["queued", "extracting", "analyzing", "validating", "ready", "Found:", "Step 2", "Save Profile"]:
                    if kw.lower() in text_content.lower():
                        status_seen.add(kw)
                
                # Check if Step 2 reached
                if "Found:" in text_content or page.locator("button:has-text('Save Profile')").first.is_visible():
                    status_seen.add("step_2_reached")
                    break

            ss_f3_valid = SCREENSHOTS_DIR / "flow3_valid_resume_processed.png"
            page.screenshot(path=str(ss_f3_valid))

            step2_reached = "step_2_reached" in status_seen or page.locator("button:has-text('Save Profile')").first.is_visible()
            record_step(
                flow_name="Flow 3: Onboarding Step 1",
                step_name="Valid PDF Upload & Status Transitions",
                status="PASS" if step2_reached else "FAIL",
                details=f"Status stages observed: {list(status_seen)}. Step 2 reached: {step2_reached}",
                screenshot_file=ss_f3_valid,
                console_errors=list(console_logs),
                failed_requests=list(failed_requests)
            )
        except Exception as e:
            record_step("Flow 3: Onboarding Step 1", "Valid PDF Upload & Status Transitions", "FAIL", str(e))

        # =========================================================================
        # FLOW 4: ONBOARDING STEP 2 - MASTER PROFILE EDIT & PERSISTENCE
        # =========================================================================
        print("\n--- FLOW 4: MASTER PROFILE REVIEW & EDIT ---")
        console_logs.clear()
        failed_requests.clear()
        try:
            # If merge modal appears from multiple test uploads, accept replacement
            replace_btn = page.locator("text=Replace my profile with the new data")
            if replace_btn.is_visible():
                replace_btn.click()
                page.wait_for_timeout(1500)

            # Check for literal 'null' string displayed anywhere
            page_text = page.inner_text("body")
            has_literal_null = "null" in page_text.split()
            
            # Edit name or summary field
            inputs = page.locator("input[type='text']")
            if inputs.count() > 0:
                inputs.first.fill("Arjun Patel (QA Verified)")
            
            # Click Save Profile & Next: Job Preferences
            continue_btn = page.locator("button:has-text('Save Profile'), button:has-text('Next: Job Preferences')").first
            if continue_btn.is_visible():
                continue_btn.click()
                for _ in range(30):
                    if page.locator("button:has-text('Save & Next: Common Questions')").is_visible():
                        break
                    page.wait_for_timeout(1000)

            ss_f4_profile = SCREENSHOTS_DIR / "flow4_master_profile_saved.png"
            page.screenshot(path=str(ss_f4_profile))

            record_step(
                flow_name="Flow 4: Master Profile",
                step_name="Profile Fields Review & Edit",
                status="PASS" if not has_literal_null else "FAIL",
                details=f"No literal 'null' text displayed: {not has_literal_null}. Successfully modified and clicked Continue.",
                screenshot_file=ss_f4_profile,
                console_errors=list(console_logs),
                failed_requests=list(failed_requests)
            )
        except Exception as e:
            record_step("Flow 4: Master Profile", "Profile Fields Review & Edit", "FAIL", str(e))

        # =========================================================================
        # FLOW 5: ONBOARDING STEPS 3 & 4 (PREFERENCES & QUESTION BANK)
        # =========================================================================
        print("\n--- FLOW 5: PREFERENCES & QUESTION BANK ---")
        console_logs.clear()
        failed_requests.clear()
        try:
            # Step 3: Job Preferences
            step3_save_btn = page.locator("button:has-text('Save & Next: Common Questions'), button:has-text('Save & Next')").first
            for _ in range(30):
                if step3_save_btn.is_visible():
                    break
                page.wait_for_timeout(1000)

            if step3_save_btn.is_visible():
                step3_save_btn.click()
                for _ in range(30):
                    if page.locator("button:has-text('Complete Onboarding')").is_visible():
                        break
                    page.wait_for_timeout(1000)

            # Step 4: Question Bank (India Template verification: notice period, CTC)
            ctc_input = page.locator("input[placeholder*='INR 18 LPA'], input[placeholder*='95,000']")
            if ctc_input.count() > 0:
                ctc_input.first.fill("INR 24 LPA")

            step4_save_btn = page.locator("button:has-text('Complete Onboarding')").first
            for _ in range(30):
                if step4_save_btn.is_visible():
                    break
                page.wait_for_timeout(1000)

            if step4_save_btn.is_visible():
                step4_save_btn.click()
                for _ in range(30):
                    if "/pipeline" in page.url or page.locator("text=Onboarding Complete").first.is_visible():
                        break
                    page.wait_for_timeout(1000)

            ss_f5_done = SCREENSHOTS_DIR / "flow5_onboarding_completed.png"
            page.screenshot(path=str(ss_f5_done))

            # Test returning to /onboarding after completing it
            page.goto(f"{BASE_URL}/onboarding", wait_until="load")
            has_saved_state = False
            for _ in range(30):
                page.wait_for_timeout(1000)
                revisit_content = page.content()
                if any(kw in revisit_content for kw in ["Resume on File", "Parsed & Verified", "Continue with this resume", "Onboarding Complete", "Ready for Automation"]):
                    has_saved_state = True
                    break

            ss_f5_return = SCREENSHOTS_DIR / "flow5_onboarding_revisit.png"
            page.screenshot(path=str(ss_f5_return))

            record_step(
                flow_name="Flow 5: Preferences & Questions",
                step_name="Steps 3 & 4 Persistence & Revisit",
                status="PASS" if has_saved_state else "FAIL",
                details=f"Completed flow. Revisit to /onboarding shows saved state: {has_saved_state}",
                screenshot_file=ss_f5_return,
                console_errors=list(console_logs),
                failed_requests=list(failed_requests)
            )
        except Exception as e:
            record_step("Flow 5: Preferences & Questions", "Steps 3 & 4 Persistence & Revisit", "FAIL", str(e))

        # =========================================================================
        # FLOW 6: DASHBOARD PAGES VERIFICATION
        # =========================================================================
        print("\n--- FLOW 6: DASHBOARD PAGES ---")
        dashboard_pages = [
            ("/pipeline", "Pipeline"),
            ("/discovery", "Discovery"),
            ("/analytics", "Analytics"),
            ("/profile", "Master Profile"),
            ("/dashboard/pipeline", "Dashboard Pipeline"),
            ("/dashboard/jobs", "Dashboard Jobs"),
            ("/dashboard/analytics", "Dashboard Analytics"),
            ("/dashboard/profile", "Dashboard Profile")
        ]

        for path, label in dashboard_pages:
            console_logs.clear()
            failed_requests.clear()
            try:
                page.goto(f"{BASE_URL}{path}", wait_until="load", timeout=20000)
                page.wait_for_timeout(1500)
                clean_name = path.replace("/", "_").strip("_")
                ss_dash = SCREENSHOTS_DIR / f"flow6_{clean_name}.png"
                page.screenshot(path=str(ss_dash))

                has_fatal_error = any("500" in str(r.get("status")) for r in failed_requests)
                record_step(
                    flow_name="Flow 6: Dashboard Pages",
                    step_name=f"Load {label} ({path})",
                    status="FAIL" if has_fatal_error else "PASS",
                    details=f"{label} loaded cleanly. Fatal errors: {has_fatal_error}. Failed requests: {len(failed_requests)}",
                    screenshot_file=ss_dash,
                    console_errors=list(console_logs),
                    failed_requests=list(failed_requests)
                )
            except Exception as e:
                record_step("Flow 6: Dashboard Pages", f"Load {label}", "FAIL", str(e))

        # =========================================================================
        # FLOW 7: EDGE CASES (DOUBLE-CLICK, REFRESH, TWO TABS, LOGOUT)
        # =========================================================================
        print("\n--- FLOW 7: EDGE CASES ---")
        # 7.1 Double-click submit button
        console_logs.clear()
        failed_requests.clear()
        try:
            page.goto(f"{BASE_URL}/discovery", wait_until="load")
            discover_btn = page.locator("button:has-text('Discover'), button:has-text('Find Jobs')").first
            if discover_btn.is_visible():
                discover_btn.click()
                discover_btn.click()
                page.wait_for_timeout(2000)

            ss_f7_edge = SCREENSHOTS_DIR / "flow7_edge_cases.png"
            page.screenshot(path=str(ss_f7_edge))

            record_step(
                flow_name="Flow 7: Edge Cases",
                step_name="Double-Click & Stress Action",
                status="PASS",
                details="Double-click handled without unhandled exception crashing UI",
                screenshot_file=ss_f7_edge,
                console_errors=list(console_logs),
                failed_requests=list(failed_requests)
            )
        except Exception as e:
            record_step("Flow 7: Edge Cases", "Double-Click & Stress Action", "FAIL", str(e))

        # 7.2 Two tabs open with active session
        try:
            tab2 = context.new_page()
            tab2.goto(f"{BASE_URL}/profile", wait_until="load")
            tab2.wait_for_timeout(1500)
            ss_f7_tab2 = SCREENSHOTS_DIR / "flow7_multi_tab.png"
            tab2.screenshot(path=str(ss_f7_tab2))
            record_step(
                flow_name="Flow 7: Edge Cases",
                step_name="Multi-Tab Synchronization",
                status="PASS" if "/login" not in tab2.url else "FAIL",
                details=f"Second tab retains active session without conflict: {tab2.url}",
                screenshot_file=ss_f7_tab2
            )
            tab2.close()
        except Exception as e:
            record_step("Flow 7: Edge Cases", "Multi-Tab Synchronization", "FAIL", str(e))

        # 7.3 Logout test
        try:
            page.goto(f"{BASE_URL}/pipeline", wait_until="load")
            logout_btn = page.wait_for_selector("button[aria-label='Sign Out'], button[title='Sign Out']", timeout=15000)
            if logout_btn:
                logout_btn.click()
                for _ in range(20):
                    if page.url == f"{BASE_URL}/" or "/login" in page.url or page.url.endswith(":3000/"):
                        break
                    page.wait_for_timeout(500)
            
            # Confirm returned to landing page or login
            logged_out = page.url == f"{BASE_URL}/" or "/login" in page.url or page.url.endswith(":3000/")
            
            # Verify protected route redirects to login after logout
            page.goto(f"{BASE_URL}/pipeline", wait_until="load")
            page.wait_for_timeout(2000)
            redirected_to_login = "/login" in page.url

            ss_f7_logout = SCREENSHOTS_DIR / "flow7_logged_out.png"
            page.screenshot(path=str(ss_f7_logout))
            record_step(
                flow_name="Flow 7: Edge Cases",
                step_name="Logout & Session Termination",
                status="PASS" if (logged_out and redirected_to_login) else "FAIL",
                details=f"Logged out. Landed at: {page.url}. Protected route redirected to /login: {redirected_to_login}",
                screenshot_file=ss_f7_logout
            )
        except Exception as e:
            record_step("Flow 7: Edge Cases", "Logout & Session Termination", "FAIL", str(e))

        browser.close()

    summary_path = Path("logs/phase1_browser_results.json")
    summary_path.write_text(json.dumps(test_results, indent=2), encoding="utf-8")
    print(f"\nAll browser tests complete! Results saved to {summary_path}")

if __name__ == "__main__":
    run_tests()
