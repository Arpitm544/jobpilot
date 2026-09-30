from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from datetime import datetime


class BaseATSAdapter(ABC):
    """Abstract Base Class for ATS Public Feed Adapters"""

    @abstractmethod
    async def fetch_jobs(self, company_identifier: str) -> List[Dict[str, Any]]:
        """
        Fetches and returns normalized job postings for a given company/board.
        Must return list of dicts with:
        - external_id: str
        - company_name: str
        - title: str
        - location: str
        - workplace_type: str ('Remote', 'Hybrid', 'Onsite')
        - job_type: str ('Full-time', 'Internship', 'Contract', etc.)
        - salary_range: Optional[str]
        - jd_text: str (clean HTML/plain text)
        - apply_url: str
        - ats_type: str
        - posted_date: Optional[datetime]
        """
        pass
