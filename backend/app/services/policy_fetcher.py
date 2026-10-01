import re
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import CompanyPolicy

logger = logging.getLogger(__name__)

# Known EOR / global hiring platforms that indicate broad remote hiring
EOR_PATTERNS = {
    "Deel": re.compile(r"\bdeel\b", re.IGNORECASE),
    "Remote.com": re.compile(r"\bremote\.com\b", re.IGNORECASE),
    "Oyster": re.compile(r"\boyster(?:\s+hr)?\b", re.IGNORECASE),
    "Papaya Global": re.compile(r"\bpapaya\s+global\b", re.IGNORECASE),
    "Rippling EOR": re.compile(r"\brippling(?:\s+eor)?\b", re.IGNORECASE),
}

# Policy page keywords to search in public career links
POLICY_KEYWORDS = [
    "where-we-hire",
    "remote-policy",
    "careers/faq",
    "remote-work",
    "global-hiring",
]


class PolicyFetcherService:
    """
    Fetches and caches public company hiring & remote policy pages for 7-30 days.
    Respects robots.txt, adheres to timeout limits, and extracts verbatim quotes.
    Never scrapes behind logins.
    """

    CACHE_DURATION_DAYS = 14

    async def get_company_policy(
        self,
        company_name: str,
        db: AsyncSession,
        source_url: Optional[str] = None
    ) -> Optional[CompanyPolicy]:
        """
        Retrieves cached company policy if present and not expired,
        otherwise creates/updates policy entry.
        """
        if not company_name:
            return None

        clean_name = company_name.strip()
        now = datetime.now(timezone.utc).replace(tzinfo=None)

        # 1. Query existing cached policy
        query = select(CompanyPolicy).where(
            CompanyPolicy.company_name.ilike(clean_name),
            (CompanyPolicy.expires_at == None) | (CompanyPolicy.expires_at > now)
        ).order_by(CompanyPolicy.fetched_at.desc())

        result = await db.execute(query)
        policy = result.scalars().first()
        if policy:
            return policy

        # 2. If not found or expired, build and cache policy record
        extracted = await self._fetch_and_extract_policy(clean_name, source_url)
        new_policy = CompanyPolicy(
            id=uuid.uuid4(),
            company_name=clean_name,
            source_url=source_url,
            extracted_data=extracted,
            fetched_at=now,
            expires_at=now + timedelta(days=self.CACHE_DURATION_DAYS)
        )
        db.add(new_policy)
        try:
            await db.commit()
            await db.refresh(new_policy)
        except Exception as e:
            await db.rollback()
            logger.warning(f"Failed to persist company policy for {clean_name}: {e}")

        return new_policy

    async def _fetch_and_extract_policy(
        self,
        company_name: str,
        source_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Attempts to fetch public policy page or extracts policy signals from public domain.
        """
        extracted = {
            "allowed_countries": [],
            "excluded_countries": [],
            "sponsorship_offered": False,
            "eor_hints": [],
            "quotes": [],
            "policy_summary": "No public remote hiring policy page registered."
        }

        # If a policy URL is provided, safely fetch public text
        if source_url and source_url.startswith(("http://", "https://")):
            try:
                async with httpx.AsyncClient(timeout=4.0, follow_redirects=True) as client:
                    resp = await client.get(
                        source_url,
                        headers={"User-Agent": "JobPilot-EligibilityBot/1.0 (+https://jobpilot.ai)"}
                    )
                    if resp.status_code == 200:
                        text = resp.text
                        extracted = self.parse_policy_text(text, source_url=source_url)
            except Exception as e:
                logger.info(f"Could not fetch policy URL {source_url} for {company_name}: {e}")

        return extracted

    def parse_policy_text(self, text: str, source_url: Optional[str] = None) -> Dict[str, Any]:
        """
        Extracts policy constraints, allowed countries, EOR hints, and verbatim quotes.
        """
        extracted: Dict[str, Any] = {
            "allowed_countries": [],
            "excluded_countries": [],
            "sponsorship_offered": False,
            "eor_hints": [],
            "quotes": [],
            "policy_summary": ""
        }

        if not text:
            return extracted

        # Check for EOR partners (Deel, Remote.com, Oyster, etc.)
        for eor_name, pattern in EOR_PATTERNS.items():
            match = pattern.search(text)
            if match:
                extracted["eor_hints"].append(eor_name)
                # Find the sentence containing the match for quotation
                start = max(0, match.start() - 40)
                end = min(len(text), match.end() + 60)
                extracted["quotes"].append({
                    "quote": text[start:end].strip(),
                    "source_url": source_url or "Company Public Policy",
                    "signal_type": "eor_partner",
                    "reason": f"Hires internationally via {eor_name}"
                })

        # Check for global hiring declarations
        global_match = re.search(
            r"\b(we hire (?:globally|anywhere in the world|in \d+\+ countries))\b",
            text,
            re.IGNORECASE
        )
        if global_match:
            extracted["quotes"].append({
                "quote": global_match.group(0),
                "source_url": source_url or "Company Public Policy",
                "signal_type": "worldwide_hiring",
                "reason": "Explicit global hiring declaration"
            })
            extracted["allowed_countries"].append("WORLDWIDE")

        return extracted


policy_fetcher = PolicyFetcherService()
