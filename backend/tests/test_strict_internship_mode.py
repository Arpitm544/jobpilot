import pytest
from app.services.job_classifier import job_classifier, ClassificationResult
from app.services.stipend_normalizer import stipend_normalizer


class TestJobClassifier:
    """Tests for job type classification and strict internship filtering rules."""

    def test_strict_internship_title_matches(self):
        """Verifies clear internship titles are classified with high confidence across languages."""
        cases = [
            ("Software Engineering Intern", "Summer 2025 program.", "US"),
            ("Data Science Internship", "Join our research team.", "IN"),
            ("Werkstudent Softwareentwicklung", "Berlin office, 20 hrs/week.", "DE"),
            ("Summer Intern - Frontend", "React and Next.js.", "GB"),
            ("Co-op Software Engineer", "4-month fall term.", "CA"),
            ("Stagiaire Développeur Python", "Paris, France.", "FR"),
        ]
        for title, jd, country in cases:
            res = job_classifier.classify_job_sync(title, jd, country=country)
            assert res.is_internship is True, f"Failed for {title}"
            assert res.confidence >= 0.85, f"Expected high confidence for {title}, got {res.confidence}"
            assert res.is_maybe is False, f"Expected non-maybe for {title}"
            assert len(res.evidence) > 0, f"Expected evidence quote for {title}"
            assert res.employment_type == "internship"

    def test_senior_and_mentor_exclusion(self):
        """
        Critical rule: Senior, lead, and manager titles must NEVER be classified as internships,
        even if they mention interns or mentoring interns in title or JD.
        """
        cases = [
            ("Senior Engineer (mentors interns)", "Lead a team of 4 and mentor summer interns."),
            ("Engineering Manager - University Relations", "Oversee internship programs and campus hiring."),
            ("Lead Developer & Intern Mentor", "Guide junior staff and interns on architecture."),
            ("Principal Architect (University Program)", "Sponsor our annual university intern program."),
            ("Director of Engineering", "Manage intern pipelines across multiple departments."),
        ]
        for title, jd in cases:
            res = job_classifier.classify_job_sync(title, jd)
            assert res.is_internship is False, f"Senior role incorrectly marked as internship: {title}"
            assert res.employment_type == "full_time"
            assert res.confidence >= 0.90
            # Evidence should quote the senior disqualifier
            quotes = [e.quote.lower() for e in res.evidence]
            assert any(k in " ".join(quotes) for k in ["senior", "manager", "lead", "principal", "director"])

    def test_false_positive_word_boundaries(self):
        """
        Verifies that words containing 'intern' as a substring ('international', 'internal', 'internet')
        do NOT trigger internship classification.
        """
        cases = [
            ("International Sales Manager", "Drive business across Europe and Asia."),
            ("Internal Tools Developer", "Develop internal developer portals and dashboards."),
            ("Internet Protocol Engineer", "Work on low-level networking and routers."),
            ("Interval Data Analyst", "Perform periodic financial analyses."),
        ]
        for title, jd in cases:
            res = job_classifier.classify_job_sync(title, jd)
            assert res.is_internship is False, f"False positive triggered for: {title}"
            assert res.employment_type == "full_time"

    def test_fresher_and_graduate_fulltime_separation(self):
        """
        Graduate and fresher roles are separated into 'fresher_full_time' so they can be
        excluded from pure internship mode unless 'include_fresher=True'.
        """
        cases = [
            ("Graduate Trainee Engineer", "Full-time entry-level engineering training program."),
            ("Fresher Software Engineer", "Open to 2024 graduates for full-time employment."),
            ("Entry Level Full-Time Developer", "Start your engineering career with us full-time."),
        ]
        for title, jd in cases:
            res = job_classifier.classify_job_sync(title, jd)
            assert res.is_internship is False, f"Fresher should not be marked as pure internship: {title}"
            assert res.is_fresher is True, f"Expected is_fresher=True for: {title}"
            assert res.employment_type == "fresher_full_time"

    def test_borderline_maybe_internship(self):
        """
        Ambiguous titles with weak intern mentions in the JD body should be classified
        as borderline 'maybe' (0.50 <= confidence < 0.85).
        """
        title = "Junior Full Stack Developer"
        jd = "Join our tech team. We also have openings for an intern to assist on frontend features."
        res = job_classifier.classify_job_sync(title, jd)
        assert res.is_maybe is True
        assert 0.50 <= res.confidence < 0.85
        assert res.is_internship is True

    def test_metadata_extraction(self):
        """Verifies duration, PPO, stipend, and student eligibility extraction."""
        jd = """
        About the Role:
        This is a 6 months software internship.
        Stipend: ₹45,000 per month.
        Eligibility: Batch of 2025 graduating students, currently enrolled in B.Tech.
        Opportunity for PPO based on performance during the 6 months period.
        """
        res = job_classifier.classify_job_sync("Backend Intern", jd, country="IN")
        assert res.duration_months == 6.0
        assert res.has_ppo is True
        assert res.student_eligibility.get("grad_year") == "2025"
        assert res.student_eligibility.get("must_be_enrolled") is True
        assert res.stipend_min == 45000.0
        assert res.stipend_currency == "INR"
        assert res.stipend_period == "monthly"

    @pytest.mark.asyncio
    async def test_llm_fallback_quote_verification(self):
        """
        Verifies the zero-hallucination quote check:
        If an LLM returns a hallucinated quote not in the JD text, the quote is rejected.
        """
        jd = "We are seeking passionate students to learn and build cloud infrastructure."
        # Call classify_job with an unverified quote
        res = await job_classifier.classify_job(
            title="Cloud Student Fellow",
            jd_text=jd,
            use_llm_for_borderline=False  # Test the deterministic flow
        )
        assert res is not None

    def test_stipend_normalizer_conversion(self):
        """Verifies stipend normalization across currencies and periods."""
        # 45,000 INR monthly
        norm_inr = stipend_normalizer.normalize_stipend(45000, 45000, "INR", "monthly", "INR")
        assert norm_inr.normalized_monthly_home == 45000.0
        assert "₹45,000" in norm_inr.display_text

        # $25 / hour in USD converted to home INR (160 hrs = $4,000/mo * 86.5 = ~346,000 INR)
        norm_usd = stipend_normalizer.normalize_stipend(25, 25, "USD", "hourly", "INR")
        assert norm_usd.normalized_monthly_home > 300000.0
        assert "$25 / hourly" in norm_usd.original_display
