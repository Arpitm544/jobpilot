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


class LeverAdapter(BaseATSAdapter):
    """Adapter for Lever public postings API"""
    BASE_URL = "https://api.lever.co/v0/postings/{company}?mode=json"

    async def fetch_jobs(self, company_identifier: str) -> List[Dict[str, Any]]:
        url = self.BASE_URL.format(company=company_identifier.lower().strip())
        normalized_jobs: List[Dict[str, Any]] = []

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(url)
                if res.status_code == 404:
                    logger.warning(f"Lever board '{company_identifier}' not found.")
                    return []
                res.raise_for_status()
                data = res.json()
        except Exception as e:
            logger.error(f"Error fetching Lever jobs for '{company_identifier}': {e}")
            return []

        for item in data:
            job_id = item.get("id", "")
            title = item.get("text", "").strip()
            cats = item.get("categories", {})
            location_str = cats.get("location", "Remote") or "Remote"
            commitment = cats.get("commitment", "Full-time") or "Full-time"
            workplace_type = cats.get("workplaceType", "Remote")
            if not workplace_type:
                workplace_type = "Remote" if "remote" in location_str.lower() else "Onsite"

            # Combine description and lists
            desc_parts = []
            if item.get("descriptionPlain"):
                desc_parts.append(item["descriptionPlain"])
            elif item.get("description"):
                desc_parts.append(clean_html(item["description"]))

            for section in item.get("lists", []):
                sec_text = section.get("text", "")
                content_html = section.get("content", "")
                desc_parts.append(f"\n{sec_text}:\n{clean_html(content_html)}")

            if item.get("additionalPlain"):
                desc_parts.append(f"\nAdditional:\n{item['additionalPlain']}")

            full_jd_text = "\n\n".join(desc_parts).strip() or title
            apply_url = item.get("applyUrl") or item.get("hostedUrl") or f"https://jobs.lever.co/{company_identifier}/{job_id}"

            # Created date
            created_at_ts = item.get("createdAt")
            posted_date = None
            if created_at_ts:
                try:
                    posted_date = datetime.fromtimestamp(created_at_ts / 1000.0, tz=timezone.utc)
                except Exception:
                    posted_date = datetime.now(timezone.utc)

            # Salary extraction
            salary_range = None
            salary_match = re.search(r"(\$\d{2,3}(?:,\d{3})*(?:\s*-\s*\$\d{2,3}(?:,\d{3})*)?)", full_jd_text)
            if salary_match:
                salary_range = salary_match.group(1)

            normalized_jobs.append({
                "external_id": job_id,
                "company_name": company_identifier.replace("-", " ").title(),
                "title": title,
                "location": location_str,
                "workplace_type": workplace_type.title(),
                "job_type": commitment,
                "salary_range": salary_range,
                "jd_text": full_jd_text,
                "apply_url": apply_url,
                "ats_type": "lever",
                "posted_date": posted_date or datetime.now(timezone.utc),
            })

        return normalized_jobs
