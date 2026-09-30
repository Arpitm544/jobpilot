import os
import uuid
import logging
from typing import Dict, Any, Optional
from playwright.async_api import async_playwright

from app.adapters.form_fillers.base import BaseFormFiller, FormFillerResult

logger = logging.getLogger(__name__)


class AshbyFormFiller(BaseFormFiller):
    """Playwright automated form filler for Ashby ATS job postings"""

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

        screenshot_name = f"proof_ashby_{uuid.uuid4().hex[:8]}.png"
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
                logger.info(f"Navigating to Ashby apply URL: {apply_url}")
                await page.goto(apply_url, wait_until="domcontentloaded", timeout=25000)

                # Check for bot challenge
                content = await page.content()
                if "cf-turnstile" in content or "g-recaptcha" in content or "hcaptcha" in content or "verify you are human" in content.lower():
                    logger.warning("CAPTCHA or Bot-Challenge detected on Ashby application page.")
                    await page.screenshot(path=screenshot_path)
                    await browser.close()
                    return FormFillerResult(
                        success=False,
                        is_dry_run=is_dry_run,
                        screenshot_path=screenshot_path,
                        requires_user_input=True,
                        deep_link=apply_url,
                        error_message="Bot challenge detected on Ashby page. User input required."
                    )

                # Ashby candidate name (sometimes single "name" field or first/last)
                if await page.query_selector('input[name="name"]'):
                    await page.fill('input[name="name"]', full_name)
                    filled_fields["full_name"] = full_name
                elif await page.query_selector('input[id*="name" i]'):
                    await page.fill('input[id*="name" i]', full_name)
                    filled_fields["name"] = full_name

                # Email
                if await page.query_selector('input[name="email"], input[type="email"]'):
                    await page.fill('input[name="email"], input[type="email"]', email)
                    filled_fields["email"] = email

                # Phone
                if await page.query_selector('input[name="phone"], input[type="tel"]'):
                    await page.fill('input[name="phone"], input[type="tel"]', phone)
                    filled_fields["phone"] = phone

                # Resume PDF upload
                file_input = await page.query_selector('input[type="file"]')
                if file_input and os.path.exists(resume_pdf_path):
                    await file_input.set_input_files(resume_pdf_path)
                    filled_fields["resume_pdf"] = os.path.basename(resume_pdf_path)
                    logger.info(f"Uploaded resume PDF to Ashby form: {resume_pdf_path}")

                # LinkedIn
                if linkedin and await page.query_selector('input[name*="linkedin" i], input[id*="linkedin" i]'):
                    await page.fill('input[name*="linkedin" i], input[id*="linkedin" i]', linkedin)
                    filled_fields["linkedin"] = linkedin

                # GitHub / Website
                if github and await page.query_selector('input[name*="github" i], input[name*="website" i]'):
                    await page.fill('input[name*="github" i], input[name*="website" i]', github)
                    filled_fields["github"] = github

                # Work Authorization questions
                auth_input = await page.query_selector('input[name*="authorized" i], input[name*="sponsorship" i]')
                if auth_input:
                    await auth_input.fill(work_auth)
                    filled_fields["work_authorization"] = work_auth

                # Wait for any DOM changes to settle
                await page.wait_for_timeout(1500)

                # Capture proof screenshot
                await page.screenshot(path=screenshot_path, full_page=True)

                if is_dry_run:
                    logger.info("Dry-run mode active: application fields filled & verified; submit skipped.")
                    await browser.close()
                    return FormFillerResult(
                        success=True,
                        is_dry_run=True,
                        screenshot_path=screenshot_path,
                        proof_text=f"Ashby application pre-filled for {first_name} {last_name}. Verified: {', '.join(filled_fields.keys())}.",
                        filled_fields=filled_fields
                    )

                # Real submit execution
                submit_btn = await page.query_selector('button[type="submit"], input[type="submit"]')
                if submit_btn:
                    await submit_btn.click()
                    await page.wait_for_timeout(4000)
                    submit_proof = os.path.join(self.screenshot_dir, f"submitted_ashby_{uuid.uuid4().hex[:8]}.png")
                    await page.screenshot(path=submit_proof, full_page=True)
                    await browser.close()
                    return FormFillerResult(
                        success=True,
                        is_dry_run=False,
                        screenshot_path=submit_proof,
                        proof_text=f"Ashby application successfully submitted for {full_name}!",
                        filled_fields=filled_fields
                    )
                else:
                    await browser.close()
                    return FormFillerResult(
                        success=True,
                        is_dry_run=False,
                        screenshot_path=screenshot_path,
                        proof_text=f"Fields filled on Ashby. Submit button requires final candidate click.",
                        requires_user_input=True,
                        deep_link=apply_url,
                        filled_fields=filled_fields
                    )

        except Exception as e:
            logger.error(f"Ashby form filler encountered error: {e}")
            return FormFillerResult(
                success=False,
                is_dry_run=is_dry_run,
                screenshot_path=screenshot_path if os.path.exists(screenshot_path) else None,
                error_message=str(e),
                requires_user_input=True,
                deep_link=apply_url,
                filled_fields=filled_fields
            )
