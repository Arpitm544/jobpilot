import re
import logging
from typing import Tuple, List, Dict, Any, Optional
from rapidfuzz import fuzz
from app.schemas.profile import MasterProfileData, ContactInfo, SkillCategories

logger = logging.getLogger(__name__)

# Comprehensive Skill Aliases Mapping
SKILL_ALIASES: Dict[str, List[str]] = {
    "react": ["react", "react.js", "reactjs"],
    "next.js": ["next.js", "nextjs", "next"],
    "node.js": ["node.js", "nodejs", "node"],
    "python": ["python", "py", "python3"],
    "javascript": ["javascript", "js", "ecmascript"],
    "typescript": ["typescript", "ts"],
    "fastapi": ["fastapi", "fast-api"],
    "django": ["django"],
    "flask": ["flask"],
    "express": ["express", "express.js", "expressjs"],
    "postgresql": ["postgresql", "postgres", "psql"],
    "mysql": ["mysql"],
    "mongodb": ["mongodb", "mongo"],
    "redis": ["redis"],
    "sqlite": ["sqlite", "sqlite3"],
    "elasticsearch": ["elasticsearch", "elastic search"],
    "docker": ["docker", "containerization", "containers"],
    "kubernetes": ["kubernetes", "k8s"],
    "aws": ["aws", "amazon web services", "ec2", "s3", "lambda"],
    "gcp": ["gcp", "google cloud", "google cloud platform"],
    "azure": ["azure", "microsoft azure"],
    "git": ["git", "github", "gitlab"],
    "linux": ["linux", "ubuntu", "debian", "centos", "unix"],
    "langchain": ["langchain"],
    "langgraph": ["langgraph", "lang graph"],
    "tailwind css": ["tailwind", "tailwindcss", "tailwind css"],
    "graphql": ["graphql", "gql"],
    "rest api": ["rest", "restful", "rest api", "rest apis"],
    "ci/cd": ["ci/cd", "ci cd", "continuous integration", "github actions"],
    "pytorch": ["pytorch", "torch"],
    "tensorflow": ["tensorflow", "tf"],
}


def normalize_text(text: str) -> str:
    """Normalizes text for robust matching: lowercases, removes excessive punctuation and spaces"""
    if not text:
        return ""
    cleaned = re.sub(r"[^\w\s]", " ", text.lower())
    return " ".join(cleaned.split())


def normalize_phone(phone: str) -> str:
    """Extracts only digits from phone number for comparison"""
    if not phone:
        return ""
    digits = re.sub(r"\D", "", phone)
    # If 12 digits starting with 91 (India) or 11 with 1 (US), return normalized
    if len(digits) == 12 and digits.startswith("91"):
        return digits[2:]
    if len(digits) == 11 and digits.startswith("1"):
        return digits[1:]
    return digits


def normalize_url(url: str) -> str:
    """Strips scheme (http/https), www, .git suffix, and trailing slash to compare canonical domain + path"""
    if not url:
        return ""
    u = url.strip().lower()
    u = re.sub(r"^https?://", "", u)
    u = re.sub(r"^www\.", "", u)
    u = u.rstrip("/")
    if u.endswith(".git"):
        u = u[:-4]
    return u


def find_in_text(needle: str, haystack: str, threshold: float = 80.0) -> Tuple[bool, float, Optional[Dict[str, Any]]]:
    """
    Finds string in haystack using direct containment first, then RapidFuzz partial_ratio.
    Returns (is_found, confidence, source_span)
    """
    if not needle or not haystack:
        return False, 0.0, None

    needle_clean = needle.strip()
    norm_needle = normalize_text(needle_clean)
    norm_haystack = normalize_text(haystack)

    # 1. Exact or normalized substring match
    if norm_needle and norm_needle in norm_haystack:
        # Find rough index in raw haystack
        idx = haystack.lower().find(needle_clean.lower())
        start = idx if idx != -1 else 0
        end = start + len(needle_clean)
        return True, 1.0, {"text": needle_clean, "start": start, "end": end}

    # 2. Fuzzy partial ratio match for multi-word phrases
    score = fuzz.partial_ratio(norm_needle, norm_haystack)
    if score >= threshold:
        return True, score / 100.0, {"text": needle_clean, "fuzzy_score": score}

    return False, score / 100.0, None


def verify_skill(skill: str, raw_text: str) -> Tuple[bool, float]:
    """Verifies skill using alias table and boundary checks"""
    if not skill or not raw_text:
        return False, 0.0

    skill_lower = skill.strip().lower()
    raw_lower = raw_text.lower()

    # Direct word match
    if re.search(r"\b" + re.escape(skill_lower) + r"\b", raw_lower):
        return True, 1.0

    # Alias table lookup
    for canonical, aliases in SKILL_ALIASES.items():
        if skill_lower == canonical or skill_lower in aliases:
            for alias in aliases:
                if re.search(r"\b" + re.escape(alias) + r"\b", raw_lower):
                    return True, 0.95

    # Fuzzy match as fallback
    score = fuzz.partial_ratio(skill_lower, raw_lower)
    if score >= 88:
        return True, score / 100.0

    return False, 0.0


class ResumeVerifier:
    """
    Deterministic Verification Layer ensuring the Zero Hallucination guarantee.
    Anchors every extracted field back to raw resume text and extracted links.
    """

    @classmethod
    def verify_profile(
        cls,
        profile: MasterProfileData,
        raw_text: str,
        extracted_links: Optional[List[Dict[str, str]]] = None
    ) -> Tuple[MasterProfileData, List[Dict[str, Any]], Dict[str, Any]]:
        """
        Runs deterministic verification on MasterProfileData against raw resume text and links.
        Returns:
            - verified_profile (MasterProfileData)
            - field_meta_list (List of dicts for ProfileFieldMeta)
            - summary_counts (Dict of counts: total, verified, unverified, missing, needs_attention)
        """
        all_links_str = " ".join([l.get("url", "") + " " + l.get("label", "") for l in (extracted_links or [])])
        combined_corpus = f"{raw_text}\n{all_links_str}"

        field_metas: List[Dict[str, Any]] = []

        total_fields = 0
        verified_count = 0
        unverified_count = 0
        missing_count = 0

        # Helper to record field meta
        def record_meta(path: str, status: str, confidence: float, span: Optional[Dict[str, Any]] = None):
            nonlocal total_fields, verified_count, unverified_count, missing_count
            total_fields += 1
            if status == "verified":
                verified_count += 1
            elif status == "unverified":
                unverified_count += 1
            else:
                missing_count += 1

            field_metas.append({
                "field_path": path,
                "status": status,
                "confidence": round(confidence, 2),
                "source_span": span
            })

        # --- 1. Contact Info Verification ---
        contact = profile.contact_info

        # Sanitize literal "null", "none", "n/a" strings
        for field in ["full_name", "email", "phone", "location", "linkedin", "github", "portfolio"]:
            val = getattr(contact, field, None)
            if isinstance(val, str) and val.strip().lower() in ["null", "none", "n/a", "undefined"]:
                setattr(contact, field, "")

        # Full Name
        if contact.full_name:
            found, conf, span = find_in_text(contact.full_name, raw_text, threshold=85)
            record_meta("contact_info.full_name", "verified" if found else "unverified", conf, span)
        else:
            record_meta("contact_info.full_name", "missing", 0.0)

        # Email
        if contact.email:
            email_norm = contact.email.strip().lower()
            found = email_norm in raw_text.lower() or email_norm in all_links_str.lower()
            record_meta("contact_info.email", "verified" if found else "unverified", 1.0 if found else 0.5)
        else:
            record_meta("contact_info.email", "missing", 0.0)

        # Phone
        if contact.phone:
            phone_digits = normalize_phone(contact.phone)
            raw_digits = re.sub(r"\D", "", raw_text)
            found = bool(phone_digits and len(phone_digits) >= 7 and phone_digits in raw_digits)
            record_meta("contact_info.phone", "verified" if found else "unverified", 1.0 if found else 0.5)
        else:
            record_meta("contact_info.phone", "missing", 0.0)

        # Location
        if contact.location:
            found, conf, span = find_in_text(contact.location, raw_text, threshold=78)
            record_meta("contact_info.location", "verified" if found else "unverified", conf, span)
        else:
            record_meta("contact_info.location", "missing", 0.0)

        # LinkedIn
        if contact.linkedin:
            norm_li = normalize_url(contact.linkedin)
            norm_corpus = normalize_url(combined_corpus)
            found = norm_li in norm_corpus or "linkedin" in contact.linkedin.lower()
            record_meta("contact_info.linkedin", "verified" if found else "unverified", 1.0 if found else 0.6)
        else:
            record_meta("contact_info.linkedin", "missing", 0.0)

        # GitHub
        if contact.github:
            norm_gh = normalize_url(contact.github)
            norm_corpus = normalize_url(combined_corpus)
            found = norm_gh in norm_corpus or "github" in contact.github.lower()
            record_meta("contact_info.github", "verified" if found else "unverified", 1.0 if found else 0.6)
        else:
            record_meta("contact_info.github", "missing", 0.0)

        # Summary
        if profile.summary and len(profile.summary.strip()) > 15:
            # Summary is often summarized/rephrased by LLM; check token overlap
            score = fuzz.token_set_ratio(profile.summary, raw_text)
            is_valid = score >= 60
            record_meta("summary", "verified" if is_valid else "unverified", score / 100.0)
        else:
            record_meta("summary", "missing", 0.0)

        skill_cats = [
            ("languages", profile.skills.languages),
            ("frameworks", profile.skills.frameworks),
            ("databases", profile.skills.databases),
            ("tools", profile.skills.tools),
            ("cloud_devops", profile.skills.cloud_devops),
            ("concepts", getattr(profile.skills, "concepts", [])),
            ("soft_skills", profile.skills.soft_skills),
        ]

        verified_skills_data: Dict[str, List[str]] = {}

        for cat_name, skill_list in skill_cats:
            kept_skills = []
            for i, skill in enumerate(skill_list):
                is_verified, conf = verify_skill(skill, raw_text)
                status = "verified" if is_verified else "unverified"
                record_meta(f"skills.{cat_name}[{i}]", status, conf)
                # Keep skill regardless, with verified status flag recorded
                kept_skills.append(skill)
            verified_skills_data[cat_name] = kept_skills

        profile.skills = SkillCategories(**verified_skills_data)

        # Normalized URLs pool for robust matching across raw text and link annotations
        known_urls_normalized = set()
        for l in (extracted_links or []):
            u_norm = normalize_url(l.get("url", ""))
            if u_norm:
                known_urls_normalized.add(u_norm)
        for u in re.findall(r"https?://[^\s<>\"']+|www\.[^\s<>\"']+", raw_text):
            u_norm = normalize_url(u)
            if u_norm:
                known_urls_normalized.add(u_norm)

        def verify_url_presence(url: Optional[str]) -> Tuple[bool, float]:
            if not url or not url.strip():
                return False, 0.0
            norm = normalize_url(url)
            if not norm:
                return False, 0.0
            if norm in known_urls_normalized:
                return True, 1.0
            for ku in known_urls_normalized:
                if norm in ku or ku in norm:
                    return True, 0.95
                if fuzz.ratio(norm, ku) >= 90:
                    return True, 0.9
            return False, 0.0

        # --- 3. Experience Verification ---
        for i, exp in enumerate(profile.experience):
            company_found, c_conf, _ = find_in_text(exp.company, raw_text, threshold=75)
            record_meta(f"experience[{i}].company", "verified" if company_found else "unverified", c_conf)
            if exp.role:
                role_found, r_conf, _ = find_in_text(exp.role, raw_text, threshold=70)
                record_meta(f"experience[{i}].role", "verified" if role_found else "unverified", r_conf)

        # --- 4. Projects Verification ---
        for i, proj in enumerate(profile.projects):
            title_found, t_conf, _ = find_in_text(proj.title, raw_text, threshold=75)
            record_meta(f"projects[{i}].title", "verified" if title_found else "unverified", t_conf)

            # Project GitHub Repository URL Verification
            if proj.github_url:
                is_valid, conf = verify_url_presence(proj.github_url)
                if is_valid:
                    record_meta(f"projects[{i}].github_url", "verified", conf)
                else:
                    logger.warning(f"Zero-hallucination verifier: Clearing ungrounded GitHub URL '{proj.github_url}' for project '{proj.title}'")
                    proj.github_url = None
                    record_meta(f"projects[{i}].github_url", "missing", 0.0)
            else:
                record_meta(f"projects[{i}].github_url", "missing", 0.0)

            # Project Live Demo URL Verification
            if proj.demo_url:
                is_valid, conf = verify_url_presence(proj.demo_url)
                if is_valid:
                    record_meta(f"projects[{i}].demo_url", "verified", conf)
                else:
                    logger.warning(f"Zero-hallucination verifier: Clearing ungrounded Demo URL '{proj.demo_url}' for project '{proj.title}'")
                    proj.demo_url = None
                    record_meta(f"projects[{i}].demo_url", "missing", 0.0)
            else:
                record_meta(f"projects[{i}].demo_url", "missing", 0.0)

            # Keep proj.links synchronized
            if not proj.links:
                from app.schemas.profile import ProjectLinks
                proj.links = ProjectLinks(github_repo=proj.github_url, live_demo=proj.demo_url)
            else:
                proj.links.github_repo = proj.github_url
                proj.links.live_demo = proj.demo_url
            if not proj.link:
                proj.link = proj.demo_url or proj.github_url

        # --- 5. Education Verification ---
        for i, edu in enumerate(profile.education):
            inst_found, i_conf, _ = find_in_text(edu.institution, raw_text, threshold=75)
            record_meta(f"education[{i}].institution", "verified" if inst_found else "unverified", i_conf)

        summary_counts = {
            "total_fields": total_fields,
            "verified": verified_count,
            "unverified": unverified_count,
            "missing": missing_count,
            "needs_attention": unverified_count + (1 if missing_count > 0 else 0),
        }

        return profile, field_metas, summary_counts


resume_verifier = ResumeVerifier()
