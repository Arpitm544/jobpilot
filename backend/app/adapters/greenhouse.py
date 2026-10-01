import logging
import re
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import httpx
from bs4 import BeautifulSoup

from app.adapters.base import BaseATSAdapter

logger = logging.getLogger(__name__)


def clean_html(html_content: str) -> str:
    """Strips HTML tags to plain text while preserving paragraph breaks"""
    if not html_content:
        return ""
    try:
        soup = BeautifulSoup(html_content, "html.parser")
        return soup.get_text(separator="\n\n").strip()
    except Exception:
        # Regex fallback
        return re.sub(r"<[^>]+>", "\n", html_content).strip()


def detect_workplace_type(title: str, location: str, content: str) -> str:
    combined = f"{title} {location} {content}".lower()
    if "remote" in location.lower() or "remote" in title.lower():
        return "Remote"
    if "hybrid" in combined:
        return "Hybrid"
    if "remote" in combined:
        return "Remote"
    return "Onsite"


class GreenhouseAdapter(BaseATSAdapter):
    """Adapter for Greenhouse public job board API"""
    BASE_URL = "https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs?content=true"

    async def fetch_jobs(self, company_identifier: str) -> List[Dict[str, Any]]:
        url = self.BASE_URL.format(board_token=company_identifier.lower().strip())
        normalized_jobs: List[Dict[str, Any]] = []

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(url)
                if res.status_code == 404:
                    logger.warning(f"Greenhouse board '{company_identifier}' not found.")
                    return []
                res.raise_for_status()
                data = res.json()
        except Exception as e:
            logger.error(f"Error fetching Greenhouse jobs for '{company_identifier}': {e}")
            return []

        jobs_list = data.get("jobs", [])
        for item in jobs_list:
            job_id = str(item.get("id"))
            title = item.get("title", "").strip()
            loc_data = item.get("location", {})
            location_str = loc_data.get("name", "Remote").strip() if isinstance(loc_data, dict) else str(loc_data)
            
            raw_content = item.get("content", "")
            jd_text = clean_html(raw_content)
            
            # Detect workplace type
            workplace_type = detect_workplace_type(title, location_str, jd_text)
            
            # Posted date
            posted_date_str = item.get("updated_at")
            posted_date = None
            if posted_date_str:
                try:
                    posted_date = datetime.fromisoformat(posted_date_str.replace("Z", "+00:00"))
                    if posted_date.tzinfo is not None:
                        posted_date = posted_date.astimezone(timezone.utc).replace(tzinfo=None)
                except Exception:
                    posted_date = datetime.now(timezone.utc).replace(tzinfo=None)
            else:
                posted_date = datetime.now(timezone.utc).replace(tzinfo=None)

            apply_url = item.get("absolute_url") or f"https://boards.greenhouse.io/{company_identifier}/jobs/{job_id}"

            # Detect salary range if present in content
            salary_match = re.search(r"(\$\d{2,3}(?:,\d{3})*(?:\s*-\s*\$\d{2,3}(?:,\d{3})*)?)", jd_text)
            salary_range = salary_match.group(1) if salary_match else None

            normalized_jobs.append({
                "external_id": job_id,
                "company_name": company_identifier.replace("-", " ").title(),
                "title": title,
                "location": location_str or "Remote",
                "workplace_type": workplace_type,
                "job_type": "Full-time",
                "salary_range": salary_range,
                "jd_text": jd_text or title,
                "apply_url": apply_url,
                "ats_type": "greenhouse",
                "posted_date": posted_date or datetime.now(timezone.utc),
            })

        return normalized_jobs
