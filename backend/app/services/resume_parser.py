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


from collections import defaultdict
from rapidfuzz import fuzz

def normalize_text(text: str) -> str:
    if not text:
        return ""
    cleaned = re.sub(r"[^\w\s]", " ", text.lower())
    return " ".join(cleaned.split())


def classify_url(url: str) -> Tuple[str, str]:
    """
    Classifies a URL into domain categories using URL parsing:
    - 'github_repo': github.com/<user>/<repo>[...] (>= 2 path segments)
    - 'github_profile': github.com/<user> (profile only, 1 segment, no repo)
    - 'linkedin': linkedin.com/...
    - 'demo': vercel.app, netlify.app, render.com, herokuapp.com, etc.
    - 'other': mailto, etc.
    Returns (classification, slug_or_identifier)
    """
    if not url:
        return ("other", "")
    try:
        from urllib.parse import urlparse
        u_clean = url.strip()
        parsed = urlparse(u_clean if "://" in u_clean else f"https://{u_clean}")
        netloc = (parsed.netloc or "").lower()
        path = (parsed.path or "").strip("/")
        segments = [s for s in path.split("/") if s]

        if "github.com" in netloc:
            if len(segments) >= 2:
                repo_slug = segments[1].replace(".git", "").strip().lower()
                return ("github_repo", repo_slug)
            elif len(segments) == 1:
                reserved = ["features", "pricing", "about", "explore", "topics", "pulls", "issues", "settings", "stars"]
                if segments[0].lower() not in reserved:
                    return ("github_profile", segments[0].lower())
            return ("github_profile", "")

        if "linkedin.com" in netloc:
            return ("linkedin", "")

        if parsed.scheme == "mailto":
            return ("other", "")

        demo_domains = [
            "vercel.app", "netlify.app", "render.com", "herokuapp.com",
            "pages.dev", "firebaseapp.com", "fly.dev", "railway.app", "surge.sh", "github.io"
        ]
        if any(d in netloc for d in demo_domains):
            return ("demo", "")

        if parsed.scheme in ["http", "https"]:
            return ("demo", "")

        return ("other", "")
    except Exception:
        return ("other", "")


def extract_links_from_pdf_page(page: pymupdf.Page, page_index: int = 0) -> List[Dict[str, Any]]:
    """Extracts all URI link annotations on a PDF page with spatial coordinates and anchor text"""
    links = []
    try:
        page_links = page.get_links()
        words = page.get_text("words")
        for link in page_links:
            uri = link.get("uri")
            if not uri:
                continue
            rect_coords = link.get("from")
            if not rect_coords:
                continue
            rect = pymupdf.Rect(rect_coords)

            matched_words = [
                w[4] for w in words
                if rect.contains(pymupdf.Point((w[0] + w[2]) / 2, (w[1] + w[3]) / 2))
            ]
            anchor = " ".join(matched_words).strip()
            if not anchor:
                anchor = page.get_text("text", clip=rect).strip().replace("\n", " ")
            if not anchor:
                anchor = "Link"

            kind, slug = classify_url(uri)
            links.append({
                "url": uri,
                "anchor_text": anchor,
                "label": anchor,
                "page": page_index,
                "y_position": rect.y0,
                "x_position": rect.x0,
                "rect": [rect.x0, rect.y0, rect.x1, rect.y1],
                "kind": kind,
                "slug": slug
            })
    except Exception as e:
        logger.warning(f"Failed extracting PDF links on page {page_index}: {e}")
    return links


async def extract_text_and_links_from_pdf(file_bytes: bytes) -> Tuple[str, List[Dict[str, Any]], bool]:
    """
    Extracts text preserving multi-column reading order, inserts link annotations inline
    into the text stream at the exact position of their anchor text, and records structured links.
    Triggers Gemini Vision OCR if text is below 100 characters (scanned document).
    Returns (raw_text, extracted_links, ocr_used)
    """
    raw_text = ""
    extracted_links: List[Dict[str, Any]] = []
    ocr_used = False

    try:
        doc = pymupdf.open(stream=file_bytes, filetype="pdf")
        page_texts = []

        for page_idx, page in enumerate(doc):
            page_links = page.get_links()
            words = page.get_text("words")
            word_to_link = {}

            # Map words to links
            for link in page_links:
                uri = link.get("uri")
                if not uri:
                    continue
                rect_coords = link.get("from")
                if not rect_coords:
                    continue
                rect = pymupdf.Rect(rect_coords)

                matched_word_indices = [
                    idx for idx, w in enumerate(words)
                    if rect.contains(pymupdf.Point((w[0] + w[2]) / 2, (w[1] + w[3]) / 2))
                ]

                anchor = " ".join([words[i][4] for i in matched_word_indices]).strip()
                if not anchor:
                    anchor = page.get_text("text", clip=rect).strip().replace("\n", " ")
                if not anchor:
                    anchor = "Link"

                kind, slug = classify_url(uri)
                link_info = {
                    "url": uri,
                    "anchor_text": anchor,
                    "label": anchor,
                    "page": page_idx,
                    "y_position": rect.y0,
                    "x_position": rect.x0,
                    "rect": [rect.x0, rect.y0, rect.x1, rect.y1],
                    "kind": kind,
                    "slug": slug
                }
                extracted_links.append(link_info)

                if matched_word_indices:
                    # Attach link annotation to the last word of the anchor phrase
                    word_to_link[matched_word_indices[-1]] = link_info

            # Group words by (block_no, line_no)
            lines_dict = defaultdict(list)
            for idx, w in enumerate(words):
                lines_dict[(w[5], w[6])].append((idx, w))

            formatted_lines = []
            sorted_line_keys = sorted(
                lines_dict.keys(),
                key=lambda k: (round(lines_dict[k][0][1][1] / 10) * 10, lines_dict[k][0][1][0])
            )

            for key in sorted_line_keys:
                line_words = lines_dict[key]
                line_words.sort(key=lambda item: item[1][0])
                line_tokens = []
                for idx, w in line_words:
                    w_text = w[4]
                    if idx in word_to_link:
                        linfo = word_to_link[idx]
                        line_tokens.append(f"{w_text} [link: {linfo['anchor_text']} -> {linfo['url']}]")
                    else:
                        line_tokens.append(w_text)
                formatted_lines.append(" ".join(line_tokens))

            page_content = "\n".join(formatted_lines).strip()
            if not page_content:
                # Fallback to standard block extraction if word extraction returned empty
                blocks = page.get_text("blocks")
                sorted_blocks = sorted(blocks, key=lambda b: (round(b[1] / 12) * 12, b[0]))
                page_content = "\n".join([b[4].strip() for b in sorted_blocks if b[4].strip()])

            if page_content:
                page_texts.append(page_content)

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

    # Append structured hyperlink block at end for clarity
    if extracted_links:
        link_block = "\n\n--- EMBEDDED HYPERLINKS IN RESUME ---\n"
        for l in extracted_links:
            link_block += f"- Anchor: '{l.get('anchor_text', l.get('label', 'Link'))}' -> URL: {l['url']}\n"
        raw_text = raw_text + link_block

    return raw_text, extracted_links, ocr_used


def extract_text_from_docx(file_bytes: bytes) -> Tuple[str, List[Dict[str, Any]]]:
    """Extract text and hyperlinks from DOCX including tables and textboxes"""
    text_lines = []
    links: List[Dict[str, Any]] = []
    try:
        import docx
        from docx.oxml.ns import qn

        doc = docx.Document(io.BytesIO(file_bytes))

        def process_para(p) -> str:
            parts = []
            for child in p._p:
                if child.tag.endswith('r'):
                    t = child.find(qn('w:t'))
                    if t is not None and t.text:
                        parts.append(t.text)
                elif child.tag.endswith('hyperlink'):
                    r_id = child.get(qn('r:id'))
                    h_text = "".join(child.itertext()).strip()
                    target_url = ""
                    if r_id and r_id in p.part.rels:
                        target_url = p.part.rels[r_id].target_ref
                    if target_url and target_url.startswith("http"):
                        kind, slug = classify_url(target_url)
                        links.append({
                            "url": target_url,
                            "anchor_text": h_text or "Link",
                            "label": h_text or "Link",
                            "page": 0,
                            "y_position": 0.0,
                            "kind": kind,
                            "slug": slug
                        })
                        parts.append(f"{h_text} [link: {h_text} -> {target_url}]")
                    elif h_text:
                        parts.append(h_text)
            return "".join(parts).strip()

        for para in doc.paragraphs:
            para_str = process_para(para)
            if para_str:
                text_lines.append(para_str)

        for table in doc.tables:
            for row in table.rows:
                row_parts = []
                for cell in row.cells:
                    cell_lines = []
                    for cp in cell.paragraphs:
                        cp_str = process_para(cp)
                        if cp_str:
                            cell_lines.append(cp_str)
                    if cell_lines:
                        row_parts.append(" ".join(cell_lines))
                if row_parts:
                    text_lines.append(" | ".join(row_parts))

        # Check all relationship hyperlinks in document
        for rel in doc.part.rels.values():
            if "hyperlink" in rel.reltype:
                target_url = rel.target_ref
                if target_url.startswith("http") and not any(l["url"] == target_url for l in links):
                    kind, slug = classify_url(target_url)
                    links.append({
                        "url": target_url,
                        "label": "Link",
                        "anchor_text": "Link",
                        "page": 0,
                        "y_position": 0.0,
                        "kind": kind,
                        "slug": slug
                    })

        raw_text = "\n".join(text_lines)
        if links:
            raw_text += "\n\n--- EMBEDDED HYPERLINKS ---\n" + "\n".join([f"- Anchor: '{l['anchor_text']}' -> URL: {l['url']}" for l in links])

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


def associate_project_links(
    projects: List[ProjectItem],
    extracted_links: List[Dict[str, Any]],
    raw_text: str
) -> List[ProjectItem]:
    """
    Deterministic Fallback:
    Associates extracted repository and live demo hyperlinks with each project
    using spatial proximity, anchor text, and fuzzy title-to-repo-slug matching.
    Never fabricates a URL from scratch.
    """
    if not extracted_links:
        return projects

    github_repo_links = []
    demo_links = []

    for l in extracted_links:
        url = l.get("url", "")
        if not url:
            continue
        kind = l.get("kind")
        slug = l.get("slug")
        if not kind or slug is None:
            kind, slug = classify_url(url)
            l["kind"] = kind
            l["slug"] = slug
        if kind == "github_repo":
            github_repo_links.append(l)
        elif kind == "demo":
            demo_links.append(l)

    assigned_gh_urls = set()
    assigned_demo_urls = set()

    for proj in projects:
        # Check domain classification on any existing links
        if proj.github_url:
            kind, _ = classify_url(proj.github_url)
            if kind == "demo" and not proj.demo_url:
                proj.demo_url = proj.github_url
                proj.github_url = None
            elif kind == "github_profile":
                proj.github_url = None
            elif kind == "github_repo":
                assigned_gh_urls.add(proj.github_url)

        if proj.demo_url:
            kind, _ = classify_url(proj.demo_url)
            if kind == "github_repo" and not proj.github_url:
                proj.github_url = proj.demo_url
                proj.demo_url = None
            elif kind == "demo":
                assigned_demo_urls.add(proj.demo_url)

        # Check if single 'link' field has a URL
        if proj.link:
            kind, _ = classify_url(proj.link)
            if kind == "github_repo" and not proj.github_url:
                proj.github_url = proj.link
                assigned_gh_urls.add(proj.link)
            elif kind == "demo" and not proj.demo_url:
                proj.demo_url = proj.link
                assigned_demo_urls.add(proj.link)

    # Position-based association:
    # 1. First find project block boundaries in raw_text
    title_positions = []
    raw_lower = raw_text.lower()
    for idx, proj in enumerate(projects):
        if proj.title:
            t_norm = proj.title.strip().lower()
            # Try to find title in text
            pos = raw_lower.find(t_norm[:min(25, len(t_norm))])
            if pos != -1:
                title_positions.append((pos, idx))
    title_positions.sort(key=lambda x: x[0])

    # Assign block boundaries [start_pos, end_pos)
    project_blocks = {}
    for i, (pos, p_idx) in enumerate(title_positions):
        next_pos = title_positions[i + 1][0] if i + 1 < len(title_positions) else len(raw_text)
        project_blocks[p_idx] = (pos, next_pos)

    # 2. Block-based matching: links inside the project's text block
    for idx, proj in enumerate(projects):
        p_title_norm = normalize_text(proj.title)
        block_text = ""
        if idx in project_blocks:
            b_start, b_end = project_blocks[idx]
            block_text = raw_text[b_start:b_end].lower()

        # Match GitHub Repo URL
        if not proj.github_url and github_repo_links:
            candidate_gh = []
            for gh in github_repo_links:
                if gh["url"] in assigned_gh_urls:
                    continue
                u_low = gh["url"].lower()
                slug_low = gh.get("slug", "").lower()
                # Check if this URL appears within the project block
                if block_text and (u_low in block_text or (slug_low and slug_low in block_text)):
                    candidate_gh.append(gh)

            if len(candidate_gh) == 1:
                proj.github_url = candidate_gh[0]["url"]
                assigned_gh_urls.add(candidate_gh[0]["url"])
            elif len(candidate_gh) > 1:
                # Prefer the one whose repo slug fuzzy-matches the project name
                best_gh = max(candidate_gh, key=lambda g: fuzz.partial_ratio(g.get("slug", "").replace("_", " ").replace("-", " "), p_title_norm))
                proj.github_url = best_gh["url"]
                assigned_gh_urls.add(best_gh["url"])
            else:
                # Fallback: fuzzy match slug or global proximity
                best_match = None
                best_score = 0.0
                for gh in github_repo_links:
                    if gh["url"] in assigned_gh_urls:
                        continue
                    slug_norm = gh.get("slug", "").replace("_", " ").replace("-", " ").lower()
                    score = fuzz.partial_ratio(slug_norm, p_title_norm) if slug_norm else 0.0
                    if gh.get("slug", "").lower() in p_title_norm:
                        score = max(score, 90.0)
                    if score > best_score:
                        best_score = score
                        best_match = gh
                if best_match and best_score >= 60.0:
                    proj.github_url = best_match["url"]
                    assigned_gh_urls.add(best_match["url"])

        # Match Live Demo URL
        if not proj.demo_url and demo_links:
            candidate_demo = []
            for d in demo_links:
                if d["url"] in assigned_demo_urls:
                    continue
                if block_text and d["url"].lower() in block_text:
                    candidate_demo.append(d)

            if len(candidate_demo) == 1:
                proj.demo_url = candidate_demo[0]["url"]
                assigned_demo_urls.add(candidate_demo[0]["url"])
            elif len(candidate_demo) > 1:
                proj.demo_url = candidate_demo[0]["url"]
                assigned_demo_urls.add(candidate_demo[0]["url"])
            else:
                best_demo = None
                best_score = 0.0
                for d in demo_links:
                    if d["url"] in assigned_demo_urls:
                        continue
                    url_clean = re.sub(r"https?://|\.vercel\.app|\.netlify\.app|\.render\.com|/", " ", d["url"].lower())
                    score = fuzz.partial_ratio(url_clean, p_title_norm)
                    if score > best_score:
                        best_score = score
                        best_demo = d
                if best_demo and best_score >= 55.0:
                    proj.demo_url = best_demo["url"]
                    assigned_demo_urls.add(best_demo["url"])

        # Synchronize proj.links and proj.link
        proj.link = proj.demo_url or proj.github_url or proj.link
        from app.schemas.profile import ProjectLinks
        if not proj.links:
            proj.links = ProjectLinks(github_repo=proj.github_url, live_demo=proj.demo_url)
        else:
            proj.links.github_repo = proj.github_url
            proj.links.live_demo = proj.demo_url

    return projects


class ResumeParserService:
    @staticmethod
    async def parse_resume_file(
        file_bytes: bytes,
        filename: str
    ) -> Tuple[MasterProfileData, str, List[Dict[str, Any]], bool, str]:
        """
        Parses resume file into structured MasterProfileData.
        Returns: (parsed_profile, raw_text, extracted_links, ocr_used, parsing_mode)
        """
        filename_lower = filename.lower()
        raw_text = ""
        extracted_links: List[Dict[str, Any]] = []
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
            "1. Do NOT invent or hallucinate any degrees, employers, skills, or URLs.\n"
            "2. Extract contact information accurately (full_name, email, phone, location, linkedin, github, portfolio).\n"
            "   Check the embedded hyperlinks section for LinkedIn, GitHub, portfolio, and project links.\n"
            "3. Categorize technical skills into: languages, frameworks, databases, tools, cloud_devops, soft_skills.\n"
            "4. Extract all experience items with company, role, dates, location, bullets.\n"
            "5. Extract all projects with:\n"
            "   - title: Project name\n"
            "   - github_url: The GitHub repository URL (e.g. https://github.com/user/repo). Look for inline tags [link: GitHub -> https://github.com/...]\n"
            "   - demo_url: The Live Demo or deployment URL (e.g. https://...vercel.app). Look for inline tags [link: Live -> https://...]\n"
            "   - role: ONLY fill if explicitly written in resume (e.g. 'Sole Creator', 'Lead Developer'); otherwise set to null.\n"
            "   - description: 1-2 sentence high-level overview ONLY if explicitly present before bullets; do NOT fabricate or copy bullets as description.\n"
            "   - tech_stack: List of technologies used\n"
            "   - bullets: Key accomplishments\n"
            "6. Extract all education with institution, degree, field_of_study, dates, gpa.\n"
            "7. Never fabricate URLs. If a project does not have a repo link, set github_url to null."
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

        # Deterministic project link association fallback & domain classification
        if profile_data and profile_data.projects:
            profile_data.projects = associate_project_links(profile_data.projects, extracted_links, raw_text)

        # Cross-populate links if missing in contact_info but found in extracted_links
        if extracted_links and profile_data:
            contact = profile_data.contact_info
            for l in extracted_links:
                url = l.get("url", "")
                if not url:
                    continue
                kind = l.get("kind")
                if not kind:
                    kind, _ = classify_url(url)
                if kind == "linkedin" and not contact.linkedin:
                    contact.linkedin = url
                elif kind == "github_profile" and not contact.github:
                    contact.github = url
                elif kind == "demo" and ("portfolio" in l.get("label", "").lower() or "portfolio" in l.get("anchor_text", "").lower() or not contact.portfolio):
                    if not contact.portfolio and "vercel.app" in url.lower() and not any(p.demo_url == url for p in profile_data.projects):
                        contact.portfolio = url

        return profile_data, raw_text, extracted_links, ocr_used, parsing_mode


resume_parser_service = ResumeParserService()
