import math
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Tuple, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import Job, JobMatch
from app.models.profile import MasterProfile
from app.models.preference import JobPreference
from app.schemas.tailor import JDParsedOutput
from app.services.gemini_service import gemini_service

logger = logging.getLogger(__name__)


def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """Calculates cosine similarity between two numeric vectors"""
    if not vec1 or not vec2 or len(vec1) != len(vec2):
        return 0.5
    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    norm_a = math.sqrt(sum(a * a for a, b in zip(vec1, vec2)))
    norm_b = math.sqrt(sum(b * b for a, b in zip(vec1, vec2)))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.5
    sim = dot_product / (norm_a * norm_b)
    # Clamp between 0.0 and 1.0
    return max(0.0, min(1.0, (sim + 1.0) / 2.0))


def extract_skills_heuristic(jd_text: str) -> JDParsedOutput:
    """Fallback heuristic extraction of JD skills when Gemini API is unconfigured"""
    tech_keywords = [
        "python", "javascript", "typescript", "react", "next.js", "node.js",
        "fastapi", "django", "flask", "postgresql", "mysql", "mongodb", "redis",
        "docker", "kubernetes", "aws", "gcp", "azure", "git", "linux", "graphql",
        "rest api", "ci/cd", "tailwind", "vue", "angular", "java", "c++", "go"
    ]
    jd_lower = jd_text.lower()
    found_skills = [k.capitalize() for k in tech_keywords if re.search(r"\b" + re.escape(k) + r"\b", jd_lower)]
    
    # Seniority heuristic
    seniority = "Mid"
    if any(w in jd_lower for w in ["intern", "internship"]):
        seniority = "Intern"
    elif any(w in jd_lower for w in ["junior", "fresher", "entry level", "new grad"]):
        seniority = "Junior"
    elif any(w in jd_lower for w in ["senior", "lead", "staff", "principal"]):
        seniority = "Senior"

    return JDParsedOutput(
        role_title="Software Engineer",
        seniority=seniority,
        required_skills=found_skills[:6] if found_skills else ["JavaScript", "Python"],
        nice_to_have_skills=found_skills[6:] if len(found_skills) > 6 else ["Docker", "AWS"],
        tech_stack=found_skills,
        core_responsibilities=["Build high-quality software solutions and web applications."],
        keywords=found_skills
    )


class ScoringService:
    async def parse_jd_with_ai(self, jd_text: str) -> JDParsedOutput:
        """Extract structured JD attributes using Gemini structured output with fallback"""
        prompt = (
            f"Analyze the following job description and extract structured technical requirements:\n\n"
            f"```text\n{jd_text[:4000]}\n```"
        )
        system_instruction = (
            "You are a technical recruiter. Extract the exact required skills, nice-to-haves, seniority, "
            "and tech stack into the schema provided."
        )

        parsed = await gemini_service.generate_structured(
            prompt=prompt,
            response_schema=JDParsedOutput,
            system_instruction=system_instruction
        )
        if not parsed:
            parsed = extract_skills_heuristic(jd_text)
        return parsed

    def extract_profile_skill_pool(self, profile: MasterProfile) -> Set[str]:
        """Aggregate all skills and keywords present in candidate's profile"""
        pool = set()
        # Direct skills
        skills_dict = profile.skills or {}
        for cat_list in skills_dict.values():
            if isinstance(cat_list, list):
                for s in cat_list:
                    pool.add(str(s).lower().strip())

        # Projects tech stack
        for proj in (profile.projects or []):
            if isinstance(proj, dict):
                for tech in proj.get("tech_stack", []):
                    pool.add(str(tech).lower().strip())

        # Experience & summary text tokens
        text_corpus = f"{profile.summary or ''} "
        for exp in (profile.experience or []):
            if isinstance(exp, dict):
                text_corpus += " ".join(exp.get("bullets", [])) + " "
        
        # Add matches of known keywords in text corpus
        corpus_lower = text_corpus.lower()
        for kw in ["python", "javascript", "typescript", "react", "next.js", "fastapi", "postgresql", "redis", "docker", "aws", "git", "rest", "sql"]:
            if kw in corpus_lower:
                pool.add(kw)

        return pool

    async def calculate_match(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        job: Job,
        profile: MasterProfile,
        preferences: JobPreference
    ) -> JobMatch:
        """
        Calculates Match Score (0 - 100) combining:
        - Skill overlap (45%)
        - Embedding semantic similarity (35%)
        - Experience level fit (10%)
        - Location fit (10%)
        """
        # 1. Parse JD if not already parsed
        if not job.jd_parsed_skills or not job.jd_parsed_skills.get("required_skills"):
            parsed_jd = await self.parse_jd_with_ai(job.jd_text)
            job.jd_parsed_skills = parsed_jd.model_dump()
            db.add(job)
        else:
            parsed_jd = JDParsedOutput(**job.jd_parsed_skills)

        # 2. Skill Overlap Calculation
        candidate_skills = self.extract_profile_skill_pool(profile)
        required = parsed_jd.required_skills or []
        
        matched_skills = []
        missing_skills = []

        for req in required:
            req_clean = req.lower().strip()
            # Match directly or sub-string
            if req_clean in candidate_skills or any(req_clean in cs or cs in req_clean for cs in candidate_skills):
                matched_skills.append(req)
            else:
                missing_skills.append(req)

        skill_overlap_ratio = len(matched_skills) / max(1, len(required))

        # 3. Embedding Semantic Similarity
        profile_text = f"{profile.summary or ''} Skills: {', '.join(candidate_skills)}"
        jd_summary = f"{job.title} at {job.company_name}. Required: {', '.join(required)}. {job.jd_text[:1000]}"
        
        vec_profile = await gemini_service.get_embedding(profile_text)
        vec_jd = await gemini_service.get_embedding(jd_summary)
        embedding_sim = cosine_similarity(vec_profile, vec_jd)

        # 4. Experience Level Fit
        user_level = (preferences.experience_level or "Junior").lower()
        jd_seniority = (parsed_jd.seniority or "Mid").lower()
        if user_level == jd_seniority:
            exp_fit = 1.0
        elif (user_level in ["junior", "fresher"] and jd_seniority in ["junior", "mid"]) or (user_level == "mid" and jd_seniority in ["junior", "senior"]):
            exp_fit = 0.8
        else:
            exp_fit = 0.5

        # 5. Location Fit
        loc_fit = 1.0
        if job.workplace_type == "Remote":
            loc_fit = 1.0
        else:
            user_locs = [l.lower() for l in (preferences.locations or [])]
            if any(l in job.location.lower() for l in user_locs) or "any" in user_locs:
                loc_fit = 0.9
            else:
                loc_fit = 0.6

        # Composite Score (0.0 to 100.0)
        final_score = round(
            (skill_overlap_ratio * 0.45 + embedding_sim * 0.35 + exp_fit * 0.10 + loc_fit * 0.10) * 100,
            1
        )
        final_score = max(10.0, min(99.0, final_score))

        # Match Rationale
        rationale_parts = [
            f"Matches {len(matched_skills)} of {len(required)} required technical skills ({int(skill_overlap_ratio*100)}%)."
        ]
        if matched_skills:
            rationale_parts.append(f"Strong overlap on {', '.join(matched_skills[:4])}.")
        if missing_skills:
            rationale_parts.append(f"Key missing skills: {', '.join(missing_skills[:3])}.")
        if job.workplace_type == "Remote":
            rationale_parts.append("Fully remote role aligns with your workplace preferences.")
        
        rationale = " ".join(rationale_parts)

        # Status: Auto-queue if score >= match_threshold
        threshold = preferences.match_threshold or 70
        initial_status = "queued" if final_score >= threshold else "discovered"

        # Check existing match
        match_res = await db.execute(
            select(JobMatch).where(
                JobMatch.job_id == job.id,
                JobMatch.user_id == user_id
            )
        )
        job_match = match_res.scalar_one_or_none()

        if job_match:
            job_match.match_score = final_score
            job_match.embedding_score = round(embedding_sim, 3)
            job_match.skill_overlap_score = round(skill_overlap_ratio, 3)
            job_match.matched_skills = matched_skills
            job_match.missing_skills = missing_skills
            job_match.match_rationale = rationale
            if job_match.status == "discovered" and final_score >= threshold:
                job_match.status = "queued"
        else:
            job_match = JobMatch(
                id=uuid.uuid4(),
                job_id=job.id,
                user_id=user_id,
                match_score=final_score,
                embedding_score=round(embedding_sim, 3),
                skill_overlap_score=round(skill_overlap_ratio, 3),
                matched_skills=matched_skills,
                missing_skills=missing_skills,
                match_rationale=rationale,
                status=initial_status,
                evaluated_at=datetime.now(timezone.utc),
            )
            db.add(job_match)

        await db.commit()
        await db.refresh(job_match)
        return job_match


scoring_service = ScoringService()
