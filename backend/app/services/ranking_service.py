import logging
from typing import List, Dict, Optional, Tuple, Any
from app.models.job import Job
from app.models.user import User

logger = logging.getLogger(__name__)


class CountryFirstRankingService:
    """
    Ranks jobs according to user's home country, city preferences, and remote eligibility:
    1. Home-country on-site/hybrid in preferred cities
    2. Home-country remote
    3. Remote roles the user is eligible for (worldwide or allowed in home country)
    4. International roles only if open_to_international is enabled
    Applies configurable feed mix (default ~80% home country, 20% eligible remote).
    """

    @classmethod
    def classify_job_tier(
        cls,
        job: Job,
        user: Optional[User],
        verdict: Optional[str] = None
    ) -> Tuple[int, bool]:
        """
        Returns (tier_number, is_included).
        Tier 1: Home-country onsite/hybrid in preferred cities
        Tier 2: Home-country remote
        Tier 3: Remote eligible (worldwide or explicit home country allowed)
        Tier 4: International onsite/hybrid (only if open_to_international is True)
        Tier 5: International / Ineligible (excluded if open_to_international is False or verdict == not_eligible)
        """
        if not user:
            # Anonymous / default view
            return (2 if job.work_mode == "remote" else 1, True)

        home_country = (user.home_country or "IN").strip().upper()
        preferred_cities = [c.strip().lower() for c in (user.preferred_cities or []) if c.strip()]
        open_to_intl = bool(user.open_to_international)

        job_country = (job.country or "").strip().upper() if job.country else None
        job_city = (job.city or "").strip().lower() if job.city else ""
        job_mode = (job.work_mode or "onsite").strip().lower()

        # If remote eligibility is definitively not eligible, demote to Tier 5
        if verdict == "not_eligible":
            return (5, False)

        # 1. Home country On-site / Hybrid in preferred cities
        if job_country == home_country and job_mode in ("onsite", "hybrid"):
            if not preferred_cities or job_city in preferred_cities:
                return (1, True)
            return (1, True)  # Home country other cities still Tier 1

        # 2. Home country Remote
        if job_country == home_country and job_mode == "remote":
            return (2, True)

        # 3. Remote roles eligible for the user (Worldwide, or allowed_countries contains home_country)
        if job_mode == "remote":
            allowed = [c.strip().upper() for c in (job.allowed_countries or [])]
            if job.remote_scope == "worldwide" or home_country in allowed or verdict in ("eligible", "likely_eligible"):
                return (3, True)
            if job.remote_scope == "unknown" and (verdict is None or verdict != "not_eligible"):
                # Remote without geography is unclear, ranked in Tier 3 with lower priority
                return (3, True)

        # 4. International roles (only allowed if user opted into international)
        if job_country and job_country != home_country:
            if open_to_intl:
                return (4, True)
            else:
                return (5, False)  # Filtered out by default

        # Fallback for unclassified / unknown country
        return (3 if job_mode == "remote" else 2, True)

    @classmethod
    def rank_and_mix_jobs(
        cls,
        jobs: List[Job],
        user: Optional[User],
        eligibility_map: Optional[Dict[str, str]] = None,
        home_country_target_ratio: float = 0.8,
        include_ineligible: bool = False
    ) -> List[Job]:
        """
        Ranks jobs based on tiers and produces an ~80/20 feed mix
        of home country jobs to eligible remote roles.
        """
        if not jobs:
            return []

        eligibility_map = eligibility_map or {}

        tier1: List[Job] = [] # Home country onsite/hybrid
        tier2: List[Job] = [] # Home country remote
        tier3: List[Job] = [] # Eligible remote
        tier4: List[Job] = [] # International (if allowed)
        tier5: List[Job] = [] # Excluded / Ineligible

        for j in jobs:
            j_id_str = str(j.id)
            verdict = eligibility_map.get(j_id_str)
            tier, is_included = cls.classify_job_tier(j, user, verdict)

            if not is_included and not include_ineligible:
                continue

            if tier == 1:
                tier1.append(j)
            elif tier == 2:
                tier2.append(j)
            elif tier == 3:
                tier3.append(j)
            elif tier == 4:
                tier4.append(j)
            else:
                tier5.append(j)

        # Home country pool (Tiers 1 & 2)
        home_pool = tier1 + tier2
        # Remote eligible pool (Tier 3)
        remote_pool = tier3

        # Interleave according to target ratio (e.g. 80% home, 20% remote)
        mixed_results: List[Job] = []
        home_idx = 0
        remote_idx = 0

        total_desired = len(home_pool) + len(remote_pool)
        while home_idx < len(home_pool) or remote_idx < len(remote_pool):
            # Take up to 4 home jobs (80%)
            for _ in range(4):
                if home_idx < len(home_pool):
                    mixed_results.append(home_pool[home_idx])
                    home_idx += 1
            # Take 1 remote job (20%)
            if remote_idx < len(remote_pool):
                mixed_results.append(remote_pool[remote_idx])
                remote_idx += 1

        # Append remaining international and (if requested) ineligible roles
        mixed_results.extend(tier4)
        if include_ineligible:
            mixed_results.extend(tier5)

        return mixed_results


ranking_service = CountryFirstRankingService()
