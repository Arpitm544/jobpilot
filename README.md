# JobPilot — Autonomous AI Job Search & Application Platform

> An enterprise-grade, autonomous platform that discovers matching software engineering jobs across public ATS boards, tailors ATS-compliant 1-page resumes with **zero hallucination**, and applies on the candidate's behalf.

---

## 🌟 Key Features

1. **Intelligent Onboarding & Master Profile**: Upload PDF or DOCX resumes; parsed via layout analysis (`pdfplumber` / `PyMuPDF` / `python-docx`) and structured into a unified JSON Master Profile using **Google Gemini 2.0**.
2. **Deterministic Source of Truth**: AI is strictly constrained to reword, reorder, and emphasize existing experiences. Every claim is verified in a dual-pass audit.
3. **Multi-Source ATS Discovery**: Continuous discovery across Greenhouse, Lever, Ashby, and Workable boards with fuzzy deduplication.
4. **ATS Resume & Cover Letter Tailoring**: 1-page ATS PDF generation with customized bullets in *Action + Tech + Impact* format.
5. **Human-in-the-Loop Auto-Apply**: Playwright headless browser workers supporting Review-then-apply, Controlled daily caps, or Full Auto mode.

---

## 🏗️ Architecture & Monorepo Structure

```
job_pilot/
├── .env.example              # Sample environment variables
├── docker-compose.yml        # PostgreSQL, Redis, FastAPI, Celery, Next.js
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py           # FastAPI entrypoint
│       ├── config.py         # Pydantic Settings
│       ├── database.py       # SQLAlchemy 2.0 async engine
│       ├── models/           # All 10 core SQLAlchemy models
│       ├── schemas/          # Pydantic v2 schemas
│       ├── services/         # Auth, Gemini AI, resume parser, security
│       ├── api/              # API v1 routes (auth, profile, preferences)
│       ├── adapters/         # Playwright ATS form fillers
│       └── workers/          # Celery discovery & apply tasks
└── frontend/
    ├── package.json
    ├── tailwind.config.js
    └── src/
        ├── app/              # Next.js App Router (JS only)
        │   ├── page.js       # High-converting landing page
        │   ├── login/        # JWT Authentication
        │   ├── register/     # Account registration
        │   ├── onboarding/   # 4-step resume upload & profile editor
        │   └── dashboard/    # Master Profile & Pipeline
        ├── components/       # Glassmorphic UI components
        └── lib/              # Axios client with refresh tokens & AuthContext
```

---

## 🚀 Quickstart Guide

### Option 1: Full Stack with Docker Compose
```bash
cp .env.example .env
# Add your GEMINI_API_KEY in .env
docker-compose up --build
```
- Frontend: `http://localhost:3000`
- Backend API Docs: `http://localhost:8000/docs`

---

### Option 2: Local Development

#### 1. Backend Setup
```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

#### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Visit `http://localhost:3000`.

---

## 🛡️ Database Schema Entities (SQLAlchemy 2.0)
- `users`: Authentication, access & refresh tokens, active status
- `master_profiles`: Structured profile (contact, summary, skills, experience, projects, education)
- `job_preferences`: Target roles, level, locations, salary, apply mode, daily cap
- `question_banks`: Common screening answers (work authorization, notice period, relocation)
- `sources`: ATS source platforms (Greenhouse, Lever, Ashby)
- `jobs`: Discovered listings with deduplication hash
- `job_matches`: Embedding and skill overlap scores
- `tailored_resumes`: Tailored bullets, ATS score, claim verification status
- `applications`: Application funnel status, proof screenshots, audit trail
- `application_events`: Real-time lifecycle events

---

## 🗺️ Build Roadmap
- [x] **Phase 1: Auth + Resume Parsing + Master Profile Editor**
- [x] **Phase 2: Job Discovery (Greenhouse/Lever/Ashby feeds) + Dedupe + Scoring**
- [x] **Phase 3: Tailoring Engine + ATS PDF Rendering + Dual-Pass Claim Verification**
- [x] **Phase 4: Review-Mode Dashboard + Kanban Pipeline + Playwright Dry-Run Proofs**
- [x] **Phase 5: Full Apply Engine + Celery Worker Fleet + Live Telemetry WebSockets + Kill Switch**
- [x] **Phase 6: Inbound Email Tracking & Sync + Analytics Dashboard + AI Follow-Up Generator + Manifest V3 Chrome Extension**
- [x] **Phase 7: End-to-End Pipeline Verification & Full Smoke Testing (All 9/9 stages verified)**

---

## 🧪 Automated Testing & E2E Test Suite

JobPilot includes a comprehensive end-to-end browser test suite powered by **Playwright** that exercises all 7 critical user flows across real browser automation, correlating UI state with backend API logs, network requests, and database persistence.

### Prerequisites
1. Ensure FastAPI backend is running on `http://127.0.0.1:8000`
2. Ensure Next.js frontend is running on `http://localhost:3000`
3. Ensure PostgreSQL (Neon) and Redis are reachable

### Run Backend Pytest Suite
```bash
# Run all unit, integration, and regression tests
cd backend
python -m pytest tests/ -v
```

### Run Playwright Browser E2E Test Suite
```bash
# From the repository root
python tests/test_e2e_browser_flows.py
```

### What the E2E Suite Tests:
- **Flow 1**: Landing page hero, anchors, sticky navbar, and CTA navigation.
- **Flow 2**: Route protection, unauthenticated redirects, registration, 7-day HttpOnly cookie lifecycle, and reload persistence.
- **Flow 3**: Step 1 Resume uploads across 6 format variants (`.exe` rejection, >5MB oversized rejection, corrupt fake PDF server signature validation, `.docx` extraction, scanned image PDF OCR/layout parsing, valid text PDF parsing with full stage transitions `queued -> extracting -> analyzing -> validating -> ready`).
- **Flow 4**: Step 2 Master profile review, zero `null` rendering, editing fields, adding/removing skills, and database persistence.
- **Flow 5**: Step 3 & 4 Preferences and Common Questions (India template with notice period and CTC), completion, pipeline redirection, and state persistence on revisit to `/onboarding`.
- **Flow 6**: Clean loading and correct empty states across all core dashboard pages (`/pipeline`, `/discovery`, `/analytics`, `/profile`, `/dashboard/*`).
- **Flow 7**: Edge cases including rapid button double-clicks, multi-tab session synchronization via `BroadcastChannel`, and secure sign-out.

All test screenshots and JSON test telemetry logs are saved to `logs/screenshots/` and `logs/phase1_browser_results.json`.

