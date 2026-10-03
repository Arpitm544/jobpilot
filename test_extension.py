import os
import time
from playwright.sync_api import sync_playwright

def test_extension():
    extension_path = os.path.abspath("extension")
    
    with sync_playwright() as p:
        print("Launching browser with extension...")
        user_data_dir = f"/tmp/playwright_user_data_{int(time.time())}"
        browser_context = p.chromium.launch_persistent_context(
            user_data_dir=user_data_dir,
            headless=False,
            args=[
                f"--disable-extensions-except={extension_path}",
                f"--load-extension={extension_path}",
            ],
        )
        page = browser_context.pages[0]
        page.on("console", lambda msg: print(f"PAGE LOG: {msg.text}"))
        
        print("Registering new user in JobPilot...")
        unique_email = f"tester_{int(time.time())}@jobpilot.io"
        page.goto("http://localhost:3000/register")
        try:
            page.fill("input[placeholder='e.g. John Doe']", "Test User", timeout=5000)
        except Exception as e:
            print(f"Failed to find input. Current URL: {page.url}")
            print(f"Page title: {page.title()}")
            page.screenshot(path="playwright_debug.png")
            print("Page HTML snippet:", page.content()[:2000])
            raise e
        page.fill("input[type='email']", unique_email)
        page.fill("input[type='password']", "password123")
        page.click("button[type='submit']")
        
        # Check for visible error message on the form before waiting
        time.sleep(1)
        if page.locator(".text-rose-400").is_visible():
            print("Form Error:", page.locator(".text-rose-400").inner_text())
            page.screenshot(path="playwright_error.png")
        
        # Wait for redirect to dashboard
        try:
            page.wait_for_url("**/onboarding", timeout=10000)
            print("Registered successfully (redirected to onboarding).")
            # For the extension to work, we can just navigate to dashboard anyway
            page.goto("http://localhost:3000/dashboard")
        except Exception as e:
            print(f"Error during registration: {e}")
            print("Trying fallback login...")
            page.goto("http://localhost:3000/login")
            page.fill("input[type='email']", unique_email)
            page.fill("input[type='password']", "password123")
            page.click("button[type='submit']")
            page.wait_for_url("**/pipeline")
            print("Logged in successfully.")
        
        # Navigate to a dummy job page in a NEW tab so the JobPilot tab stays open for auth sync
        print("Navigating to a dummy job page in a new tab...")
        job_page = browser_context.new_page()
        job_page.goto("https://ashbyhq.com/jobpilot-demo/job/12345")
        
        # The extension ID can be found by inspecting the service worker
        print("Finding extension ID...")
        background_pages = browser_context.background_pages
        if not background_pages:
            # wait for background page
            time.sleep(2)
            background_pages = browser_context.background_pages
            
        if not background_pages:
            # MV3 uses service workers
            service_workers = browser_context.service_workers
            if not service_workers:
                print("Could not find extension service worker!")
                return
            ext_url = service_workers[0].url
        else:
            ext_url = background_pages[0].url
            
        ext_id = ext_url.split("/")[2]
        print(f"Extension ID: {ext_id}")
        
        # Open the popup
        popup_url = f"chrome-extension://{ext_id}/popup.html"
        print(f"Opening popup: {popup_url}")
        
        popup_page = browser_context.new_page()
        popup_page.goto(popup_url)
        
        print("Waiting for popup to load...")
        time.sleep(2)
        
        # Click the clip button
        print("Clicking clip button via evaluate...")
        popup_page.evaluate("document.getElementById('clipBtn').click()")
        
        print("Waiting for clipping to finish...")
        status_box = popup_page.locator("#statusBox")
        
        # Poll for up to 30 seconds
        for i in range(30):
            box_class = status_box.get_attribute("class") or ""
            box_style = status_box.get_attribute("style") or ""
            if "status-msg" in box_class and "display: none" not in box_style:
                break
            time.sleep(1)
        
        popup_page.screenshot(path="popup_final_state.png")
        print("Status text:", status_box.inner_text().encode('utf-8', 'replace'))
        
        # Navigate to pipeline to verify job
        print("Navigating to pipeline...")
        job_page.goto("http://localhost:3000/pipeline")
        time.sleep(3)
        job_page.screenshot(path="pipeline_final_state.png")
        
        if "Fit" in status_box.inner_text() or "Error" in status_box.inner_text():
            print("Test completed.")
        
        browser_context.close()

if __name__ == "__main__":
    test_extension()
