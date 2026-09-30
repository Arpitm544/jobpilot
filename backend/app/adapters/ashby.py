import logging
import re
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import httpx
from bs4 import BeautifulSoup

from app.adapters.base import BaseATSAdapter

logger = logging.getLogger(__name__)


def clean_html(html_content: str) -> str:
    if not html_content:
        return ""
    try:
        soup = BeautifulSoup(html_content, "html.parser")
        return soup.get_text(separator="\n\n").strip()
    except Exception:
        return re.sub(r"<[^>]+>", "\n", html_content).strip()


class AshbyAdapter(BaseATSAdapter):
    """Adapter for Ashby public postings API"""
    BASE_URL = "https://api.ashbyhq.com/posting-api/job-board/{organization}"

    async def fetch_jobs(self, company_identifier: str) -> List[Dict[str, Any]]:
        url = self.BASE_URL.format(organization=company_identifier.lower().strip())
        normalized_jobs: List[Dict[str, Any]] = []

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(url)
                if res.status_code == 404:
                    logger.warning(f"Ashby board '{company_identifier}' not found.")
                    return []
                res.raise_for_status()
                data = res.json()
        except Exception as e:
            logger.error(f"Error fetching Ashby jobs for '{company_identifier}': {e}")
            return []

        jobs_list = data.get("jobs", [])
        for item in jobs_list:
            job_id = item.get("id", "")
            title = item.get("title", "").strip()
            location_str = item.get("location", "Remote") or "Remote"
            is_remote = item.get("isRemote", True)
            workplace_type = "Remote" if is_remote else "Onsite"
            employment_type = item.get("employmentType", "FullTime") or "Full-time"

            raw_desc = item.get("descriptionHtml", "")
            jd_text = clean_html(raw_desc) or title

            apply_url = item.get("jobUrl") or f"https://jobs.ashbyhq.com/{company_identifier}/{job_id}"

            # Published date
            pub_date_str = item.get("publishedAt")
            posted_date = None
            if pub_date_str:
                try:
                    posted_date = datetime.fromisoformat(pub_date_str.replace("Z", "+00:00"))
                except Exception:
                    posted_date = datetime.now(timezone.utc)

            # Compensation
            comp = item.get("compensation", {})
            salary_range = None
            if comp and isinstance(comp, dict):
                min_v = comp.get("minValue")
                max_v = comp.get("maxValue")
                curr = comp.get("currency", "USD")
                if min_v and max_v:
                    salary_range = f"{curr} {min_v:,} - {max_v:,}"

            normalized_jobs.append({
                "external_id": job_id,
                "company_name": company_identifier.replace("-", " ").title(),
                "title": title,
                "location": location_str,
                "workplace_type": workplace_type,
                "job_type": employment_type,
                "salary_range": salary_range,
                "jd_text": jd_text,
                "apply_url": apply_url,
                "ats_type": "ashby",
                "posted_date": posted_date or datetime.now(timezone.utc),
            })

        return normalized_jobs
