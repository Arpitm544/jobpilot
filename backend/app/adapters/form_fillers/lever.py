import os
import uuid
import logging
from typing import Dict, Any, Optional
from playwright.async_api import async_playwright

from app.adapters.form_fillers.base import BaseFormFiller, FormFillerResult

logger = logging.getLogger(__name__)


class LeverFormFiller(BaseFormFiller):
    """Playwright automated form filler for Lever ATS boards"""

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
        full_name = contact.get("full_name", "Alex Mercer")
        email = contact.get("email", "")
        phone = contact.get("phone", "")
        linkedin = contact.get("linkedin", "")
        github = contact.get("github", "")
        portfolio = contact.get("portfolio", "")

        experiences = candidate_data.get("experience", [])
        current_org = experiences[0].get("company", "Independent Engineer") if experiences else "Independent Engineer"

        screenshot_name = f"proof_lever_{uuid.uuid4().hex[:8]}.png"
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

                logger.info(f"Navigating to Lever apply URL: {apply_url}")
                await page.goto(apply_url, wait_until="domcontentloaded", timeout=25000)

                # Check for CAPTCHA
                content = await page.content()
                if "cf-turnstile" in content or "g-recaptcha" in content or "hcaptcha" in content:
                    logger.warning("CAPTCHA detected on Lever application.")
                    await page.screenshot(path=screenshot_path)
                    await browser.close()
                    return FormFillerResult(
                        success=False,
                        is_dry_run=is_dry_run,
                        screenshot_path=screenshot_path,
                        requires_user_input=True,
                        deep_link=apply_url,
                        error_message="CAPTCHA detected on Lever page. Manual candidate input required."
                    )

                # 1. Fill Name
                if await page.query_selector("input[name='name']"):
                    await page.fill("input[name='name']", full_name)
                    filled_fields["name"] = full_name

                # 2. Fill Email
                if await page.query_selector("input[name='email']"):
                    await page.fill("input[name='email']", email)
                    filled_fields["email"] = email

                # 3. Fill Phone
                if await page.query_selector("input[name='phone']"):
                    await page.fill("input[name='phone']", phone)
                    filled_fields["phone"] = phone

                # 4. Fill Current Organization
                if await page.query_selector("input[name='org']"):
                    await page.fill("input[name='org']", current_org)
                    filled_fields["current_company"] = current_org

                # 5. Fill Social URLs
                if linkedin and await page.query_selector("input[name*='urls[LinkedIn]']"):
                    await page.fill("input[name*='urls[LinkedIn]']", linkedin)
                    filled_fields["linkedin"] = linkedin

                if github and await page.query_selector("input[name*='urls[GitHub]']"):
                    await page.fill("input[name*='urls[GitHub]']", github)
                    filled_fields["github"] = github

                if portfolio and await page.query_selector("input[name*='urls[Portfolio]'], input[name*='urls[Other]']"):
                    await page.fill("input[name*='urls[Portfolio]'], input[name*='urls[Other]']", portfolio)
                    filled_fields["portfolio"] = portfolio

                # 6. Upload Resume
                resume_input = await page.query_selector("input[type='file'][name='resume'], input#resume-upload-input")
                if resume_input and os.path.exists(resume_pdf_path):
                    await resume_input.set_input_files(resume_pdf_path)
                    filled_fields["resume_uploaded"] = os.path.basename(resume_pdf_path)

                # 7. Additional Comments / Cover Letter
                if cover_letter and await page.query_selector("textarea[name='comments']"):
                    await page.fill("textarea[name='comments']", cover_letter)
                    filled_fields["comments_cover_letter"] = True

                await page.wait_for_timeout(1000)

                # Capture Full-Page Proof Screenshot
                await page.screenshot(path=screenshot_path, full_page=True)

                if is_dry_run:
                    logger.info(f"Lever dry-run complete. Proof screenshot saved to {screenshot_path}")
                    await browser.close()
                    return FormFillerResult(
                        success=True,
                        is_dry_run=True,
                        screenshot_path=screenshot_path,
                        proof_text=f"Dry-run successful on Lever form. Filled {len(filled_fields)} candidate fields.",
                        filled_fields=filled_fields
                    )
                else:
                    submit_btn = await page.query_selector("#btn-submit, button[type='submit']")
                    if submit_btn:
                        await submit_btn.click()
                        await page.wait_for_timeout(3000)
                        await page.screenshot(path=screenshot_path, full_page=True)
                    await browser.close()
                    return FormFillerResult(
                        success=True,
                        is_dry_run=False,
                        screenshot_path=screenshot_path,
                        proof_text="Application successfully submitted on Lever.",
                        filled_fields=filled_fields
                    )
        except Exception as e:
            logger.error(f"Error executing Lever form filling: {e}", exc_info=True)
            return FormFillerResult(
                success=False,
                is_dry_run=is_dry_run,
                error_message=str(e),
                deep_link=apply_url
            )
