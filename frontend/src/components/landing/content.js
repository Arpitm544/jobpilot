export const landingContent = {
  nav: {
    brand: "JobPilot",
    brandSubtitle: "Autonomous Career Agent",
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "Features", href: "#features" },
      { label: "Zero Hallucination", href: "#zero-hallucination" },
      { label: "Audience", href: "#who-its-for" },
      { label: "FAQ", href: "#faq" },
    ],
    cta: {
      login: "Log in",
      getStarted: "Get Started Free",
      dashboard: "Go to Dashboard",
    },
  },

  hero: {
    badge: "Zero Hallucination Resume Tailoring",
    title: "Your AI agent that finds jobs and applies for you",
    subtitle:
      "Upload your resume once. JobPilot discovers matching roles, tailors your resume to every job description, and applies — with you in total control.",
    primaryCta: "Get Started Free",
    secondaryCta: "See how it works",
    trustLine: "You review before anything is submitted. No fabricated skills, ever.",
    mockup: {
      matchScore: 87,
      scoreLabel: "Match Score",
      role: "Senior Full-Stack Engineer",
      company: "Linear",
      location: "Remote / Hybrid",
      salary: "$140,000 – $180,000",
      skills: ["FastAPI", "React", "PostgreSQL", "Next.js", "Redis"],
      status: "Tailored ATS resume ready",
      bulletHighlight: "Re-engineered async data pipelines reducing ingestion latency by 45%.",
      reviewModeText: "Review Mode: Ready for your 1-click confirmation",
    },
  },

  howItWorks: {
    eyebrow: "Workflow",
    title: "How JobPilot Works",
    subtitle: "From a single resume upload to targeted job submissions in four automated steps.",
    steps: [
      {
        stepNumber: "01",
        icon: "FileUp",
        title: "Upload resume",
        description: "Drop your PDF/DOCX resume once. JobPilot extracts your verified skills, metrics, and career history.",
      },
      {
        stepNumber: "02",
        icon: "Sliders",
        title: "Choose target roles",
        description: "Select preferences like Frontend, Backend, Full-Stack, location, minimum CTC, or custom role titles.",
      },
      {
        stepNumber: "03",
        icon: "Sparkles",
        title: "AI finds & tailors",
        description: "Our agent monitors live ATS boards, scores relevance, and crafts an honest, JD-specific 1-page ATS resume.",
      },
      {
        stepNumber: "04",
        icon: "Send",
        title: "Apply & track",
        description: "Review tailored applications in your pipeline or let the auto-apply agent submit with daily caps and screenshot proof.",
      },
    ],
  },

  features: {
    eyebrow: "Core Capabilities",
    title: "Engineered for speed, precision, and trust",
    subtitle: "Everything you need to automate repetitive job searches without sacrificing quality or credibility.",
    items: [
      {
        icon: "Search",
        title: "Multi-Role Job Discovery",
        description:
          "Continuously indexes live postings across Greenhouse, Lever, Ashby, and top portals with automated deduplication.",
      },
      {
        icon: "PieChart",
        title: "Match Score & 'Why This Score'",
        description:
          "Clear breakdown of skill overlap, seniority alignment, and missing keywords so you know exactly why a job was scored.",
      },
      {
        icon: "FileText",
        title: "JD-Tailored, ATS-Friendly Resume",
        description:
          "Dynamically formats clean, single-page PDF resumes using high-conversion ATS typography and structured sections.",
      },
      {
        icon: "ShieldCheck",
        title: "Zero-Hallucination Verification",
        description:
          "Dual-pass AI cross-checks every bullet against your master profile. Nothing is fabricated or exaggerated.",
      },
      {
        icon: "SlidersHorizontal",
        title: "Auto-Apply with Daily Caps",
        description:
          "Enforce daily submission limits (e.g., 10–25/day), randomize human-like delays, and inspect full screenshot audit trails.",
      },
      {
        icon: "Kanban",
        title: "Application Tracker Pipeline",
        description:
          "Kanban board tracks every job from Discovered and Tailored to Review Ready, Applied, Interview, and Offer.",
      },
      {
        icon: "HelpCircle",
        title: "Common Questions Bank",
        description:
          "Store your work authorization, notice period, salary expectations, and demographic answers once — reused everywhere.",
      },
      {
        icon: "MailCheck",
        title: "Gmail Sync & Follow-Ups",
        badge: "Built-In",
        description:
          "Classifies inbound recruiter emails (Interview, Rejection, Screen) and generates contextual follow-up reply drafts.",
      },
    ],
  },

  hallucination: {
    eyebrow: "Integrity First",
    title: "Zero Hallucination: The Antidote to 'AI Fluff'",
    subtitle:
      "Most AI tools invent qualifications that collapse during technical screens. JobPilot enforces a mathematical boundary: we only reorder, reword, and emphasize what is 100% verified in your profile.",
    comparison: {
      originalLabel: "Original Resume Bullet",
      originalText:
        "Worked on backend APIs using Python and PostgreSQL. Improved speed and managed database migrations for customer services.",
      tailoredLabel: "Tailored to Stripe Infrastructure JD",
      tailoredText:
        "Architected distributed REST endpoints using Python and PostgreSQL, optimizing database indexes and query plans to reduce API latency by 45%.",
      verificationBadge: "100% Verified against master profile",
      explanation:
        "JobPilot connects your proven experience with the exact keywords recruiters search for. It sharpens impact and technical terminology without fabricating unearned skills, companies, or metrics.",
    },
  },

  control: {
    eyebrow: "Guardrails",
    title: "You Stay in Absolute Control",
    subtitle: "Autonomous assistance designed with enterprise-grade safety parameters.",
    points: [
      {
        icon: "Eye",
        title: "Review-then-Apply by Default",
        description:
          "Every staged application presents the tailored resume, form preview, and target URL for one-click approval before any submission.",
      },
      {
        icon: "Power",
        title: "Kill Switch & Daily Limits",
        description:
          "Halt all background automation instantly with one click. Configure conservative daily submission caps to protect your accounts.",
      },
      {
        icon: "ShieldAlert",
        title: "CAPTCHA & Unknown Question Pause",
        description:
          "The agent never guesses sensitive fields. If an ATS presents a CAPTCHA or unlisted question, it immediately pauses and requests your input.",
      },
    ],
  },

  audience: {
    eyebrow: "Tailored For You",
    title: "Who JobPilot Is Built For",
    subtitle: "Optimized for candidates navigating today's high-volume job market.",
    cards: [
      {
        icon: "GraduationCap",
        category: "Students & Freshers",
        description:
          "Break into tech with tailored early-career resumes. Supports summer internships, stipend tracking, and entry-level engineering roles.",
        highlights: ["Internship & entry-level filtering", "Highlight academic projects & hackathons", "Stipend & CTC benchmarks"],
      },
      {
        icon: "GitBranch",
        category: "Career Switchers",
        description:
          "Bridge the gap into software development. Re-frame previous domain expertise and transferable technical skills for tech recruiters.",
        highlights: ["Transferable skill mapping", "Domain-to-software translation", "Focus on practical projects & stack overlap"],
      },
      {
        icon: "Briefcase",
        category: "Busy Professionals",
        description:
          "Reclaim 15+ hours a week spent manually filling repetitive Workday, Lever, and Greenhouse forms for high-LPA and senior roles.",
        highlights: ["High-LPA & senior tier targeting", "Automated custom cover letters", "Human review mode for selective roles"],
      },
    ],
  },

  faq: {
    eyebrow: "Answers",
    title: "Frequently Asked Questions",
    subtitle: "Everything you need to know about safety, automation, and privacy.",
    items: [
      {
        question: "Is it safe for my accounts and job applications?",
        answer:
          "Yes. By default, JobPilot operates in 'Review Mode' where you inspect every tailored PDF and application field before submission. When using auto-apply, built-in rate limiters enforce daily caps (e.g. 15–20 applications/day) with human-like jitter delays to prevent platform flags and comply with platform fair-use practices.",
      },
      {
        question: "Will JobPilot make up skills or fake experience on my resume?",
        answer:
          "Never. Our dual-pass verification system rejects any generated bullet that claims a skill, company, metric, or title not present in your Master Profile. We only reorder, highlight, and adjust vocabulary to match the job description's ATS keywords.",
      },
      {
        question: "Which job boards and ATS platforms are supported?",
        answer:
          "JobPilot supports Greenhouse, Lever, Ashby, and direct company careers portals. You can also paste any raw job posting URL or job description text directly into the dashboard for immediate match scoring and tailoring.",
      },
      {
        question: "Can I apply to multiple roles or role types at once?",
        answer:
          "Yes. You can configure multiple target roles simultaneously (e.g. 'Frontend Engineer', 'Backend Developer', and 'Full-Stack Developer') with distinct location preferences, salary minimums, and remote options.",
      },
      {
        question: "Can I edit the resume or cover letter before applying?",
        answer:
          "Absolutely. Every tailored resume can be edited inline or regenerated with custom instructions before you click approve. You maintain 100% editorial authority over every submission.",
      },
      {
        question: "Is my personal data and resume private?",
        answer:
          "Your data is strictly yours. Master profiles and resumes are stored securely with encrypted database connections and tokenized sessions. We do not sell your data or train shared AI models on your personal resume, and you can delete your profile and application history at any time.",
      },
    ],
  },

  ctaBanner: {
    title: "Stop applying one by one.",
    subtitle: "Join candidates who let AI handle discovery, tailoring, and form-filling while keeping full control.",
    buttonText: "Get Started Free",
    secondaryText: "No credit card required. Free tier available.",
  },

  footer: {
    tagline: "Autonomous career agent for modern software professionals.",
    links: [
      { label: "Privacy Policy", href: "#" },
      { label: "Terms of Service", href: "#" },
      { label: "Security & Safety", href: "#zero-hallucination" },
      { label: "Documentation", href: "#how-it-works" },
      { label: "Contact", href: "mailto:support@jobpilot.io" },
    ],
    copyright: "© 2026 JobPilot Inc. All rights reserved.",
  },
};
