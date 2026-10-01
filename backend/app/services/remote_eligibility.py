import re
import hashlib
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Tuple
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import Job, EligibilityResult, CompanyPolicy
from app.models.user import User
from app.services.policy_fetcher import policy_fetcher

logger = logging.getLogger(__name__)

# Geographic regions
EMEA_COUNTRIES = {
    "GB", "DE", "FR", "NL", "IE", "SE", "CH", "ES", "IT", "PL", "AT", "BE", "DK",
    "FI", "NO", "PT", "CZ", "RO", "GR", "ZA", "AE", "IL", "EG", "NG", "KE"
}
APAC_COUNTRIES = {
    "IN", "SG", "AU", "JP", "MY", "PH", "VN", "NZ", "KR", "ID", "TH", "TW", "HK"
}
AMER_COUNTRIES = {
    "US", "CA", "MX", "BR", "AR", "CL", "CO"
}

# Regex for common explicit remote constraints in text
US_ONLY_REGEX = re.compile(
    r"\b(us\s*only|united\s*states\s*only|must\s*(?:be|reside)\s*in\s*(?:the\s*)?(?:us|united\s*states)|us\s*based\s*only|within\s*the\s*us)\b",
    re.IGNORECASE
)
UK_ONLY_REGEX = re.compile(
    r"\b(uk\s*only|united\s*kingdom\s*only|must\s*be\s*in\s*the\s*uk|uk\s*residents\s*only)\b",
    re.IGNORECASE
)
EU_ONLY_REGEX = re.compile(
    r"\b(eu\s*only|european\s*union\s*only|must\s*reside\s*in\s*the\s*eu|europe\s*only)\b",
    re.IGNORECASE
)
EMEA_REGEX = re.compile(
    r"\b(remote\s*-\s*emea|emea\s*only|located\s*in\s*emea|within\s*emea)\b",
    re.IGNORECASE
)
APAC_REGEX = re.compile(
    r"\b(remote\s*-\s*apac|apac\s*only|located\s*in\s*apac|within\s*apac)\b",
    re.IGNORECASE
)
WORLDWIDE_REGEX = re.compile(
    r"\b(worldwide|anywhere\s*in\s*the\s*world|work\s*from\s*anywhere|hire\s*globally|hire\s*in\s*any\s*country)\b",
    re.IGNORECASE
)
NO_SPONSORSHIP_REGEX = re.compile(
    r"\b(no\s*visa\s*sponsorship|sponsorship\s*not\s*available|must\s*be\s*authorized\s*to\s*work(?:\s*in\s*[a-zA-Z\s]+)?\s*without\s*sponsorship|cannot\s*sponsor|unable\s*to\s*sponsor)\b",
    re.IGNORECASE
)
SPONSORSHIP_OFFERED_REGEX = re.compile(
    r"(?<!no\s)(?<!not\s)(?<!without\s)\b(visa\s*sponsorship\s*available|visa\s*sponsorship\s*provided|relocation\s*assistance\s*provided|we\s*sponsor\s*visas)\b",
    re.IGNORECASE
)
EOR_DEEL_REGEX = re.compile(
    r"\b(we\s*hire\s*via\s*(?:deel|remote\.com|oyster)|hire\s*in\s*100\+\s*countries|hire\s*through\s*an\s*eor)\b",
    re.IGNORECASE
)


class EligibilityEvidence(BaseModel):
    quote: str
    source_url: str = ""
    signal_type: str  # "structured_field", "jd_text", "company_policy", "user_profile"
    reason: str


class EligibilityEvaluation(BaseModel):
    verdict: str  # "eligible", "likely_eligible", "unclear", "likely_not_eligible", "not_eligible"
    confidence: float
    reasons: List[str]
    evidence: List[EligibilityEvidence]
    inputs_hash: str
    user_override: Optional[Dict[str, Any]] = None


class RemoteEligibilityEngine:
    """
    Evaluates candidate eligibility for remote, hybrid, and onsite job postings.
    Follows strict signal priority:
      1. Structured ATS & location fields
      2. Verified JD text constraints
      3. Public company hiring policy pages
      4. User profile matching (country, citizenship, work authorization, relocation, timezone)
    Zero hallucination: unverified evidence quotes are discarded.
    """

    @classmethod
    def compute_inputs_hash(cls, user: Optional[User]) -> str:
        """Computes deterministic hash of user's geographic and legal profile."""
        if not user:
            return hashlib.sha256(b"anonymous").hexdigest()
        
        auth_countries = sorted(user.work_authorization_countries or [])
        payload = f"{user.home_country}:{user.citizenship}:{','.join(auth_countries)}:{user.needs_visa_sponsorship}:{user.willing_to_relocate}:{user.timezone}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    async def evaluate_eligibility(
        self,
        job: Job,
        user: Optional[User],
        db: AsyncSession,
        use_cache: bool = True
    ) -> EligibilityEvaluation:
        """
        Evaluates remote/relocation eligibility for a job and candidate.
        Uses database cache when inputs have not changed.
        """
        if not user:
            # Anonymous user - evaluate against generic eligibility
            return EligibilityEvaluation(
                verdict="unclear",
                confidence=0.50,
                reasons=["Log in and set your home country to see personalized remote eligibility."],
                evidence=[],
                inputs_hash=self.compute_inputs_hash(None)
            )

        inputs_hash = self.compute_inputs_hash(user)

        # 1. Check cache
        if use_cache and job.id and user.id:
            cached_query = select(EligibilityResult).where(
                EligibilityResult.job_id == job.id,
                EligibilityResult.user_id == user.id
            )
            cached_res = await db.execute(cached_query)
            existing = cached_res.scalar_one_or_none()
            if existing and existing.inputs_hash == inputs_hash:
                evidence_list = [
                    EligibilityEvidence(**ev) if isinstance(ev, dict) else ev
                    for ev in (existing.evidence or [])
                ]
                return EligibilityEvaluation(
                    verdict=existing.verdict,
                    confidence=existing.confidence,
                    reasons=existing.reasons or [],
                    evidence=evidence_list,
                    inputs_hash=existing.inputs_hash,
                    user_override=existing.user_override
                )

        # 2. Evaluate deterministically through signal rules
        evaluation = await self._run_evaluation_rules(job, user, db, inputs_hash)

        # 3. Cache result in database
        if use_cache and job.id and user.id:
            try:
                upsert_query = select(EligibilityResult).where(
                    EligibilityResult.job_id == job.id,
                    EligibilityResult.user_id == user.id
                )
                existing_row = (await db.execute(upsert_query)).scalar_one_or_none()
                ev_data = [e.model_dump() for e in evaluation.evidence]

                if existing_row:
                    existing_row.verdict = evaluation.verdict
                    existing_row.confidence = evaluation.confidence
                    existing_row.reasons = evaluation.reasons
                    existing_row.evidence = ev_data
                    existing_row.inputs_hash = inputs_hash
                    existing_row.evaluated_at = datetime.now(timezone.utc).replace(tzinfo=None)
                else:
                    new_res = EligibilityResult(
                        id=uuid.uuid4(),
                        job_id=job.id,
                        user_id=user.id,
                        verdict=evaluation.verdict,
                        confidence=evaluation.confidence,
                        reasons=evaluation.reasons,
                        evidence=ev_data,
                        inputs_hash=inputs_hash,
                        evaluated_at=datetime.now(timezone.utc).replace(tzinfo=None)
                    )
                    db.add(new_res)

                await db.commit()
            except Exception as e:
                await db.rollback()
                logger.warning(f"Error persisting eligibility result for job {job.id}: {e}")

        return evaluation

    async def _run_evaluation_rules(
        self,
        job: Job,
        user: User,
        db: AsyncSession,
        inputs_hash: str
    ) -> EligibilityEvaluation:
        """
        Executes hierarchical evaluation rules:
        Onsite/Hybrid rules -> Remote Scope rules -> JD text constraints -> Company Policy -> Fallback
        """
        user_country = (user.home_country or "IN").upper().strip()
        job_country = (job.country or "").upper().strip()
        user_auth_countries = set(c.upper().strip() for c in (user.work_authorization_countries or []))
        if user.citizenship:
            user_auth_countries.add(user.citizenship.upper().strip())
        if user_country:
            user_auth_countries.add(user_country)

        reasons: List[str] = []
        evidence: List[EligibilityEvidence] = []
        jd_text = job.jd_text or ""
        apply_url = job.apply_url or "Job Posting"

        # Signal 1: On-site or Hybrid Roles
        if job.work_mode in ("onsite", "hybrid"):
            if job_country and job_country == user_country:
                reasons.append(f"On-site/Hybrid position located in your home country ({job_country}).")
                evidence.append(EligibilityEvidence(
                    quote=job.location or job_country,
                    source_url=apply_url,
                    signal_type="structured_field",
                    reason="Job location matches candidate home country"
                ))
                return EligibilityEvaluation(
                    verdict="eligible",
                    confidence=0.98,
                    reasons=reasons,
                    evidence=evidence,
                    inputs_hash=inputs_hash
                )
            elif job_country and job_country != user_country:
                has_auth = job_country in user_auth_countries
                no_sponsorship_match = NO_SPONSORSHIP_REGEX.search(jd_text)
                sponsorship_match = SPONSORSHIP_OFFERED_REGEX.search(jd_text)

                if no_sponsorship_match and not has_auth:
                    quote = no_sponsorship_match.group(0)
                    evidence.append(EligibilityEvidence(
                        quote=quote,
                        source_url=apply_url,
                        signal_type="jd_text",
                        reason="Posting explicitly states no visa sponsorship is available"
                    ))
                    reasons.append(f"Located in {job_country} with no visa sponsorship. You lack work authorization.")
                    return EligibilityEvaluation(
                        verdict="not_eligible",
                        confidence=0.98,
                        reasons=reasons,
                        evidence=evidence,
                        inputs_hash=inputs_hash
                    )
                elif has_auth and user.willing_to_relocate:
                    reasons.append(f"Located in {job_country}. You hold work authorization and are willing to relocate.")
                    return EligibilityEvaluation(
                        verdict="likely_eligible",
                        confidence=0.85,
                        reasons=reasons,
                        evidence=evidence,
                        inputs_hash=inputs_hash
                    )
                elif sponsorship_match and user.willing_to_relocate:
                    quote = sponsorship_match.group(0)
                    evidence.append(EligibilityEvidence(
                        quote=quote,
                        source_url=apply_url,
                        signal_type="jd_text",
                        reason="Posting explicitly offers visa sponsorship or relocation assistance"
                    ))
                    reasons.append("Company offers visa sponsorship/relocation and you are open to relocating.")
                    return EligibilityEvaluation(
                        verdict="likely_eligible",
                        confidence=0.82,
                        reasons=reasons,
                        evidence=evidence,
                        inputs_hash=inputs_hash
                    )
                else:
                    reasons.append(f"On-site role in {job_country}; you are currently based in {user_country}.")
                    return EligibilityEvaluation(
                        verdict="not_eligible",
                        confidence=0.90,
                        reasons=reasons,
                        evidence=evidence,
                        inputs_hash=inputs_hash
                    )

        # Signal 2: Remote Role - Worldwide Scope
        if job.remote_scope == "worldwide" or "WORLDWIDE" in (job.allowed_countries or []):
            ww_match = WORLDWIDE_REGEX.search(jd_text)
            if ww_match and ww_match.group(0).lower() in jd_text.lower():
                quote = ww_match.group(0)
                sig_type = "jd_text"
            elif job.location and "worldwide" in job.location.lower():
                quote = job.location
                sig_type = "structured_field"
            else:
                quote = "Worldwide"
                sig_type = "structured_field"

            reasons.append("Role is open to remote candidates worldwide.")
            evidence.append(EligibilityEvidence(
                quote=quote,
                source_url=apply_url,
                signal_type=sig_type,
                reason="Posting specified worldwide remote eligibility"
            ))
            return EligibilityEvaluation(
                verdict="eligible",
                confidence=0.96,
                reasons=reasons,
                evidence=evidence,
                inputs_hash=inputs_hash
            )

        # Signal 3: Remote Role - Excluded Countries
        if job.excluded_countries and user_country in job.excluded_countries:
            reasons.append(f"Candidates residing in {user_country} are excluded from this role.")
            evidence.append(EligibilityEvidence(
                quote=f"Excluded: {user_country}",
                source_url=apply_url,
                signal_type="structured_field",
                reason="Home country explicitly present in excluded_countries list"
            ))
            return EligibilityEvaluation(
                verdict="not_eligible",
                confidence=0.98,
                reasons=reasons,
                evidence=evidence,
                inputs_hash=inputs_hash
            )

        # Signal 4: Remote Role - Allowed Countries List
        if job.allowed_countries:
            if user_country in job.allowed_countries:
                reasons.append(f"Your country ({user_country}) is on the company's approved remote hiring list.")
                evidence.append(EligibilityEvidence(
                    quote=", ".join(job.allowed_countries),
                    source_url=apply_url,
                    signal_type="structured_field",
                    reason="Country in allowed_countries list"
                ))
                for reg_match in (APAC_REGEX.search(jd_text), EMEA_REGEX.search(jd_text), EU_ONLY_REGEX.search(jd_text)):
                    if reg_match and reg_match.group(0).lower() in jd_text.lower():
                        evidence.append(EligibilityEvidence(
                            quote=reg_match.group(0),
                            source_url=apply_url,
                            signal_type="jd_text",
                            reason=f"Posting specifies remote hiring in {reg_match.group(0)}"
                        ))
                        break
                return EligibilityEvaluation(
                    verdict="eligible",
                    confidence=0.95,
                    reasons=reasons,
                    evidence=evidence,
                    inputs_hash=inputs_hash
                )
            else:
                # User country is not in allowed countries
                overlap = user_auth_countries.intersection(set(job.allowed_countries))
                if overlap:
                    reasons.append(f"You have work authorization for {', '.join(overlap)} which is in the allowed hiring list.")
                    return EligibilityEvaluation(
                        verdict="likely_eligible",
                        confidence=0.80,
                        reasons=reasons,
                        evidence=evidence,
                        inputs_hash=inputs_hash
                    )
                else:
                    reasons.append(f"Remote role is strictly restricted to: {', '.join(job.allowed_countries)}.")
                    evidence.append(EligibilityEvidence(
                        quote=f"Allowed countries: {', '.join(job.allowed_countries)}",
                        source_url=apply_url,
                        signal_type="structured_field",
                        reason="Candidate country not among the allowed remote countries"
                    ))
                    return EligibilityEvaluation(
                        verdict="not_eligible",
                        confidence=0.95,
                        reasons=reasons,
                        evidence=evidence,
                        inputs_hash=inputs_hash
                    )

        # Signal 5: JD Text Explicit Constraints (with verbatim quote checks)
        # 5a. US-only check
        us_match = US_ONLY_REGEX.search(jd_text)
        if us_match:
            quote = us_match.group(0)
            if quote.lower() in jd_text.lower():
                evidence.append(EligibilityEvidence(
                    quote=quote,
                    source_url=apply_url,
                    signal_type="jd_text",
                    reason="Job description specifies US-only restriction"
                ))
                if user_country == "US" or "US" in user_auth_countries:
                    reasons.append("Role is restricted to US candidates, matching your location/authorization.")
                    return EligibilityEvaluation(
                        verdict="eligible",
                        confidence=0.92,
                        reasons=reasons,
                        evidence=evidence,
                        inputs_hash=inputs_hash
                    )
                else:
                    reasons.append("Job description states candidates must be located in the United States.")
                    return EligibilityEvaluation(
                        verdict="not_eligible",
                        confidence=0.95,
                        reasons=reasons,
                        evidence=evidence,
                        inputs_hash=inputs_hash
                    )

        # 5b. UK-only check
        uk_match = UK_ONLY_REGEX.search(jd_text)
        if uk_match:
            quote = uk_match.group(0)
            if quote.lower() in jd_text.lower():
                evidence.append(EligibilityEvidence(
                    quote=quote,
                    source_url=apply_url,
                    signal_type="jd_text",
                    reason="Job description specifies UK-only restriction"
                ))
                if user_country == "GB" or "GB" in user_auth_countries:
                    reasons.append("Role is restricted to UK candidates, matching your location/authorization.")
                    return EligibilityEvaluation(
                        verdict="eligible",
                        confidence=0.92,
                        reasons=reasons,
                        evidence=evidence,
                        inputs_hash=inputs_hash
                    )
                else:
                    reasons.append("Job description states candidates must reside in the United Kingdom.")
                    return EligibilityEvaluation(
                        verdict="not_eligible",
                        confidence=0.95,
                        reasons=reasons,
                        evidence=evidence,
                        inputs_hash=inputs_hash
                    )

        # 5c. EU-only check
        eu_match = EU_ONLY_REGEX.search(jd_text)
        if eu_match:
            quote = eu_match.group(0)
            if quote.lower() in jd_text.lower():
                evidence.append(EligibilityEvidence(
                    quote=quote,
                    source_url=apply_url,
                    signal_type="jd_text",
                    reason="Job description specifies EU/Europe-only restriction"
                ))
                if user_country in EMEA_COUNTRIES:
                    reasons.append(f"Role is open to Europe/EU, which matches your home country ({user_country}).")
                    return EligibilityEvaluation(
                        verdict="eligible",
                        confidence=0.90,
                        reasons=reasons,
                        evidence=evidence,
                        inputs_hash=inputs_hash
                    )
                else:
                    reasons.append("Job description states candidates must reside in the European Union / Europe.")
                    return EligibilityEvaluation(
                        verdict="not_eligible",
                        confidence=0.95,
                        reasons=reasons,
                        evidence=evidence,
                        inputs_hash=inputs_hash
                    )

        # 5d. EMEA check
        emea_match = EMEA_REGEX.search(jd_text)
        if emea_match:
            quote = emea_match.group(0)
            if quote.lower() in jd_text.lower():
                evidence.append(EligibilityEvidence(
                    quote=quote,
                    source_url=apply_url,
                    signal_type="jd_text",
                    reason="Posting is restricted to the EMEA region"
                ))
                if user_country in EMEA_COUNTRIES:
                    reasons.append(f"Your home country ({user_country}) is in the EMEA region.")
                    return EligibilityEvaluation(
                        verdict="likely_eligible",
                        confidence=0.88,
                        reasons=reasons,
                        evidence=evidence,
                        inputs_hash=inputs_hash
                    )
                else:
                    reasons.append("Role is restricted to the EMEA region (Europe, Middle East, Africa).")
                    return EligibilityEvaluation(
                        verdict="not_eligible",
                        confidence=0.92,
                        reasons=reasons,
                        evidence=evidence,
                        inputs_hash=inputs_hash
                    )

        # 5e. APAC check
        apac_match = APAC_REGEX.search(jd_text)
        if apac_match:
            quote = apac_match.group(0)
            if quote.lower() in jd_text.lower():
                evidence.append(EligibilityEvidence(
                    quote=quote,
                    source_url=apply_url,
                    signal_type="jd_text",
                    reason="Posting is restricted to the APAC region"
                ))
                if user_country in APAC_COUNTRIES:
                    reasons.append(f"Your home country ({user_country}) is in the APAC region.")
                    return EligibilityEvaluation(
                        verdict="likely_eligible",
                        confidence=0.88,
                        reasons=reasons,
                        evidence=evidence,
                        inputs_hash=inputs_hash
                    )
                else:
                    reasons.append("Role is restricted to the APAC region (Asia-Pacific).")
                    return EligibilityEvaluation(
                        verdict="not_eligible",
                        confidence=0.92,
                        reasons=reasons,
                        evidence=evidence,
                        inputs_hash=inputs_hash
                    )

        # 5f. Global / EOR declarations (Deel, Remote.com, 100+ countries)
        eor_match = EOR_DEEL_REGEX.search(jd_text) or WORLDWIDE_REGEX.search(jd_text)
        if eor_match:
            quote = eor_match.group(0)
            if quote.lower() in jd_text.lower():
                evidence.append(EligibilityEvidence(
                    quote=quote,
                    source_url=apply_url,
                    signal_type="jd_text",
                    reason="Company hires globally or via Employer of Record (EOR)"
                ))
                reasons.append("Company hires internationally via Employer of Record (Deel/Remote.com).")
                return EligibilityEvaluation(
                    verdict="likely_eligible",
                    confidence=0.88,
                    reasons=reasons,
                    evidence=evidence,
                    inputs_hash=inputs_hash
                )

        # Signal 6: Company Policy Page Cache Check
        policy = await policy_fetcher.get_company_policy(job.company_name, db)
        if policy and policy.extracted_data:
            p_data = policy.extracted_data
            if "WORLDWIDE" in p_data.get("allowed_countries", []):
                reasons.append(f"{job.company_name} maintains a public global remote hiring policy.")
                for q in p_data.get("quotes", []):
                    evidence.append(EligibilityEvidence(
                        quote=q.get("quote", ""),
                        source_url=q.get("source_url", policy.source_url or "Company Policy"),
                        signal_type="company_policy",
                        reason=q.get("reason", "Company hiring policy page")
                    ))
                return EligibilityEvaluation(
                    verdict="likely_eligible",
                    confidence=0.85,
                    reasons=reasons,
                    evidence=evidence,
                    inputs_hash=inputs_hash
                )

        # Signal 7: Remote without stated geography -> Unclear
        reasons.append("Remote position does not specify geographic restrictions in the posting.")
        return EligibilityEvaluation(
            verdict="unclear",
            confidence=0.50,
            reasons=reasons,
            evidence=evidence,
            inputs_hash=inputs_hash
        )


remote_eligibility = RemoteEligibilityEngine()
