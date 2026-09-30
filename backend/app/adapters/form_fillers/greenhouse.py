import os
import uuid
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from playwright.async_api import async_playwright

from app.adapters.form_fillers.base import BaseFormFiller, FormFillerResult

logger = logging.getLogger(__name__)


class GreenhouseFormFiller(BaseFormFiller):
    """Playwright automated form filler for Greenhouse ATS boards"""

    async def fill_application(
        self,
        apply_url: str,
        resume_pdf_path: str,
        candidate_data: Dict[str, Any],
        cover_letter: Optional[str] = None,
        question_bank: Optional[Dict[str, Any]] = None,
        is_dry_run: bool = True
    ) -> FormFillerResult:
        contact = candidate_data.get("contact_info", {})
        full_name = contact.get("full_name", "")
        name_parts = full_name.split() if full_name else ["Candidate", "Applicant"]
        first_name = name_parts[0]
        last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else name_parts[0]
        email = contact.get("email", "")
        phone = contact.get("phone", "")
        linkedin = contact.get("linkedin", "")
        github = contact.get("github", "")

        qb = question_bank or {}
        work_auth = qb.get("work_authorization", "Authorized to work")
        notice_period = qb.get("notice_period", "Immediate")

        screenshot_name = f"proof_greenhouse_{uuid.uuid4().hex[:8]}.png"
        screenshot_path = os.path.join(self.screenshot_dir, screenshot_name)

        filled_fields = {}

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context(
                    viewport={"width": 1280, "height": 900},
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                )
                page = await context.new_page()

                # Navigate to application
                logger.info(f"Navigating to Greenhouse apply URL: {apply_url}")
                await page.goto(apply_url, wait_until="domcontentloaded", timeout=25000)

                # Check for CAPTCHA or Cloudflare challenge
                content = await page.content()
                if "cf-turnstile" in content or "g-recaptcha" in content or "hcaptcha" in content or "verify you are human" in content.lower():
                    logger.warning("CAPTCHA or Bot-Challenge detected on application page.")
                    await page.screenshot(path=screenshot_path)
                    await browser.close()
                    return FormFillerResult(
                        success=False,
                        is_dry_run=is_dry_run,
                        screenshot_path=screenshot_path,
                        requires_user_input=True,
                        deep_link=apply_url,
                        error_message="CAPTCHA detected on application form. User input required."
                    )

                # 1. Fill First Name
                if await page.query_selector("#first_name"):
                    await page.fill("#first_name", first_name)
                    filled_fields["first_name"] = first_name

                # 2. Fill Last Name
                if await page.query_selector("#last_name"):
                    await page.fill("#last_name", last_name)
                    filled_fields["last_name"] = last_name

                # 3. Fill Email
                if await page.query_selector("#email"):
                    await page.fill("#email", email)
                    filled_fields["email"] = email

                # 4. Fill Phone
                if await page.query_selector("#phone"):
                    await page.fill("#phone", phone)
                    filled_fields["phone"] = phone

                # 5. Upload Resume PDF
                resume_input = await page.query_selector("input[type='file'][name*='resume'], input#resume")
                if resume_input and os.path.exists(resume_pdf_path):
                    await resume_input.set_input_files(resume_pdf_path)
                    filled_fields["resume_uploaded"] = os.path.basename(resume_pdf_path)

                # 6. Fill Cover Letter
                if cover_letter:
                    cl_input = await page.query_selector("textarea[name*='cover_letter'], #cover_letter_text")
                    if cl_input:
                        await cl_input.fill(cover_letter)
                        filled_fields["cover_letter_filled"] = True

                # 7. Fill LinkedIn
                linkedin_input = await page.query_selector("input[autocomplete*='linkedin'], input[id*='linkedin'], input[name*='linkedin']")
                if linkedin_input and linkedin:
                    await linkedin_input.fill(linkedin)
                    filled_fields["linkedin"] = linkedin

                # 8. Fill Website / GitHub
                website_input = await page.query_selector("input[id*='website'], input[name*='website'], input[id*='github']")
                if website_input and github:
                    await website_input.fill(github)
                    filled_fields["website_github"] = github

                # Wait for any DOM updates
                await page.wait_for_timeout(1000)

                # Capture Full-Page Verification Proof Screenshot
                await page.screenshot(path=screenshot_path, full_page=True)

                if is_dry_run:
                    logger.info(f"Dry-run complete. Form filled and proof captured at {screenshot_path}")
                    await browser.close()
                    return FormFillerResult(
                        success=True,
                        is_dry_run=True,
                        screenshot_path=screenshot_path,
                        proof_text=f"Dry-run successful. Filled {len(filled_fields)} fields on Greenhouse application form.",
                        filled_fields=filled_fields
                    )
                else:
                    # Submit Mode
                    submit_button = await page.query_selector("#submit_app, button[type='submit'], input[type='submit']")
                    if submit_button:
                        await submit_button.click()
                        await page.wait_for_timeout(3000)
                        # Capture submission confirmation screenshot
                        await page.screenshot(path=screenshot_path, full_page=True)
                    await browser.close()
                    return FormFillerResult(
                        success=True,
                        is_dry_run=False,
                        screenshot_path=screenshot_path,
                        proof_text="Application submitted successfully on Greenhouse.",
                        filled_fields=filled_fields
                    )
        except Exception as e:
            logger.error(f"Error executing Greenhouse form filling: {e}", exc_info=True)
            return FormFillerResult(
                success=False,
                is_dry_run=is_dry_run,
                error_message=str(e),
                deep_link=apply_url
            )
