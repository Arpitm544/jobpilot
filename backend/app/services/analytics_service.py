import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy import select, func, desc, case, and_
from sqlalchemy.orm import selectinload, load_only
from sqlalchemy.ext.asyncio import AsyncSession
from google import genai

from app.config import settings
from app.models.job import Job, JobMatch
from app.models.profile import MasterProfile
from app.models.application import Application, TailoredResume, ApplicationEvent

logger = logging.getLogger(__name__)


class AnalyticsService:
    def __init__(self):
        self._gemini_client = None

    def get_gemini(self):
        if not self._gemini_client and settings.GEMINI_API_KEY:
            self._gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)
        return self._gemini_client

    async def get_dashboard_analytics(
        self,
        db: AsyncSession,
        user_id: uuid.UUID
    ) -> Dict[str, Any]:
        """
        Calculates funnel metrics, application velocity, and ATS performance.
        Uses SQL GROUP BY aggregation instead of loading all rows into Python —
        much faster when there are hundreds of matches/applications.
        """
        # ── 1. Funnel counts via SQL GROUP BY ──────────────────────────────────
        # Application status counts
        app_status_q = await db.execute(
            select(Application.status, func.count(Application.id).label("cnt"))
            .where(Application.user_id == user_id)
            .group_by(Application.status)
        )
        app_status_rows = app_status_q.all()

        total_matches_q = await db.execute(
            select(func.count(JobMatch.id))
            .where(JobMatch.user_id == user_id)
        )
        total_matches = total_matches_q.scalar_one() or 0

        # Tailored matches count (status in tailored/applied or has tailored_resume)
        tailored_matches_q = await db.execute(
            select(func.count(JobMatch.id))
            .where(
                JobMatch.user_id == user_id,
                JobMatch.status.in_(["tailored", "applied"])
            )
        )
        tailored_count = tailored_matches_q.scalar_one() or 0

        funnel_counts = {
            "discovered": total_matches,
            "tailored": tailored_count,
            "review_ready": 0,
            "applied": 0,
            "interview": 0,
            "offer": 0,
            "rejected": 0,
        }
        for row in app_status_rows:
            st = row.status or "applied"
            if st in funnel_counts:
                funnel_counts[st] += row.cnt
            funnel_counts["tailored"] = max(funnel_counts["tailored"], tailored_count)

        # ── 2. Daily velocity (last 14 days) — SQL GROUP BY date ───────────────
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(days=14)
        velocity_q = await db.execute(
            select(
                func.strftime("%Y-%m-%d", Application.created_at).label("day"),
                func.count(Application.id).label("cnt")
            )
            .where(
                Application.user_id == user_id,
                Application.created_at >= cutoff,
            )
            .group_by("day")
        )
        velocity_by_day = {row.day: row.cnt for row in velocity_q.all()}

        # Ensure all 14 days appear even if count is 0
        daily_velocity_map = {}
        for i in range(13, -1, -1):
            day_str = (now - timedelta(days=i)).strftime("%Y-%m-%d")
            daily_velocity_map[day_str] = velocity_by_day.get(day_str, 0)
        velocity_series = [{"date": k, "count": v} for k, v in daily_velocity_map.items()]

        # ── 3. ATS scores and breakdown — only select needed columns ──────────
        ats_q = await db.execute(
            select(
                Job.ats_type,
                TailoredResume.ats_keyword_match_pct,
            )
            .select_from(Application)
            .join(Job, Application.job_id == Job.id)
            .outerjoin(TailoredResume, Application.tailored_resume_id == TailoredResume.id)
            .where(Application.user_id == user_id)
        )
        ats_rows = ats_q.all()
        ats_scores = [r.ats_keyword_match_pct for r in ats_rows if r.ats_keyword_match_pct]
        ats_type_breakdown: Dict[str, int] = {}
        for r in ats_rows:
            ats = r.ats_type or "Other"
            ats_type_breakdown[ats] = ats_type_breakdown.get(ats, 0) + 1

        avg_ats = round(sum(ats_scores) / len(ats_scores), 1) if ats_scores else 88.5

        # ── 4. Conversion rates ────────────────────────────────────────────────
        total_discovered = max(1, funnel_counts["discovered"])
        total_applied = max(1, funnel_counts["applied"] + funnel_counts["interview"] + funnel_counts["offer"])
        tailored_conv = round((funnel_counts["tailored"] / total_discovered) * 100, 1)
        interview_conv = round((funnel_counts["interview"] / total_applied) * 100, 1)

        # ── 5. Top matched skills frequency (from match JSON) ─────────────────
        skills_q = await db.execute(
            select(JobMatch.matched_skills)
            .where(
                JobMatch.user_id == user_id,
                JobMatch.matched_skills != None,
            )
            .limit(200)  # Cap at 200 matches for performance
        )
        skill_counts: Dict[str, int] = {}
        for (skills,) in skills_q.all():
            if isinstance(skills, list):
                for s in skills:
                    skill_counts[s] = skill_counts.get(s, 0) + 1

        top_skills = sorted(
            [{"skill": k, "frequency": v} for k, v in skill_counts.items()],
            key=lambda x: x["frequency"],
            reverse=True
        )[:8]

        # ── 6. Recent resume variants — select only needed columns ───────────
        variants_res = await db.execute(
            select(
                TailoredResume.id,
                TailoredResume.ats_keyword_match_pct,
                TailoredResume.created_at,
                TailoredResume.claim_verification_passed,
                TailoredResume.tailored_bullets,
            )
            .join(JobMatch, JobMatch.id == TailoredResume.job_match_id)
            .where(JobMatch.user_id == user_id)
            .order_by(desc(TailoredResume.created_at))
            .limit(5)
        )
        variant_analytics = []
        for v in variants_res.all():
            variant_analytics.append({
                "id": str(v.id),
                "ats_score": v.ats_keyword_match_pct or 90.0,
                "created_at": v.created_at.strftime("%b %d, %Y") if v.created_at else "Recent",
                "claim_verified": v.claim_verification_passed,
                "bullet_count": len(v.tailored_bullets) if v.tailored_bullets else 0,
            })

        total_applications_q = await db.execute(
            select(func.count(Application.id)).where(Application.user_id == user_id)
        )
        total_applications = total_applications_q.scalar_one() or 0

        return {
            "funnel": funnel_counts,
            "velocity": velocity_series,
            "avg_ats_score": avg_ats,
            "conversion_rates": {
                "tailored_rate": tailored_conv,
                "interview_rate": interview_conv,
            },
            "ats_breakdown": ats_type_breakdown,
            "top_skills": top_skills,
            "recent_variants": variant_analytics,
            "total_applications": total_applications,
        }

    async def generate_follow_up_draft(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        application_id: uuid.UUID,
        follow_up_type: str = "7_day"
    ) -> Dict[str, Any]:
        """Generates contextual, company-tailored follow-up email draft using Gemini"""
        app_res = await db.execute(
            select(Application)
            .options(
                selectinload(Application.job),
                selectinload(Application.tailored_resume)
            )
            .where(Application.id == application_id, Application.user_id == user_id)
        )
        application = app_res.scalar_one_or_none()
        if not application or not application.job:
            raise ValueError("Application or Job not found.")

        # Candidate profile
        prof_res = await db.execute(
            select(MasterProfile).where(MasterProfile.user_id == user_id, MasterProfile.is_primary == True)
        )
        profile = prof_res.scalar_one_or_none()

        candidate_name = profile.contact_info.get("full_name", "Candidate") if profile and profile.contact_info else "Candidate"
        job = application.job
        company = job.company_name
        title = job.title
        applied_days_ago = 7
        if application.applied_at:
            applied_at = application.applied_at
            if applied_at.tzinfo is not None:
                applied_at = applied_at.astimezone(timezone.utc).replace(tzinfo=None)
            applied_days_ago = max(1, (datetime.now(timezone.utc).replace(tzinfo=None) - applied_at).days)

        prompt = f"""You are an executive career advisor writing a thoughtful follow-up email for a job application.
Candidate Name: {candidate_name}
Job Title: {title}
Company: {company}
Applied: {applied_days_ago} days ago
Job Description Highlights: {job.jd_text[:400] if job.jd_text else "Software engineering position"}
Candidate Core Skills: {list(profile.skills.keys()) if profile and profile.skills else ["Software Engineering"]}

Write a polite, professional, and concise follow-up email inquiring about the status of the application.
Reiterate enthusiasm for {company} and highlight alignment with {title}.
Tone: Professional, confident, respectful of their busy schedule.

Output strictly valid JSON with this exact structure:
{{
  "subject": "Follow-Up: Application for [Job Title] - [Candidate Name]",
  "greeting": "Dear Hiring Team at [Company],",
  "body": "Email body paragraphs here with line breaks...",
  "sign_off": "Best regards,\\n[Candidate Name]"
}}
"""
        client = self.get_gemini()
        if client:
            try:
                res = client.models.generate_content(
                    model=settings.GEMINI_MODEL,
                    contents=prompt
                )
                raw_text = res.text.strip()
                if "```json" in raw_text:
                    raw_text = raw_text.split("```json")[1].split("```")[0].strip()
                elif "```" in raw_text:
                    raw_text = raw_text.split("```")[1].split("```")[0].strip()
                import json
                return json.loads(raw_text)
            except Exception as e:
                logger.error(f"Gemini follow-up draft error: {e}")

        # Deterministic fallback draft
        return {
            "subject": f"Following Up: Application for {title} - {candidate_name}",
            "greeting": f"Dear {company} Recruiting Team,",
            "body": f"I hope this note finds you well.\n\nI submitted my application for the {title} position approximately {applied_days_ago} days ago and wanted to reiterate my enthusiasm for the role and {company}'s mission.\n\nGiven my background and experience, I am confident I can make an immediate contribution to your engineering team. I welcome the opportunity to discuss how my qualifications align with your current needs.",
            "sign_off": f"Thank you for your time and consideration.\n\nBest regards,\n{candidate_name}"
        }


analytics_service = AnalyticsService()
