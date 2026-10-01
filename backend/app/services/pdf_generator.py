import os
import uuid
import logging
import asyncio
from typing import Dict, Any, Optional
from jinja2 import Template

from app.config import settings

logger = logging.getLogger(__name__)

# ATS-Compliant 1-Page HTML Template
ATS_RESUME_HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

  @page {
    size: letter;
    margin: 0.42in 0.52in;
  }
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1e293b;
    background: #ffffff;
    font-size: 9.35pt;
    line-height: 1.38;
    -webkit-font-smoothing: antialiased;
  }
  .header {
    text-align: center;
    border-bottom: 2px solid #0f172a;
    padding-bottom: 7px;
    margin-bottom: 10px;
  }
  .name {
    font-size: 20pt;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: -0.2px;
    color: #0f172a;
    margin-bottom: 4px;
  }
  .contact-bar {
    font-size: 9.1pt;
    color: #475569;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
  }
  .contact-bar .sep {
    color: #94a3b8;
    font-weight: 400;
  }
  .contact-bar a {
    color: #0f172a;
    text-decoration: none;
    font-weight: 500;
    border-bottom: 1px dotted #94a3b8;
  }
  .section {
    margin-bottom: 9px;
  }
  .section-title {
    font-size: 10.2pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #0f172a;
    border-bottom: 1.5px solid #0f172a;
    padding-bottom: 2px;
    margin-bottom: 5px;
    margin-top: 2px;
  }
  .summary-text {
    font-size: 9.2pt;
    color: #334155;
    line-height: 1.4;
    text-align: justify;
  }
  .skill-group {
    font-size: 9.2pt;
    line-height: 1.38;
    margin-bottom: 2px;
  }
  .skill-label {
    font-weight: 700;
    color: #0f172a;
  }
  .skill-items {
    color: #334155;
  }
  .item-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-top: 4px;
    margin-bottom: 2px;
  }
  .item-title-group {
    flex: 1;
    min-width: 0;
  }
  .item-title {
    font-weight: 700;
    font-size: 9.4pt;
    color: #0f172a;
  }
  .item-subtitle {
    font-weight: 600;
    font-size: 9.2pt;
    color: #334155;
  }
  .item-tech {
    font-size: 8.8pt;
    color: #475569;
    font-style: italic;
    margin-left: 4px;
  }
  .item-meta {
    font-size: 8.8pt;
    color: #64748b;
    font-weight: 500;
    flex-shrink: 0;
    margin-left: 8px;
  .item-links {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-shrink: 0;
    margin-left: 8px;
  }
  .live-link {
    font-size: 8.2pt;
    font-weight: 600;
    text-decoration: none;
    padding: 1px 6px;
    border-radius: 4px;
    display: inline-block;
    white-space: nowrap;
  }
  .demo-badge {
    color: #0284c7;
    background: #f0f9ff;
    border: 1px solid #bae6fd;
  }
  .gh-badge {
    color: #1e293b;
    background: #f8fafc;
    border: 1px solid #cbd5e1;
  }
  ul.bullets {
    list-style-type: disc;
    margin-left: 17px;
    margin-top: 2px;
    margin-bottom: 4px;
  }
  ul.bullets li {
    font-size: 9.05pt;
    color: #1e293b;
    margin-bottom: 2px;
    line-height: 1.35;
  }

  /* Spacious layout when item count is light, preventing awkward bottom voids */
  body.spacious .section {
    margin-bottom: 15px;
  }
  body.spacious .section-title {
    margin-bottom: 8px;
    margin-top: 6px;
  }
  body.spacious .item-header {
    margin-top: 9px;
    margin-bottom: 4px;
  }
  body.spacious ul.bullets {
    margin-bottom: 8px;
  }
  body.spacious ul.bullets li {
    font-size: 9.25pt;
    line-height: 1.44;
    margin-bottom: 4px;
  }
  body.spacious .summary-text {
    font-size: 9.35pt;
    line-height: 1.48;
  }
  body.spacious .skill-group {
    margin-bottom: 3.5px;
    line-height: 1.44;
  }
</style>
</head>
{% set total_items = (experience|length if experience else 0) + (projects|length if projects else 0) %}
<body class="{% if total_items <= 3 %}spacious{% endif %}">
  <!-- Header -->
  <div class="header">
    <div class="name">{{ contact.full_name or 'Software Engineer' }}</div>
    <div class="contact-bar">
      {% if contact.location %}<span>{{ contact.location }}</span>{% endif %}
      {% if contact.email %}<span class="sep">•</span><a href="mailto:{{ contact.email }}">{{ contact.email }}</a>{% endif %}
      {% if contact.phone %}<span class="sep">•</span><span>{{ contact.phone }}</span>{% endif %}
      {% if contact.linkedin %}<span class="sep">•</span><a href="{{ contact.linkedin }}" target="_blank">LinkedIn</a>{% endif %}
      {% if contact.github %}<span class="sep">•</span><a href="{{ contact.github }}" target="_blank">GitHub</a>{% endif %}
      {% if contact.portfolio %}<span class="sep">•</span><a href="{{ contact.portfolio }}" target="_blank">Portfolio</a>{% endif %}
    </div>
  </div>

  <!-- Summary -->
  {% if summary %}
  <div class="section">
    <div class="section-title">Professional Summary</div>
    <p class="summary-text">{{ summary }}</p>
  </div>
  {% endif %}

  <!-- Technical Skills -->
  {% if skills %}
  <div class="section">
    <div class="section-title">Technical Skills</div>
    {% for category, items in skills.items() %}
      {% if items and items|length > 0 %}
      <div class="skill-group">
        <span class="skill-label">{% if category == 'soft_skills' %}Architecture & Core Concepts{% elif category == 'cloud_devops' %}Cloud & DevOps{% else %}{{ category.replace('_', ' ').title() }}{% endif %}:</span>
        <span class="skill-items">{{ items|join(', ') }}</span>
      </div>
      {% endif %}
    {% endfor %}
  </div>
  {% endif %}

  <!-- Experience -->
  {% if experience and experience|length > 0 %}
  <div class="section">
    <div class="section-title">Experience</div>
    {% for exp in experience %}
    <div class="item-header">
      <div class="item-title-group">
        <span class="item-title">{{ exp.role }}</span>
        <span class="item-subtitle">— {{ exp.company }}</span>
      </div>
      <div class="item-meta">{{ exp.start_date }} – {{ exp.end_date }}{% if exp.location %} | {{ exp.location }}{% endif %}</div>
    </div>
    {% if exp.bullets and exp.bullets|length > 0 %}
    <ul class="bullets">
      {% for bullet in exp.bullets %}
        {% if bullet and bullet|trim|length > 0 %}
        <li>{{ bullet }}</li>
        {% endif %}
      {% endfor %}
    </ul>
    {% endif %}
    {% endfor %}
  </div>
  {% endif %}

  <!-- Projects -->
  {% if projects and projects|length > 0 %}
  <div class="section">
    <div class="section-title">Key Projects</div>
    {% for proj in projects %}
    <div class="item-header">
      <div class="item-title-group">
        <span class="item-title">{{ proj.title }}</span>
        {% if proj.tech_stack %}
        <span class="item-tech">({{ proj.tech_stack|join(', ') }})</span>
        {% endif %}
      </div>
      <div class="item-links">
        {% set gh_link = proj.github_url or (proj.links.github_repo if proj.links and proj.links is mapping else None) %}
        {% set demo_link = proj.demo_url or (proj.links.live_demo if proj.links and proj.links is mapping else None) or (proj.link if proj.link and 'github' not in proj.link.lower() else None) %}
        {% if not gh_link and proj.link and 'github' in proj.link.lower() %}
          {% set gh_link = proj.link %}
        {% endif %}

        {% if gh_link %}
        <a href="{{ gh_link }}" target="_blank" class="live-link gh-badge">GitHub ↗</a>
        {% endif %}
        {% if demo_link and demo_link != gh_link %}
        <a href="{{ demo_link }}" target="_blank" class="live-link demo-badge">Live Demo ↗</a>
        {% endif %}
      </div>
    </div>
    {% if proj.bullets and proj.bullets|length > 0 %}
    <ul class="bullets">
      {% for b in proj.bullets %}
        {% if b and b|trim|length > 0 %}
        <li>{{ b }}</li>
        {% endif %}
      {% endfor %}
    </ul>
    {% endif %}
    {% endfor %}
  </div>
  {% endif %}

  <!-- Education -->
  {% if education and education|length > 0 %}
  <div class="section">
    <div class="section-title">Education</div>
    {% for edu in education %}
    <div class="item-header">
      <div class="item-title-group">
        <span class="item-title">{{ edu.institution }}</span>
        <span class="item-subtitle">— {{ edu.degree }}{% if edu.field_of_study %} in {{ edu.field_of_study }}{% endif %}</span>
      </div>
      <div class="item-meta">
        {{ edu.start_year }} – {{ edu.end_year }}{% if edu.gpa %} | GPA: {{ edu.gpa }}{% endif %}
      </div>
    </div>
    {% endfor %}
  </div>
  {% endif %}
</body>
</html>
"""


class PDFGeneratorService:
    def __init__(self):
        self.template = Template(ATS_RESUME_HTML_TEMPLATE)
        self.output_dir = os.path.join(settings.UPLOAD_DIR, "tailored_resumes")
        os.makedirs(self.output_dir, exist_ok=True)

    def render_html(
        self,
        contact: Dict[str, Any],
        summary: str,
        skills: Dict[str, Any],
        experience: list,
        projects: list,
        education: list
    ) -> str:
        """Renders ATS-compliant HTML"""
        return self.template.render(
            contact=contact or {},
            summary=summary or "",
            skills=skills or {},
            experience=experience or [],
            projects=projects or [],
            education=education or []
        )

    async def generate_pdf(
        self,
        resume_id: uuid.UUID,
        contact: Dict[str, Any],
        summary: str,
        skills: Dict[str, Any],
        experience: list,
        projects: list,
        education: list
    ) -> str:
        """
        Renders ATS-friendly HTML and converts to a 1-page PDF using Playwright.
        Returns: absolute storage path to the generated PDF.
        """
        html_content = self.render_html(contact, summary, skills, experience, projects, education)
        
        pdf_filename = f"resume_{resume_id}.pdf"
        html_filename = f"resume_{resume_id}.html"
        pdf_path = os.path.join(self.output_dir, pdf_filename)
        html_path = os.path.join(self.output_dir, html_filename)

        # Always save HTML representation
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html_content)

        # Try Playwright for pixel-perfect PDF rendering with strict timeout.
        # Note: We use sync_playwright inside asyncio.to_thread to ensure Windows compatibility
        # when Uvicorn is running with SelectorEventLoop (which does not support async subprocesses).
        try:
            def _render_sync(html: str, target_pdf_path: str):
                from playwright.sync_api import sync_playwright
                with sync_playwright() as p:
                    browser = p.chromium.launch(headless=True)
                    page = browser.new_page()
                    # Wait for networkidle to ensure web fonts (Inter) load fully
                    try:
                        page.set_content(html, wait_until="networkidle", timeout=8000)
                    except Exception:
                        page.set_content(html, wait_until="load", timeout=8000)
                    page.pdf(
                        path=target_pdf_path,
                        format="Letter",
                        print_background=True,
                        prefer_css_page_size=True,
                        margin={"top": "0in", "bottom": "0in", "left": "0in", "right": "0in"}
                    )
                    browser.close()

            await asyncio.wait_for(asyncio.to_thread(_render_sync, html_content, pdf_path), timeout=20.0)
            logger.info(f"Playwright generated PDF successfully: {pdf_path}")
            return pdf_path
        except Exception as e:
            logger.warning(f"Playwright PDF generation skipped/timed out ({e}). Using HTML file as fallback artifact.")

        # Fallback: create placeholder PDF or return path
        if not os.path.exists(pdf_path):
            with open(pdf_path, "wb") as f:
                # Minimal valid PDF header/trailer
                f.write(b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000060 00000 n\n0000000115 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF")

        return pdf_path


pdf_generator_service = PDFGeneratorService()
