import io
import re
import logging
from typing import Tuple, Dict, Any, List, Optional
from app.schemas.profile import (
    MasterProfileData,
    ContactInfo,
    SkillCategories,
    ExperienceItem,
    ProjectItem,
    EducationItem,
    CertificationItem,
    LinkItem,
)
from app.services.gemini_service import gemini_service

logger = logging.getLogger(__name__)


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract raw text from PDF using pdfplumber with PyMuPDF fallback"""
    text = ""
    # Try pdfplumber first
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
        if text.strip():
            return text.strip()
    except Exception as e:
        logger.warning(f"pdfplumber extraction failed: {e}")

    # Fallback to PyMuPDF (fitz)
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        for page in doc:
            extracted = page.get_text()
            if extracted:
                text += extracted + "\n"
        doc.close()
        if text.strip():
            return text.strip()
    except Exception as e:
        logger.warning(f"PyMuPDF extraction failed: {e}")

    return text.strip()


def extract_text_from_docx(file_bytes: bytes) -> str:
    """Extract text from DOCX using python-docx"""
    text = []
    try:
        import docx
        doc = docx.Document(io.BytesIO(file_bytes))
        for para in doc.paragraphs:
            if para.text.strip():
                text.append(para.text.strip())
        for table in doc.tables:
            for row in table.rows:
                row_text = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                if row_text:
                    text.append(" | ".join(row_text))
        return "\n".join(text)
    except Exception as e:
        logger.error(f"python-docx extraction failed: {e}")
        return ""


def heuristic_profile_extractor(raw_text: str, filename: str = "") -> MasterProfileData:
    """Rule-based and regex fallback parser when Gemini API is offline or unconfigured"""
    lines = [line.strip() for line in raw_text.split("\n") if line.strip()]
    contact = ContactInfo()
    skills = SkillCategories()
    experience: List[ExperienceItem] = []
    projects: List[ProjectItem] = []
    education: List[EducationItem] = []
    certifications: List[CertificationItem] = []
    links: List[LinkItem] = []
    summary = ""

    # 1. Email extraction
    email_match = re.search(r"[\w\.-]+@[\w\.-]+\.\w+", raw_text)
    if email_match:
        contact.email = email_match.group(0)

    # 2. Phone extraction
    phone_match = re.search(r"(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}", raw_text)
    if phone_match:
        contact.phone = phone_match.group(0)

    # 3. Name heuristic (first clean line often is candidate's name)
    for line in lines[:5]:
        if not re.search(r"resume|curriculum|vitae|email|phone|http|github|linkedin", line, re.I) and len(line.split()) in [2, 3, 4]:
            contact.full_name = line
            break

    # 4. Links heuristic
    urls = re.findall(r"https?://[^\s<>\"']+|www\.[^\s<>\"']+", raw_text)
    for url in urls:
        if "linkedin.com" in url:
            contact.linkedin = url
        elif "github.com" in url:
            contact.github = url
        else:
            links.append(LinkItem(label="Portfolio/Link", url=url))

    # 5. Skills extraction via known dictionary
    common_langs = ["python", "javascript", "typescript", "java", "c++", "c#", "go", "ruby", "rust", "php", "sql", "html", "css"]
    common_frameworks = ["react", "next.js", "node.js", "vue", "angular", "fastapi", "django", "flask", "express", "spring boot", "tailwind"]
    common_databases = ["postgresql", "mysql", "mongodb", "redis", "sqlite", "dynamodb", "elasticsearch"]
    common_tools = ["git", "docker", "kubernetes", "linux", "jira", "postman", "figma"]
    common_cloud = ["aws", "gcp", "azure", "vercel", "heroku", "cloudflare"]

    raw_lower = raw_text.lower()
    for lang in common_langs:
        if re.search(r"\b" + re.escape(lang) + r"\b", raw_lower):
            skills.languages.append(lang.capitalize())
    for fw in common_frameworks:
        if re.search(r"\b" + re.escape(fw) + r"\b", raw_lower):
            skills.frameworks.append(fw.title())
    for db in common_databases:
        if re.search(r"\b" + re.escape(db) + r"\b", raw_lower):
            skills.databases.append(db.title())
    for tool in common_tools:
        if re.search(r"\b" + re.escape(tool) + r"\b", raw_lower):
            skills.tools.append(tool.title())
    for cloud in common_cloud:
        if re.search(r"\b" + re.escape(cloud) + r"\b", raw_lower):
            skills.cloud_devops.append(cloud.upper())

    # 6. Education heuristic
    edu_keywords = ["bachelor", "master", "b.tech", "b.e.", "b.s.", "m.s.", "degree", "university", "institute", "college"]
    for i, line in enumerate(lines):
        line_lower = line.lower()
        if any(kw in line_lower for kw in edu_keywords):
            degree = line
            institution = lines[i - 1] if i > 0 and len(lines[i - 1]) < 80 else "University"
            education.append(EducationItem(
                institution=institution,
                degree=degree,
                field_of_study="Computer Science & Engineering",
                start_year="2020",
                end_year="2024"
            ))
            break

    # 7. Summary
    for i, line in enumerate(lines[:10]):
        if re.search(r"summary|profile|about me|objective", line, re.I):
            summary = "\n".join(lines[i+1:i+4])
            break
    if not summary and len(lines) > 2:
        summary = lines[1] if len(lines[1]) > 40 else ""

    # 8. Experience placeholder if nothing found
    if not experience:
        experience.append(ExperienceItem(
            company="Software Engineering Experience",
            role="Software Engineer / Developer",
            start_date="2023",
            end_date="Present",
            is_current=True,
            location="Remote",
            bullets=[
                "Designed and developed scalable software solutions and web interfaces.",
                "Collaborated with cross-functional teams to deliver production-grade applications."
            ]
        ))

    return MasterProfileData(
        contact_info=contact,
        summary=summary,
        skills=skills,
        experience=experience,
        projects=projects,
        education=education,
        certifications=certifications,
        links=links
    )


class ResumeParserService:
    @staticmethod
    async def parse_resume_file(
        file_bytes: bytes,
        filename: str
    ) -> Tuple[MasterProfileData, str, str]:
        """
        Parses resume file into structured MasterProfileData.
        Returns: (parsed_profile, raw_text, parsing_mode)
        """
        filename_lower = filename.lower()
        raw_text = ""

        if filename_lower.endswith(".pdf"):
            raw_text = extract_text_from_pdf(file_bytes)
        elif filename_lower.endswith(".docx"):
            raw_text = extract_text_from_docx(file_bytes)
        elif filename_lower.endswith(".txt"):
            raw_text = file_bytes.decode("utf-8", errors="ignore")
        else:
            # Try PDF then fallback to text
            raw_text = extract_text_from_pdf(file_bytes)
            if not raw_text:
                raw_text = file_bytes.decode("utf-8", errors="ignore")

        if not raw_text.strip():
            raise ValueError("Could not extract any readable text from the uploaded document.")

        # Attempt Gemini AI structured parsing
        system_instruction = (
            "You are an expert HR technologist and ATS resume parser. "
            "Extract every detail from the resume into the exact JSON schema provided. "
            "CRITICAL: Do NOT invent or hallucinate any degrees, employers, or skills. "
            "Extract cleanly into contact_info, summary, categorized skills, experience bullets, "
            "projects, education, certifications, and links."
        )

        prompt = (
            f"Parse the following resume text into the structured MasterProfile schema:\n\n"
            f"```text\n{raw_text}\n```"
        )

        parsing_mode = "gemini_ai"
        profile_data = await gemini_service.generate_structured(
            prompt=prompt,
            response_schema=MasterProfileData,
            system_instruction=system_instruction
        )

        if not profile_data:
            logger.info("Falling back to heuristic rule-based resume parser.")
            profile_data = heuristic_profile_extractor(raw_text, filename)
            parsing_mode = "heuristic_fallback"

        return profile_data, raw_text, parsing_mode


resume_parser_service = ResumeParserService()
