import io
import re
import logging
from typing import Tuple, Dict, Any, List, Optional
import pymupdf

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


def extract_links_from_pdf_page(page: pymupdf.Page) -> List[Dict[str, str]]:
    """Extracts all URI link annotations on a PDF page with their anchor text"""
    links = []
    try:
        page_links = page.get_links()
        for link in page_links:
            uri = link.get("uri")
            if not uri:
                continue
            rect = link.get("from")
            anchor_text = ""
            if rect:
                anchor_text = page.get_text("text", clip=rect).strip().replace("\n", " ")
            links.append({
                "label": anchor_text or "Link",
                "url": uri
            })
    except Exception as e:
        logger.warning(f"Failed extracting PDF links: {e}")
    return links


async def extract_text_and_links_from_pdf(file_bytes: bytes) -> Tuple[str, List[Dict[str, str]], bool]:
    """
    Extracts text preserving multi-column reading order and extracts all hyperlink annotations.
    Triggers Gemini Vision OCR if text is below 100 characters (scanned document).
    Returns (raw_text, extracted_links, ocr_used)
    """
    raw_text = ""
    extracted_links: List[Dict[str, str]] = []
    ocr_used = False

    try:
        doc = pymupdf.open(stream=file_bytes, filetype="pdf")
        page_texts = []

        for page in doc:
            # Extract links
            links = extract_links_from_pdf_page(page)
            extracted_links.extend(links)

            # Extract text blocks and sort by vertical then horizontal position for multi-column order
            blocks = page.get_text("blocks")
            # block format: (x0, y0, x1, y1, text, block_no, block_type)
            # Sort primarily by y0 (within 10pt threshold) and x0
            sorted_blocks = sorted(blocks, key=lambda b: (round(b[1] / 12) * 12, b[0]))
            page_text = "\n".join([b[4].strip() for b in sorted_blocks if b[4].strip()])
            if page_text:
                page_texts.append(page_text)

        raw_text = "\n\n".join(page_texts).strip()

        # Check for scanned / image PDF (< 100 characters)
        if len(raw_text) < 100 and len(doc) > 0:
            logger.info("PDF has less than 100 characters of extractable text. Triggering Gemini Vision OCR fallback...")
            image_bytes_list = []
            for page in doc[:3]:  # Max first 3 pages for OCR
                pix = page.get_pixmap(dpi=150)
                image_bytes_list.append(pix.tobytes("png"))

            ocr_text = await gemini_service.extract_text_via_vision(image_bytes_list)
            if ocr_text and ocr_text.strip():
                raw_text = ocr_text.strip()
                ocr_used = True
                logger.info(f"Gemini Vision OCR successfully extracted {len(raw_text)} characters.")

        doc.close()

    except Exception as e:
        logger.error(f"Error in PyMuPDF text & link extraction: {e}", exc_info=True)

    # Append formatted hyperlink table so Gemini sees all URLs cleanly
    if extracted_links:
        link_block = "\n\n--- EMBEDDED HYPERLINKS IN RESUME ---\n"
        for l in extracted_links:
            link_block += f"- Anchor: '{l['label']}' -> URL: {l['url']}\n"
        raw_text = raw_text + link_block

    return raw_text, extracted_links, ocr_used


def extract_text_from_docx(file_bytes: bytes) -> Tuple[str, List[Dict[str, str]]]:
    """Extract text and hyperlinks from DOCX using python-docx"""
    text = []
    links: List[Dict[str, str]] = []
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

        # Extract relationship hyperlinks
        for rel in doc.part.rels.values():
            if "hyperlink" in rel.reltype:
                target_url = rel.target_ref
                if target_url.startswith("http"):
                    links.append({"label": "Link", "url": target_url})

        raw_text = "\n".join(text)
        if links:
            raw_text += "\n\n--- EMBEDDED HYPERLINKS ---\n" + "\n".join([f"- URL: {l['url']}" for l in links])

        return raw_text, links
    except Exception as e:
        logger.error(f"python-docx extraction failed: {e}")
        return "", []


def heuristic_profile_extractor(
    raw_text: str,
    extracted_links: Optional[List[Dict[str, str]]] = None,
    filename: str = ""
) -> MasterProfileData:
    """Robust rule-based and regex fallback parser"""
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
        contact.email = email_match.group(0).lower()

    # 2. Phone extraction (supports US, India +91, international, dashes/spaces)
    phone_match = re.search(r"(\+?91[\s-]?)?[6-9]\d{9}|\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}", raw_text)
    if phone_match:
        contact.phone = phone_match.group(0).strip()

    # 3. Name & Location heuristic
    for line in lines[:4]:
        if not re.search(r"resume|curriculum|vitae|email|phone|http|github|linkedin|@|engineer|developer", line, re.I):
            words = line.split()
            if 2 <= len(words) <= 4 and not contact.full_name:
                contact.full_name = line
        if re.search(r"india|usa|united states|canada|remote|ca|ny|karnataka|bengaluru|bangalore|san francisco", line, re.I):
            if not contact.location and len(line) < 50:
                contact.location = line

    # 4. Links heuristic (from regex and from extracted PDF link annotations)
    found_urls = set()
    all_potential_links = list(extracted_links or [])
    for url in re.findall(r"https?://[^\s<>\"']+|www\.[^\s<>\"']+", raw_text):
        all_potential_links.append({"label": "Link", "url": url})

    for item in all_potential_links:
        url = item.get("url", "")
        if not url or url in found_urls or url.startswith("mailto:"):
            continue
        found_urls.add(url)
        url_lower = url.lower()
        if "linkedin.com" in url_lower and not contact.linkedin:
            contact.linkedin = url
        elif "github.com" in url_lower and not contact.github:
            contact.github = url
        elif "portfolio" in item.get("label", "").lower() or "vercel.app" in url_lower:
            if not contact.portfolio:
                contact.portfolio = url
            else:
                links.append(LinkItem(label=item.get("label") or "Project Link", url=url))
        else:
            links.append(LinkItem(label=item.get("label") or "External Link", url=url))

    # 5. Skills extraction
    common_langs = ["python", "javascript", "typescript", "java", "c++", "c#", "go", "ruby", "rust", "php", "sql", "html", "css"]
    common_frameworks = ["react", "next.js", "node.js", "vue", "angular", "fastapi", "django", "flask", "express", "spring boot", "tailwind", "langgraph", "langchain"]
    common_databases = ["postgresql", "mysql", "mongodb", "redis", "sqlite", "dynamodb", "elasticsearch"]
    common_tools = ["git", "docker", "kubernetes", "linux", "jira", "postman", "figma", "mcp"]
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
    edu_keywords = ["bachelor", "master", "b.tech", "b.e.", "b.s.", "m.s.", "degree", "university", "institute", "college", "school"]
    for i, line in enumerate(lines):
        line_lower = line.lower()
        if any(kw in line_lower for kw in edu_keywords):
            degree = line
            institution = lines[i - 1] if i > 0 and len(lines[i - 1]) < 80 else "University"
            education.append(EducationItem(
                institution=institution,
                degree=degree,
                field_of_study="Computer Science",
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
        for line in lines[1:5]:
            if len(line) > 50 and not re.search(r"skills|education|projects|experience", line, re.I):
                summary = line
                break

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
    ) -> Tuple[MasterProfileData, str, List[Dict[str, str]], bool, str]:
        """
        Parses resume file into structured MasterProfileData.
        Returns: (parsed_profile, raw_text, extracted_links, ocr_used, parsing_mode)
        """
        filename_lower = filename.lower()
        raw_text = ""
        extracted_links: List[Dict[str, str]] = []
        ocr_used = False

        if filename_lower.endswith(".pdf"):
            raw_text, extracted_links, ocr_used = await extract_text_and_links_from_pdf(file_bytes)
        elif filename_lower.endswith(".docx"):
            raw_text, extracted_links = extract_text_from_docx(file_bytes)
        elif filename_lower.endswith(".txt"):
            raw_text = file_bytes.decode("utf-8", errors="ignore")
        else:
            raw_text, extracted_links, ocr_used = await extract_text_and_links_from_pdf(file_bytes)
            if not raw_text:
                raw_text = file_bytes.decode("utf-8", errors="ignore")

        if not raw_text.strip():
            raise ValueError("Could not extract any readable text from the uploaded document.")

        # Structure with Gemini
        system_instruction = (
            "You are an expert HR technologist and ATS resume parser. "
            "Extract every detail from the resume into the exact JSON schema provided. "
            "CRITICAL RULES:\n"
            "1. Do NOT invent or hallucinate any degrees, employers, or skills.\n"
            "2. Extract contact information accurately (full_name, email, phone, location, linkedin, github, portfolio).\n"
            "   Check the embedded hyperlinks section for LinkedIn, GitHub, portfolio, and project links.\n"
            "3. Categorize technical skills into: languages, frameworks, databases, tools, cloud_devops, soft_skills.\n"
            "4. Extract all experience items with company, role, dates, location, bullets.\n"
            "5. Extract all projects with title, tech_stack, bullets, link.\n"
            "6. Extract all education with institution, degree, field_of_study, dates, gpa."
        )

        prompt = (
            f"Parse the following resume text and embedded hyperlinks into the structured MasterProfile schema:\n\n"
            f"```text\n{raw_text}\n```"
        )

        parsing_mode = "gemini_ai"
        profile_data = await gemini_service.generate_structured(
            prompt=prompt,
            response_schema=MasterProfileData,
            system_instruction=system_instruction
        )

        if not profile_data:
            logger.info("Gemini parsing returned None. Falling back to heuristic rule-based resume parser.")
            profile_data = heuristic_profile_extractor(raw_text, extracted_links, filename)
            parsing_mode = "heuristic_fallback"

        # Cross-populate links if missing in contact_info but found in extracted_links
        if extracted_links:
            contact = profile_data.contact_info
            for l in extracted_links:
                url = l.get("url", "")
                url_lower = url.lower()
                if "linkedin.com" in url_lower and not contact.linkedin:
                    contact.linkedin = url
                elif "github.com" in url_lower and not contact.github and "/" in url_lower.replace("https://github.com/", ""):
                    # Specific profile or repo github link
                    if not contact.github:
                        contact.github = url
                elif ("portfolio" in l.get("label", "").lower() or "vercel.app" in url_lower) and not contact.portfolio:
                    contact.portfolio = url

        return profile_data, raw_text, extracted_links, ocr_used, parsing_mode


resume_parser_service = ResumeParserService()
