'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/authContext';
import { api } from '@/lib/api';
import ResumeUploader from '@/components/resume/ResumeUploader';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Plus,
  Trash2,
  Code,
  Eye,
  Sliders,
  HelpCircle,
  ShieldCheck,
  Building2,
  Briefcase,
  MapPin,
  DollarSign,
  User,
  Info,
  GraduationCap,
  FolderGit2,
  Award,
  Trophy,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Github,
  X
} from 'lucide-react';

const SAMPLE_RESUME_TEXT = `Alex Mercer
alex.mercer@devmail.com | +1 (555) 382-9901 | San Francisco, CA
https://linkedin.com/in/alexmercer | https://github.com/alexmercer

Professional Summary:
Passionate Full-Stack Engineer with 3+ years of experience architecting high-performance web applications using React, Next.js, FastAPI, and PostgreSQL. Experienced in building automated pipelines, microservices, and modern UI systems.

Technical Skills:
- Languages: JavaScript, Python, TypeScript, SQL, HTML, CSS
- Frameworks & Libraries: React, Next.js, FastAPI, Node.js, Tailwind CSS, Express
- Databases: PostgreSQL, Redis, MongoDB, SQLite
- Cloud & DevOps: Docker, AWS, Git, CI/CD, Linux

Experience:
Senior Software Engineer | CloudScale Inc.
June 2022 - Present | San Francisco, CA
- Built scalable distributed backend microservices handling 25,000+ requests per second using FastAPI and Redis.
- Redesigned core dashboard using Next.js and Tailwind CSS, improving page load speeds by 42%.
- Integrated automated testing suites and CI/CD pipelines reducing deployment failure rates by 35%.

Software Engineer Intern | Innovate Labs
Jan 2021 - May 2022 | Remote
- Developed reusable UI components and state management with React and TanStack Query.
- Architected RESTful endpoints and optimized database queries in PostgreSQL.

Education:
B.S. in Computer Science | University of California, Berkeley
2018 - 2022 | GPA: 3.85 / 4.0`;

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [step, setStep] = useState(1);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [viewJson, setViewJson] = useState(false);
  const [parseMetadata, setParseMetadata] = useState(null);
  const [accountFallbackFields, setAccountFallbackFields] = useState({});
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Step 1: Resume File
  const [selectedFile, setSelectedFile] = useState(null);
  const [activeResumeId, setActiveResumeId] = useState(null);

  // Strict sanitization helper: cleans null, undefined, "null", "undefined" to empty string
  const cleanStr = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val).trim();
    if (str === 'null' || str === 'undefined') return '';
    return str;
  };

  // Mapper function ensuring consistent snake_case schema from API to frontend form
  const mapApiProfileToForm = (apiProfile, currentUser = null) => {
    const contact = apiProfile?.contact_info || {};
    const fallbacks = {};

    let fullName = cleanStr(contact.full_name);
    if (!fullName && currentUser?.full_name) {
      fullName = cleanStr(currentUser.full_name);
      fallbacks.full_name = true;
    }

    let email = cleanStr(contact.email);
    if (!email && currentUser?.email) {
      email = cleanStr(currentUser.email);
      fallbacks.email = true;
    }

    setAccountFallbackFields(fallbacks);

    return {
      contact_info: {
        full_name: fullName,
        email: email,
        phone: cleanStr(contact.phone),
        location: cleanStr(contact.location),
        linkedin: cleanStr(contact.linkedin),
        github: cleanStr(contact.github),
        portfolio: cleanStr(contact.portfolio),
      },
      summary: cleanStr(apiProfile?.summary),
      skills: {
        languages: (apiProfile?.skills?.languages || []).map(cleanStr).filter(Boolean),
        frameworks: (apiProfile?.skills?.frameworks || []).map(cleanStr).filter(Boolean),
        databases: (apiProfile?.skills?.databases || []).map(cleanStr).filter(Boolean),
        tools: (apiProfile?.skills?.tools || []).map(cleanStr).filter(Boolean),
        cloud_devops: (apiProfile?.skills?.cloud_devops || []).map(cleanStr).filter(Boolean),
        soft_skills: (apiProfile?.skills?.soft_skills || []).map(cleanStr).filter(Boolean),
      },
      education: (apiProfile?.education || []).map((e) => ({
        institution: cleanStr(e.institution || e.school || e.college),
        degree: cleanStr(e.degree),
        field_of_study: cleanStr(e.field_of_study || e.major),
        start_year: cleanStr(e.start_year || e.start_date),
        end_year: cleanStr(e.end_year || e.end_date),
        grade_type: cleanStr(e.grade_type) || 'CGPA',
        grade_value: cleanStr(e.grade_value || e.gpa),
        secondary_percentage: cleanStr(e.secondary_percentage),
      })),
      experience: (apiProfile?.experience || []).map((exp) => ({
        company: cleanStr(exp.company),
        role: cleanStr(exp.role || exp.title),
        start_date: cleanStr(exp.start_date || exp.start_year),
        end_date: cleanStr(exp.end_date || exp.end_year),
        is_current: Boolean(exp.is_current),
        location: cleanStr(exp.location),
        bullets: Array.isArray(exp.bullets)
          ? exp.bullets.map(cleanStr).filter(Boolean)
          : (typeof exp.bullets === 'string' ? exp.bullets.split('\n').map(cleanStr).filter(Boolean) : []),
      })),
      projects: (apiProfile?.projects || []).map((p) => ({
        title: cleanStr(p.title || p.project_name || p.name),
        role: cleanStr(p.role),
        description: cleanStr(p.description || p.summary),
        tech_stack: Array.isArray(p.tech_stack)
          ? p.tech_stack.map(cleanStr).filter(Boolean)
          : (Array.isArray(p.technologies) ? p.technologies.map(cleanStr).filter(Boolean) : []),
        bullets: Array.isArray(p.bullets)
          ? p.bullets.map(cleanStr).filter(Boolean)
          : (Array.isArray(p.bullet_points) ? p.bullet_points.map(cleanStr).filter(Boolean) : []),
        github_url: cleanStr(p.github_url || (p.link && p.link.includes('github') ? p.link : '')),
        demo_url: cleanStr(p.demo_url || (p.link && !p.link.includes('github') ? p.link : '')),
        link: cleanStr(p.link || p.github_url || p.demo_url),
        metrics: cleanStr(p.metrics),
      })),
      certifications: (apiProfile?.certifications || []).map((c) => ({
        name: cleanStr(c.name || c.title),
        issuer: cleanStr(c.issuer || c.organization),
        date: cleanStr(c.date || c.issue_date || c.year),
        url: cleanStr(c.url || c.credential_url),
      })),
      achievements: (apiProfile?.achievements || []).map((a) => ({
        title: cleanStr(a.title || a.name),
        description: cleanStr(a.description || a.summary),
        date: cleanStr(a.date || a.year),
        issuer: cleanStr(a.issuer || a.organization),
      })),
      links: (apiProfile?.links || []).map((l) => ({
        label: cleanStr(l.label),
        url: cleanStr(l.url),
      })),
    };
  };

  // Convert form state back into clean API payload
  const formToApi = (formProfile) => {
    return {
      contact_info: {
        full_name: cleanStr(formProfile.contact_info?.full_name),
        email: cleanStr(formProfile.contact_info?.email),
        phone: cleanStr(formProfile.contact_info?.phone),
        location: cleanStr(formProfile.contact_info?.location),
        linkedin: cleanStr(formProfile.contact_info?.linkedin) || null,
        github: cleanStr(formProfile.contact_info?.github) || null,
        portfolio: cleanStr(formProfile.contact_info?.portfolio) || null,
      },
      summary: cleanStr(formProfile.summary),
      skills: {
        languages: (formProfile.skills?.languages || []).map(cleanStr).filter(Boolean),
        frameworks: (formProfile.skills?.frameworks || []).map(cleanStr).filter(Boolean),
        databases: (formProfile.skills?.databases || []).map(cleanStr).filter(Boolean),
        tools: (formProfile.skills?.tools || []).map(cleanStr).filter(Boolean),
        cloud_devops: (formProfile.skills?.cloud_devops || []).map(cleanStr).filter(Boolean),
        soft_skills: (formProfile.skills?.soft_skills || []).map(cleanStr).filter(Boolean),
      },
      education: (formProfile.education || []).map((e) => ({
        institution: cleanStr(e.institution),
        degree: cleanStr(e.degree),
        field_of_study: cleanStr(e.field_of_study) || null,
        start_year: cleanStr(e.start_year) || null,
        end_year: cleanStr(e.end_year) || null,
        gpa: cleanStr(e.grade_value || e.gpa) || null,
        grade_type: cleanStr(e.grade_type) || 'CGPA',
        grade_value: cleanStr(e.grade_value || e.gpa) || null,
        secondary_percentage: cleanStr(e.secondary_percentage) || null,
      })),
      experience: (formProfile.experience || []).map((exp) => ({
        company: cleanStr(exp.company),
        role: cleanStr(exp.role),
        start_date: cleanStr(exp.start_date),
        end_date: cleanStr(exp.end_date),
        is_current: Boolean(exp.is_current),
        location: cleanStr(exp.location) || null,
        bullets: (exp.bullets || []).map(cleanStr).filter(Boolean),
      })),
      projects: (formProfile.projects || []).map((p) => ({
        title: cleanStr(p.title),
        role: cleanStr(p.role) || null,
        description: cleanStr(p.description) || null,
        tech_stack: (p.tech_stack || []).map(cleanStr).filter(Boolean),
        bullets: (p.bullets || []).map(cleanStr).filter(Boolean),
        link: cleanStr(p.demo_url || p.github_url || p.link) || null,
        github_url: cleanStr(p.github_url) || null,
        demo_url: cleanStr(p.demo_url) || null,
        metrics: cleanStr(p.metrics) || null,
      })),
      certifications: (formProfile.certifications || []).map((c) => ({
        name: cleanStr(c.name),
        issuer: cleanStr(c.issuer),
        date: cleanStr(c.date) || null,
        url: cleanStr(c.url) || null,
      })),
      achievements: (formProfile.achievements || []).map((a) => ({
        title: cleanStr(a.title),
        description: cleanStr(a.description) || null,
        date: cleanStr(a.date) || null,
        issuer: cleanStr(a.issuer) || null,
      })),
      links: (formProfile.links || []).map((l) => ({
        label: cleanStr(l.label),
        url: cleanStr(l.url),
      })),
    };
  };

  const handleUploadComplete = async ({ resumeId, isCached, filename }) => {
    setActiveResumeId(resumeId);
    setSuccessMsg(isCached ? 'Resume retrieved from cache instantly!' : 'Resume parsed and verified successfully!');
    try {
      // 1. Fetch structured parsed result with field metadata
      const res = await api.get(`/resumes/${resumeId}/parsed`);
      if (res.data) {
        const parsedData = res.data;
        setParseMetadata({
          summary_counts: parsedData.summary_counts || {},
          field_meta: parsedData.field_meta || [],
          ocr_used: parsedData.ocr_used || false,
          raw_text_length: parsedData.raw_text_length || 0,
          filename: parsedData.filename || filename,
          status: parsedData.status,
        });

        const mapped = mapApiProfileToForm(parsedData.profile, user);
        setProfile(mapped);
      }
    } catch (e) {
      console.warn('Could not fetch /resumes/{id}/parsed, falling back to /profile/master', e);
      await loadExistingData();
    }
    setTimeout(() => {
      setSuccessMsg('');
      setStep(2);
    }, 1200);
  };

  const getFieldBadge = (fieldPath) => {
    const rawKey = fieldPath.replace('contact_info.', '');
    if (accountFallbackFields[rawKey]) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
          from your account
        </span>
      );
    }
    if (!parseMetadata?.field_meta) return null;
    const meta = parseMetadata.field_meta.find((m) => m.field_path === fieldPath);
    if (!meta) return null;

    if (meta.status === 'verified') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          Verified
        </span>
      );
    }
    if (meta.status === 'unverified') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
          <AlertCircle className="w-3 h-3 text-amber-400" />
          Check this
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-white/5">
        Missing
      </span>
    );
  };

  // Step 2: Master Profile State
  const [profile, setProfile] = useState({
    contact_info: {
      full_name: '',
      email: '',
      phone: '',
      location: '',
      linkedin: '',
      github: '',
      portfolio: '',
    },
    summary: '',
    education: [],
    experience: [],
    projects: [],
    skills: {
      languages: [],
      frameworks: [],
      databases: [],
      tools: [],
      cloud_devops: [],
      soft_skills: [],
    },
    certifications: [],
    achievements: [],
    links: [],
  });

  const [projectTechInput, setProjectTechInput] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null); // { type, index }

  // Step 3: Job Preferences State
  const [preferences, setPreferences] = useState({
    target_roles: ['Full-Stack Developer', 'Frontend Developer', 'Backend Developer'],
    experience_level: 'Junior',
    locations: ['Remote', 'San Francisco', 'Bengaluru', 'New York'],
    workplace_type: 'Any',
    job_type: 'Full-time',
    min_salary: 80000,
    company_blacklist: [],
    include_keywords: ['React', 'Python', 'FastAPI', 'Node.js'],
    exclude_keywords: ['Staff', 'Principal', '10+ years'],
    apply_mode: 'review_then_apply',
    daily_cap: 20,
    match_threshold: 70,
  });
  const [customRole, setCustomRole] = useState('');
  const [customBlacklist, setCustomBlacklist] = useState('');

  // Step 4: Question Bank State
  const [questions, setQuestions] = useState({
    work_authorization: 'Authorized to work without sponsorship',
    needs_sponsorship: false,
    notice_period: 'Immediate (0-15 days)',
    expected_ctc: '$90,000 / year (or INR 15-20 LPA)',
    current_ctc: '$75,000 / year',
    willing_to_relocate: true,
    earliest_start_date: 'Immediately',
    portfolio_url: '',
    linkedin_url: '',
    github_url: '',
  });

  // New Skill Temp State
  const [newSkill, setNewSkill] = useState({ category: 'languages', value: '' });

  // On mount: if user logged in, attempt to fetch existing master profile
  useEffect(() => {
    if (user) {
      loadExistingData();
    }
  }, [user]);

  const loadExistingData = async () => {
    try {
      const res = await api.get('/profile/master');
      if (res.data) {
        setProfile(mapApiProfileToForm(res.data, user));
      }
    } catch (e) {
      // Profile may not exist yet, which is expected for fresh user
    }

    try {
      const prefRes = await api.get('/preferences/');
      if (prefRes.data) {
        setPreferences(prefRes.data);
      }
    } catch (e) {}

    try {
      const qbRes = await api.get('/profile/question-bank');
      if (qbRes.data) {
        setQuestions((prev) => ({ ...prev, ...qbRes.data }));
      }
    } catch (e) {}
  };

  // Step 1: Upload Resume
  const handleFileUpload = async (file) => {
    if (!file) return;
    setError('');
    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/profile/upload-resume', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const parsed = res.data.parsed_profile;
      setProfile(mapApiProfileToForm(parsed, user));
      setSuccessMsg('Resume parsed and structured into Master Profile successfully!');
      setTimeout(() => {
        setSuccessMsg('');
        setStep(2);
      }, 1200);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to parse resume. You can also load sample data.');
    } finally {
      setUploadLoading(false);
    }
  };

  // Sample Resume Loader
  const handleLoadSample = async () => {
    const sampleBlob = new Blob([SAMPLE_RESUME_TEXT], { type: 'text/plain' });
    const sampleFile = new File([sampleBlob], 'alex_mercer_sample_resume.txt', { type: 'text/plain' });
    setSelectedFile(sampleFile);
    await handleFileUpload(sampleFile);
  };

  // Step 2: Save Profile
  const handleSaveProfile = async () => {
    setError('');
    const name = cleanStr(profile.contact_info?.full_name);
    const email = cleanStr(profile.contact_info?.email);

    if (!name) {
      setError('Full Name is required.');
      return;
    }
    if (!email) {
      setError('Email Address is required.');
      return;
    }

    const hasEducation = (profile.education || []).length > 0;
    const hasProjects = (profile.projects || []).length > 0;
    const hasExperience = (profile.experience || []).length > 0;

    if (!hasEducation && !hasProjects && !hasExperience) {
      setError('Please add at least one entry under Education, Projects, or Work Experience.');
      return;
    }

    setSaveLoading(true);
    try {
      const payload = formToApi(profile);
      await api.put('/profile/master', payload);
      setSuccessMsg('Master Profile saved as single source of truth!');
      setTimeout(() => {
        setSuccessMsg('');
        setStep(3);
      }, 800);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save master profile.');
    } finally {
      setSaveLoading(false);
    }
  };

  // Helper functions for reordering
  const moveItem = (listKey, index, direction) => {
    setProfile((prev) => {
      const list = [...(prev[listKey] || [])];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= list.length) return prev;
      const temp = list[index];
      list[index] = list[targetIndex];
      list[targetIndex] = temp;
      return { ...prev, [listKey]: list };
    });
  };

  // Education manipulation
  const addEducation = () => {
    setProfile((prev) => ({
      ...prev,
      education: [
        ...prev.education,
        {
          institution: '',
          degree: '',
          field_of_study: '',
          start_year: '',
          end_year: '',
          grade_type: 'CGPA',
          grade_value: '',
          secondary_percentage: '',
        },
      ],
    }));
  };

  const removeEducation = (idx) => {
    setProfile((prev) => ({
      ...prev,
      education: prev.education.filter((_, i) => i !== idx),
    }));
    setConfirmDelete(null);
  };

  // Work Experience manipulation
  const addExperience = () => {
    setProfile((prev) => ({
      ...prev,
      experience: [
        ...prev.experience,
        {
          company: '',
          role: '',
          start_date: '',
          end_date: '',
          is_current: false,
          location: '',
          bullets: [''],
        },
      ],
    }));
  };

  const removeExperience = (idx) => {
    setProfile((prev) => ({
      ...prev,
      experience: prev.experience.filter((_, i) => i !== idx),
    }));
    setConfirmDelete(null);
  };

  // Projects manipulation
  const addProject = () => {
    setProfile((prev) => ({
      ...prev,
      projects: [
        ...prev.projects,
        {
          title: '',
          role: '',
          description: '',
          tech_stack: [],
          bullets: [''],
          github_url: '',
          demo_url: '',
        },
      ],
    }));
  };

  const removeProject = (idx) => {
    setProfile((prev) => ({
      ...prev,
      projects: prev.projects.filter((_, i) => i !== idx),
    }));
    setConfirmDelete(null);
  };

  const addProjectTech = (projectIdx, tech) => {
    const val = cleanStr(tech);
    if (!val) return;
    setProfile((prev) => {
      const updated = [...prev.projects];
      const stack = updated[projectIdx].tech_stack || [];
      if (!stack.includes(val)) {
        updated[projectIdx] = {
          ...updated[projectIdx],
          tech_stack: [...stack, val],
        };
      }
      return { ...prev, projects: updated };
    });
    setProjectTechInput((prev) => ({ ...prev, [projectIdx]: '' }));
  };

  const removeProjectTech = (projectIdx, tech) => {
    setProfile((prev) => {
      const updated = [...prev.projects];
      updated[projectIdx] = {
        ...updated[projectIdx],
        tech_stack: (updated[projectIdx].tech_stack || []).filter((t) => t !== tech),
      };
      return { ...prev, projects: updated };
    });
  };

  const addProjectBullet = (projectIdx) => {
    setProfile((prev) => {
      const updated = [...prev.projects];
      updated[projectIdx] = {
        ...updated[projectIdx],
        bullets: [...(updated[projectIdx].bullets || []), ''],
      };
      return { ...prev, projects: updated };
    });
  };

  const updateProjectBullet = (projectIdx, bulletIdx, val) => {
    setProfile((prev) => {
      const updated = [...prev.projects];
      const bullets = [...(updated[projectIdx].bullets || [])];
      bullets[bulletIdx] = val;
      updated[projectIdx] = { ...updated[projectIdx], bullets };
      return { ...prev, projects: updated };
    });
  };

  const removeProjectBullet = (projectIdx, bulletIdx) => {
    setProfile((prev) => {
      const updated = [...prev.projects];
      const bullets = (updated[projectIdx].bullets || []).filter((_, i) => i !== bulletIdx);
      updated[projectIdx] = { ...updated[projectIdx], bullets };
      return { ...prev, projects: updated };
    });
  };

  // Helper functions for Skill manipulation
  const addSkill = (category) => {
    if (!newSkill.value.trim()) return;
    const val = cleanStr(newSkill.value);
    if (!val) return;
    setProfile((prev) => {
      const existing = prev.skills[category] || [];
      if (!existing.includes(val)) {
        return {
          ...prev,
          skills: {
            ...prev.skills,
            [category]: [...existing, val],
          },
        };
      }
      return prev;
    });
    setNewSkill({ category, value: '' });
  };

  const removeSkill = (category, skillToRemove) => {
    setProfile((prev) => ({
      ...prev,
      skills: {
        ...prev.skills,
        [category]: (prev.skills[category] || []).filter((s) => s !== skillToRemove),
      },
    }));
  };

  // Certifications manipulation
  const addCertification = () => {
    setProfile((prev) => ({
      ...prev,
      certifications: [
        ...prev.certifications,
        {
          name: '',
          issuer: '',
          date: '',
          url: '',
        },
      ],
    }));
  };

  const removeCertification = (idx) => {
    setProfile((prev) => ({
      ...prev,
      certifications: prev.certifications.filter((_, i) => i !== idx),
    }));
    setConfirmDelete(null);
  };

  // Achievements manipulation
  const addAchievement = () => {
    setProfile((prev) => ({
      ...prev,
      achievements: [
        ...(prev.achievements || []),
        {
          title: '',
          description: '',
          date: '',
          issuer: '',
        },
      ],
    }));
  };

  const removeAchievement = (idx) => {
    setProfile((prev) => ({
      ...prev,
      achievements: (prev.achievements || []).filter((_, i) => i !== idx),
    }));
    setConfirmDelete(null);
  };

  // Add custom target role
  const addTargetRole = () => {
    if (!customRole.trim()) return;
    if (!preferences.target_roles.includes(customRole.trim())) {
      setPreferences((prev) => ({
        ...prev,
        target_roles: [...prev.target_roles, customRole.trim()],
      }));
    }
    setCustomRole('');
  };

  const removeTargetRole = (role) => {
    setPreferences((prev) => ({
      ...prev,
      target_roles: prev.target_roles.filter((r) => r !== role),
    }));
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Stepper Progress Bar */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                Step {step} of 4
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1">
                {step === 1 && 'Upload & Parse Your Resume'}
                {step === 2 && 'Review & Edit Master Profile (Source of Truth)'}
                {step === 3 && 'Target Roles & Automation Preferences'}
                {step === 4 && 'Common Questions Bank'}
              </h1>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium">
                Phase 1 Onboarding
              </span>
            </div>
          </div>

          {/* Stepper indicator dots */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { num: 1, label: 'Upload Resume' },
              { num: 2, label: 'Master Profile' },
              { num: 3, label: 'Job Preferences' },
              { num: 4, label: 'Question Bank' },
            ].map((s) => (
              <button
                key={s.num}
                onClick={() => setStep(s.num)}
                className={`text-left p-3 rounded-xl border transition-all ${
                  step === s.num
                    ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-lg shadow-indigo-500/10'
                    : step > s.num
                    ? 'bg-slate-900/60 border-emerald-500/30 text-emerald-400'
                    : 'bg-slate-900/30 border-white/5 text-slate-500'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      step === s.num
                        ? 'bg-indigo-500 text-white'
                        : step > s.num
                        ? 'bg-emerald-500 text-black'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {step > s.num ? '✓' : s.num}
                  </span>
                  <span className="text-xs font-medium truncate">{s.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Global Alert Messages */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* STEP 1: RESUME UPLOAD & PARSING                      */}
        {/* ---------------------------------------------------- */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center max-w-lg mx-auto">
              <h2 className="text-2xl font-bold text-white tracking-tight">Upload your latest Resume</h2>
              <p className="text-sm text-slate-400 mt-1">
                We parse your PDF or DOCX into a structured JSON Master Profile with strict zero-hallucination verification.
              </p>
            </div>

            <ResumeUploader
              onUploadSuccess={handleUploadComplete}
              onSkipToManual={() => setStep(2)}
              sampleResumeText={SAMPLE_RESUME_TEXT}
            />
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* STEP 2: MASTER PROFILE EDITOR                        */}
        {/* ---------------------------------------------------- */}
        {step === 2 && (
          <div className="space-y-6">
            {/* Extraction Summary Banner */}
            {parseMetadata?.summary_counts && (
              <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-indigo-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-indigo-300" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-white">
                      Found: {parseMetadata.summary_counts.skills || 0} skills, {parseMetadata.summary_counts.projects || 0} projects, {parseMetadata.summary_counts.education || 0} education entries.
                    </p>
                    <p className="text-xs text-indigo-300/80 mt-0.5">
                      {parseMetadata.summary_counts.needs_attention > 0 ? (
                        <span className="text-amber-300 font-medium">
                          {parseMetadata.summary_counts.needs_attention} items need your review or confirmation.
                        </span>
                      ) : (
                        <span className="text-emerald-300 font-medium">
                          Zero hallucinations detected. All details verified against your resume.
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Collapsible Details Toggle */}
                <button
                  type="button"
                  onClick={() => setDetailsOpen(!detailsOpen)}
                  className="text-xs px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 flex items-center gap-1.5 transition-all shrink-0"
                >
                  <Info className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{detailsOpen ? 'Hide Extraction Details' : 'Extraction Details'}</span>
                </button>
              </div>
            )}

            {/* Collapsible Extraction Details Panel */}
            {detailsOpen && parseMetadata && (
              <div className="p-4 rounded-xl bg-slate-900/90 border border-white/10 text-xs text-slate-300 space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                    <span className="text-slate-400 text-[11px] block">Source Document</span>
                    <span className="text-white font-medium truncate block mt-0.5">{parseMetadata.filename || 'Uploaded Resume'}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                    <span className="text-slate-400 text-[11px] block">Raw Text Length</span>
                    <span className="text-white font-medium block mt-0.5">{parseMetadata.raw_text_length} characters</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                    <span className="text-slate-400 text-[11px] block">OCR Fallback Used</span>
                    <span className="text-white font-medium block mt-0.5">{parseMetadata.ocr_used ? 'Yes (Gemini Vision)' : 'No (Native Text)'}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                    <span className="text-slate-400 text-[11px] block">Verified Fields</span>
                    <span className="text-emerald-400 font-medium block mt-0.5">{parseMetadata.summary_counts.verified || 0} fields</span>
                  </div>
                </div>
              </div>
            )}

            {/* View Mode Toggle Header */}
            <div className="glass-panel p-4 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <span className="font-semibold text-white">Single Source of Truth</span>
                <span className="text-xs text-slate-500">
                  (The AI will NEVER fabricate anything not verified in this profile)
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setViewJson(!viewJson)}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-300 flex items-center gap-1.5 transition-all"
                >
                  {viewJson ? <Eye className="w-3.5 h-3.5" /> : <Code className="w-3.5 h-3.5" />}
                  <span>{viewJson ? 'Visual Editor' : 'Inspect JSON'}</span>
                </button>
              </div>
            </div>

            {viewJson ? (
              <div className="glass-panel p-6 rounded-2xl">
                <pre className="text-xs text-indigo-300 bg-slate-950 p-4 rounded-xl overflow-x-auto max-h-[500px]">
                  {JSON.stringify(profile, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 1. Contact & Identification */}
                <div className="glass-panel p-6 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <User className="w-4 h-4 text-indigo-400" />
                      <span>Contact & Identification</span>
                    </h3>
                    <span className="text-xs text-slate-400">Primary Identity</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-sm font-medium text-slate-300">Full Name *</label>
                        {getFieldBadge('contact_info.full_name')}
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. Alex Mercer"
                        value={profile.contact_info.full_name || ''}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            contact_info: { ...profile.contact_info, full_name: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-sm font-medium text-slate-300">Email Address *</label>
                        {getFieldBadge('contact_info.email')}
                      </div>
                      <input
                        type="email"
                        placeholder="e.g. alex@example.com"
                        value={profile.contact_info.email || ''}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            contact_info: { ...profile.contact_info, email: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-sm font-medium text-slate-300">Phone</label>
                        {profile.contact_info.phone ? (
                          getFieldBadge('contact_info.phone')
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            <AlertCircle className="w-3 h-3 text-amber-400" />
                            Missing
                          </span>
                        )}
                      </div>
                      <input
                        type="tel"
                        placeholder="e.g. +91 98765 43210"
                        value={profile.contact_info.phone || ''}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            contact_info: { ...profile.contact_info, phone: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-sm font-medium text-slate-300">Location</label>
                        {getFieldBadge('contact_info.location')}
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. San Francisco, CA or Bengaluru, India"
                        value={profile.contact_info.location || ''}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            contact_info: { ...profile.contact_info, location: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-sm font-medium text-slate-300">LinkedIn URL</label>
                        {getFieldBadge('contact_info.linkedin')}
                      </div>
                      <input
                        type="url"
                        placeholder="https://linkedin.com/in/..."
                        value={profile.contact_info.linkedin || ''}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            contact_info: { ...profile.contact_info, linkedin: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-sm font-medium text-slate-300">GitHub URL</label>
                        {getFieldBadge('contact_info.github')}
                      </div>
                      <input
                        type="url"
                        placeholder="https://github.com/..."
                        value={profile.contact_info.github || ''}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            contact_info: { ...profile.contact_info, github: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Professional Summary */}
                <div className="glass-panel p-6 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-cyan-400" />
                      <span>Professional Summary</span>
                    </h3>
                    {getFieldBadge('summary')}
                  </div>
                  <textarea
                    rows={3}
                    value={profile.summary || ''}
                    onChange={(e) => setProfile({ ...profile, summary: e.target.value })}
                    placeholder="Brief background summary of your career, engineering background, and technical focus..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none leading-relaxed"
                  />
                </div>

                {/* 3. Education */}
                <div className="glass-panel p-6 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-emerald-400" />
                      <h3 className="text-base font-bold text-white">Education</h3>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold">
                        {profile.education.length}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={addEducation}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-sm font-medium flex items-center gap-1.5 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Education</span>
                    </button>
                  </div>

                  {profile.education.length === 0 ? (
                    <div className="p-8 rounded-xl bg-slate-900/40 border border-dashed border-white/10 text-center space-y-3">
                      <GraduationCap className="w-8 h-8 text-slate-500 mx-auto" />
                      <p className="text-sm font-medium text-slate-300">No education credentials added yet</p>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        Add your university degree, bootcamp, or secondary school details to complete your academic profile.
                      </p>
                      <button
                        type="button"
                        onClick={addEducation}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 text-xs font-semibold"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Education</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {profile.education.map((edu, idx) => (
                        <div key={idx} className="glass-card p-4 rounded-xl space-y-3 relative border border-white/10">
                          <div className="flex items-center justify-between border-b border-white/5 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-emerald-400">Education #{idx + 1}</span>
                              <span className="text-xs text-slate-400 font-medium">
                                {edu.institution ? edu.institution : 'New Degree / School'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              {idx > 0 && (
                                <button
                                  type="button"
                                  onClick={() => moveItem('education', idx, -1)}
                                  className="p-1 text-slate-400 hover:text-white rounded"
                                  title="Move up"
                                >
                                  <ChevronUp className="w-4 h-4" />
                                </button>
                              )}
                              {idx < profile.education.length - 1 && (
                                <button
                                  type="button"
                                  onClick={() => moveItem('education', idx, 1)}
                                  className="p-1 text-slate-400 hover:text-white rounded"
                                  title="Move down"
                                >
                                  <ChevronDown className="w-4 h-4" />
                                </button>
                              )}
                              {confirmDelete?.type === 'education' && confirmDelete?.index === idx ? (
                                <div className="flex items-center gap-1.5 bg-rose-500/20 border border-rose-500/40 px-2 py-0.5 rounded-lg text-xs ml-2">
                                  <span className="text-[11px] text-rose-300">Delete?</span>
                                  <button
                                    type="button"
                                    onClick={() => removeEducation(idx)}
                                    className="font-bold text-rose-400 hover:text-white"
                                  >
                                    Yes
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDelete(null)}
                                    className="text-slate-400 hover:text-white ml-1"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDelete({ type: 'education', index: idx })}
                                  className="p-1 text-slate-500 hover:text-rose-400 ml-1 rounded"
                                  title="Remove education"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="text-sm font-medium text-slate-300">Institution / University</label>
                              <input
                                type="text"
                                placeholder="e.g. UC Berkeley, IIT Bombay"
                                value={edu.institution || ''}
                                onChange={(e) => {
                                  const updated = [...profile.education];
                                  updated[idx].institution = e.target.value;
                                  setProfile({ ...profile, education: updated });
                                }}
                                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-slate-300">Degree / Qualification</label>
                              <input
                                type="text"
                                placeholder="e.g. B.S., B.Tech, M.S."
                                value={edu.degree || ''}
                                onChange={(e) => {
                                  const updated = [...profile.education];
                                  updated[idx].degree = e.target.value;
                                  setProfile({ ...profile, education: updated });
                                }}
                                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-slate-300">Field of Study / Major</label>
                              <input
                                type="text"
                                placeholder="e.g. Computer Science, Electrical Eng."
                                value={edu.field_of_study || ''}
                                onChange={(e) => {
                                  const updated = [...profile.education];
                                  updated[idx].field_of_study = e.target.value;
                                  setProfile({ ...profile, education: updated });
                                }}
                                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                              <label className="text-sm font-medium text-slate-300">Start Year</label>
                              <input
                                type="text"
                                placeholder="e.g. 2020"
                                value={edu.start_year || ''}
                                onChange={(e) => {
                                  const updated = [...profile.education];
                                  updated[idx].start_year = e.target.value;
                                  setProfile({ ...profile, education: updated });
                                }}
                                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-slate-300">End Year / Expected</label>
                              <input
                                type="text"
                                placeholder="e.g. 2024 or Present"
                                value={edu.end_year || ''}
                                onChange={(e) => {
                                  const updated = [...profile.education];
                                  updated[idx].end_year = e.target.value;
                                  setProfile({ ...profile, education: updated });
                                }}
                                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-slate-300">Grade Type</label>
                              <select
                                value={edu.grade_type || 'CGPA'}
                                onChange={(e) => {
                                  const updated = [...profile.education];
                                  updated[idx].grade_type = e.target.value;
                                  setProfile({ ...profile, education: updated });
                                }}
                                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                              >
                                <option value="CGPA">CGPA (out of 10 or 4)</option>
                                <option value="Percentage">Percentage (%)</option>
                                <option value="GPA">GPA (out of 4.0)</option>
                                <option value="Grade">Letter Grade</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-slate-300">Grade / Score</label>
                              <input
                                type="text"
                                placeholder="e.g. 8.7 or 3.8 / 4.0"
                                value={edu.grade_value || ''}
                                onChange={(e) => {
                                  const updated = [...profile.education];
                                  updated[idx].grade_value = e.target.value;
                                  setProfile({ ...profile, education: updated });
                                }}
                                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-sm font-medium text-slate-300">
                              Secondary / Higher Secondary % (Optional)
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. 94% (12th Grade / High School)"
                              value={edu.secondary_percentage || ''}
                              onChange={(e) => {
                                const updated = [...profile.education];
                                updated[idx].secondary_percentage = e.target.value;
                                setProfile({ ...profile, education: updated });
                              }}
                              className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 4. Work Experience */}
                <div className="glass-panel p-6 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-5 h-5 text-cyan-400" />
                      <h3 className="text-base font-bold text-white">Work Experience</h3>
                      <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold">
                        {profile.experience.length}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={addExperience}
                      className="px-3.5 py-1.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-cyan-300 text-sm font-medium flex items-center gap-1.5 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Experience</span>
                    </button>
                  </div>

                  {profile.experience.length === 0 ? (
                    <div className="p-8 rounded-xl bg-slate-900/40 border border-dashed border-white/10 text-center space-y-3">
                      <Briefcase className="w-8 h-8 text-slate-500 mx-auto" />
                      <p className="text-sm font-medium text-slate-300">No work experience found</p>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        That's fine! Freshers and students can leave this blank, or add internships, open-source work, and freelance gigs if you have any.
                      </p>
                      <button
                        type="button"
                        onClick={addExperience}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 text-xs font-semibold"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Experience</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {profile.experience.map((exp, idx) => (
                        <div key={idx} className="glass-card p-4 rounded-xl space-y-3 relative border border-white/10">
                          <div className="flex items-center justify-between border-b border-white/5 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-cyan-400">Position #{idx + 1}</span>
                              <span className="text-xs text-slate-400 font-medium">
                                {exp.role && exp.company ? `${exp.role} at ${exp.company}` : exp.company || 'New Role'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              {idx > 0 && (
                                <button
                                  type="button"
                                  onClick={() => moveItem('experience', idx, -1)}
                                  className="p-1 text-slate-400 hover:text-white rounded"
                                  title="Move up"
                                >
                                  <ChevronUp className="w-4 h-4" />
                                </button>
                              )}
                              {idx < profile.experience.length - 1 && (
                                <button
                                  type="button"
                                  onClick={() => moveItem('experience', idx, 1)}
                                  className="p-1 text-slate-400 hover:text-white rounded"
                                  title="Move down"
                                >
                                  <ChevronDown className="w-4 h-4" />
                                </button>
                              )}
                              {confirmDelete?.type === 'experience' && confirmDelete?.index === idx ? (
                                <div className="flex items-center gap-1.5 bg-rose-500/20 border border-rose-500/40 px-2 py-0.5 rounded-lg text-xs ml-2">
                                  <span className="text-[11px] text-rose-300">Delete?</span>
                                  <button
                                    type="button"
                                    onClick={() => removeExperience(idx)}
                                    className="font-bold text-rose-400 hover:text-white"
                                  >
                                    Yes
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDelete(null)}
                                    className="text-slate-400 hover:text-white ml-1"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDelete({ type: 'experience', index: idx })}
                                  className="p-1 text-slate-500 hover:text-rose-400 ml-1 rounded"
                                  title="Remove experience"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="text-sm font-medium text-slate-300">Company</label>
                              <input
                                type="text"
                                placeholder="e.g. Acme Corp"
                                value={exp.company || ''}
                                onChange={(e) => {
                                  const updated = [...profile.experience];
                                  updated[idx].company = e.target.value;
                                  setProfile({ ...profile, experience: updated });
                                }}
                                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-slate-300">Role / Job Title</label>
                              <input
                                type="text"
                                placeholder="e.g. Software Engineer Intern"
                                value={exp.role || ''}
                                onChange={(e) => {
                                  const updated = [...profile.experience];
                                  updated[idx].role = e.target.value;
                                  setProfile({ ...profile, experience: updated });
                                }}
                                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-slate-300">Location</label>
                              <input
                                type="text"
                                placeholder="e.g. Remote or San Francisco, CA"
                                value={exp.location || ''}
                                onChange={(e) => {
                                  const updated = [...profile.experience];
                                  updated[idx].location = e.target.value;
                                  setProfile({ ...profile, experience: updated });
                                }}
                                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                            <div>
                              <label className="text-sm font-medium text-slate-300">Start Date</label>
                              <input
                                type="text"
                                placeholder="e.g. June 2022"
                                value={exp.start_date || ''}
                                onChange={(e) => {
                                  const updated = [...profile.experience];
                                  updated[idx].start_date = e.target.value;
                                  setProfile({ ...profile, experience: updated });
                                }}
                                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-slate-300">End Date</label>
                              <input
                                type="text"
                                placeholder="e.g. Present or Dec 2023"
                                disabled={exp.is_current}
                                value={exp.is_current ? 'Present' : exp.end_date || ''}
                                onChange={(e) => {
                                  const updated = [...profile.experience];
                                  updated[idx].end_date = e.target.value;
                                  setProfile({ ...profile, experience: updated });
                                }}
                                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none disabled:opacity-60"
                              />
                            </div>
                            <div className="pt-5 flex items-center">
                              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
                                <input
                                  type="checkbox"
                                  checked={Boolean(exp.is_current)}
                                  onChange={(e) => {
                                    const updated = [...profile.experience];
                                    updated[idx].is_current = e.target.checked;
                                    if (e.target.checked) updated[idx].end_date = 'Present';
                                    setProfile({ ...profile, experience: updated });
                                  }}
                                  className="rounded bg-slate-900 border-white/10 text-cyan-500"
                                />
                                <span>I currently work here</span>
                              </label>
                            </div>
                          </div>

                          {/* Bullets */}
                          <div>
                            <label className="text-sm font-medium text-slate-300">
                              Key Achievements & Bullets (Action + Tech + Metric Impact)
                            </label>
                            <textarea
                              rows={3}
                              value={(exp.bullets || []).join('\n')}
                              onChange={(e) => {
                                const updated = [...profile.experience];
                                updated[idx].bullets = e.target.value.split('\n');
                                setProfile({ ...profile, experience: updated });
                              }}
                              className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm font-mono leading-relaxed"
                              placeholder="One bullet point per line..."
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 5. Projects */}
                <div className="glass-panel p-6 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FolderGit2 className="w-5 h-5 text-purple-400" />
                      <h3 className="text-base font-bold text-white">Projects</h3>
                      <span className="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold">
                        {profile.projects.length}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={addProject}
                      className="px-3.5 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-sm font-medium flex items-center gap-1.5 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Project</span>
                    </button>
                  </div>

                  {profile.projects.length === 0 ? (
                    <div className="p-8 rounded-xl bg-slate-900/40 border border-dashed border-white/10 text-center space-y-3">
                      <FolderGit2 className="w-8 h-8 text-slate-500 mx-auto" />
                      <p className="text-sm font-medium text-slate-300">No projects added yet</p>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        Showcase your side projects, full-stack web applications, hackathon entries, or open-source libraries.
                      </p>
                      <button
                        type="button"
                        onClick={addProject}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 text-xs font-semibold"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Project</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {profile.projects.map((proj, idx) => (
                        <div key={idx} className="glass-card p-4 rounded-xl space-y-3 relative border border-white/10">
                          <div className="flex items-center justify-between border-b border-white/5 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-purple-400">Project #{idx + 1}</span>
                              <span className="text-xs text-slate-300 font-medium truncate max-w-xs">
                                {proj.title || 'Untitled Project'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              {idx > 0 && (
                                <button
                                  type="button"
                                  onClick={() => moveItem('projects', idx, -1)}
                                  className="p-1 text-slate-400 hover:text-white rounded"
                                  title="Move up"
                                >
                                  <ChevronUp className="w-4 h-4" />
                                </button>
                              )}
                              {idx < profile.projects.length - 1 && (
                                <button
                                  type="button"
                                  onClick={() => moveItem('projects', idx, 1)}
                                  className="p-1 text-slate-400 hover:text-white rounded"
                                  title="Move down"
                                >
                                  <ChevronDown className="w-4 h-4" />
                                </button>
                              )}
                              {confirmDelete?.type === 'project' && confirmDelete?.index === idx ? (
                                <div className="flex items-center gap-1.5 bg-rose-500/20 border border-rose-500/40 px-2 py-0.5 rounded-lg text-xs ml-2">
                                  <span className="text-[11px] text-rose-300">Delete?</span>
                                  <button
                                    type="button"
                                    onClick={() => removeProject(idx)}
                                    className="font-bold text-rose-400 hover:text-white"
                                  >
                                    Yes
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDelete(null)}
                                    className="text-slate-400 hover:text-white ml-1"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDelete({ type: 'project', index: idx })}
                                  className="p-1 text-slate-500 hover:text-rose-400 ml-1 rounded"
                                  title="Remove project"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="text-sm font-medium text-slate-300">Project Title *</label>
                              <input
                                type="text"
                                placeholder="e.g. Distributed Task Queue"
                                value={proj.title || ''}
                                onChange={(e) => {
                                  const updated = [...profile.projects];
                                  updated[idx].title = e.target.value;
                                  setProfile({ ...profile, projects: updated });
                                }}
                                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-slate-300">Role / Contribution</label>
                              <input
                                type="text"
                                placeholder="e.g. Creator / Full-Stack Engineer"
                                value={proj.role || ''}
                                onChange={(e) => {
                                  const updated = [...profile.projects];
                                  updated[idx].role = e.target.value;
                                  setProfile({ ...profile, projects: updated });
                                }}
                                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-sm font-medium text-slate-300">Short Description</label>
                            <input
                              type="text"
                              placeholder="Brief 1-2 sentence overview of the project architecture and what problem it solves..."
                              value={proj.description || ''}
                              onChange={(e) => {
                                const updated = [...profile.projects];
                                updated[idx].description = e.target.value;
                                setProfile({ ...profile, projects: updated });
                              }}
                              className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="text-sm font-medium text-slate-300 flex items-center gap-1.5">
                                <Github className="w-3.5 h-3.5 text-slate-400" />
                                <span>GitHub Repository URL</span>
                              </label>
                              <input
                                type="url"
                                placeholder="https://github.com/..."
                                value={proj.github_url || ''}
                                onChange={(e) => {
                                  const updated = [...profile.projects];
                                  updated[idx].github_url = e.target.value;
                                  setProfile({ ...profile, projects: updated });
                                }}
                                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-slate-300 flex items-center gap-1.5">
                                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                                <span>Live Demo URL</span>
                              </label>
                              <input
                                type="url"
                                placeholder="https://myproject.com"
                                value={proj.demo_url || ''}
                                onChange={(e) => {
                                  const updated = [...profile.projects];
                                  updated[idx].demo_url = e.target.value;
                                  setProfile({ ...profile, projects: updated });
                                }}
                                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                              />
                            </div>
                          </div>

                          {/* Tech Stack Chip Input */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-sm font-medium text-slate-300">Technologies Used</label>
                              <span className="text-[11px] text-slate-500">{(proj.tech_stack || []).length} technologies</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 mb-2 min-h-[32px]">
                              {(proj.tech_stack || []).map((tech) => (
                                <span
                                  key={tech}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-200 text-xs font-medium"
                                >
                                  <span>{tech}</span>
                                  <button
                                    type="button"
                                    onClick={() => removeProjectTech(idx, tech)}
                                    className="text-purple-400 hover:text-rose-400 ml-0.5"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Add technology (e.g. React, Docker, Redis) & press Enter..."
                                value={projectTechInput[idx] || ''}
                                onChange={(e) =>
                                  setProjectTechInput((prev) => ({ ...prev, [idx]: e.target.value }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    addProjectTech(idx, projectTechInput[idx]);
                                  }
                                }}
                                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-white/10 text-white text-xs focus:border-purple-500 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => addProjectTech(idx, projectTechInput[idx])}
                                className="px-3 py-1.5 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 text-xs font-semibold"
                              >
                                + Add
                              </button>
                            </div>
                          </div>

                          {/* Bullets List */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-sm font-medium text-slate-300">
                                Key Highlights & Architecture Points
                              </label>
                              <button
                                type="button"
                                onClick={() => addProjectBullet(idx)}
                                className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Add Bullet</span>
                              </button>
                            </div>
                            <div className="space-y-1.5">
                              {(proj.bullets || []).map((bullet, bIdx) => (
                                <div key={bIdx} className="flex items-center gap-2">
                                  <span className="text-purple-400 text-xs font-mono">•</span>
                                  <input
                                    type="text"
                                    value={bullet}
                                    onChange={(e) => updateProjectBullet(idx, bIdx, e.target.value)}
                                    placeholder="Engineered high performance caching with 99.9% uptime..."
                                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-white/10 text-white text-xs focus:border-purple-500 focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeProjectBullet(idx, bIdx)}
                                    className="p-1 text-slate-500 hover:text-rose-400"
                                    title="Remove bullet"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                              {(proj.bullets || []).length === 0 && (
                                <button
                                  type="button"
                                  onClick={() => addProjectBullet(idx)}
                                  className="w-full py-2 border border-dashed border-white/10 rounded-lg text-xs text-slate-400 hover:text-purple-300 hover:border-purple-500/30 text-center"
                                >
                                  + Add first project highlight bullet
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 6. Categorized Technical Skills */}
                <div className="glass-panel p-6 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-400" />
                      <span>Categorized Technical Skills</span>
                    </h3>
                    <span className="text-xs text-slate-400">Verified Skills</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {['languages', 'frameworks', 'databases', 'tools', 'cloud_devops'].map((cat) => (
                      <div key={cat} className="glass-card p-4 rounded-xl space-y-3 border border-white/10">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                            {cat.replace('_', ' ')}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {(profile.skills[cat] || []).length} skills
                          </span>
                        </div>

                        {/* Pills */}
                        <div className="flex flex-wrap gap-1.5 min-h-[40px]">
                          {(profile.skills[cat] || []).map((skill) => (
                            <span
                              key={skill}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs"
                            >
                              <span>{skill}</span>
                              <button
                                type="button"
                                onClick={() => removeSkill(cat, skill)}
                                className="text-slate-400 hover:text-rose-400 ml-0.5"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>

                        {/* Add skill input */}
                        <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                          <input
                            type="text"
                            placeholder={`Add to ${cat.replace('_', ' ')}...`}
                            value={newSkill.category === cat ? newSkill.value : ''}
                            onChange={(e) => setNewSkill({ category: cat, value: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addSkill(cat);
                              }
                            }}
                            className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={() => addSkill(cat)}
                            className="p-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 7. Certifications */}
                <div className="glass-panel p-6 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-amber-400" />
                      <h3 className="text-base font-bold text-white">Certifications</h3>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold">
                        {(profile.certifications || []).length}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={addCertification}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-300 text-sm font-medium flex items-center gap-1.5 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Certification</span>
                    </button>
                  </div>

                  {(profile.certifications || []).length === 0 ? (
                    <div className="p-8 rounded-xl bg-slate-900/40 border border-dashed border-white/10 text-center space-y-3">
                      <Award className="w-8 h-8 text-slate-500 mx-auto" />
                      <p className="text-sm font-medium text-slate-300">No certifications added yet</p>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        Add cloud badges, industry certifications (AWS, GCP, CKA), or specialized accreditations.
                      </p>
                      <button
                        type="button"
                        onClick={addCertification}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 text-xs font-semibold"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Certification</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(profile.certifications || []).map((cert, idx) => (
                        <div key={idx} className="glass-card p-4 rounded-xl space-y-3 relative border border-white/10">
                          <div className="flex items-center justify-between border-b border-white/5 pb-2">
                            <span className="text-xs font-bold text-amber-400">Certification #{idx + 1}</span>
                            {confirmDelete?.type === 'cert' && confirmDelete?.index === idx ? (
                              <div className="flex items-center gap-1.5 bg-rose-500/20 border border-rose-500/40 px-2 py-0.5 rounded-lg text-xs">
                                <span className="text-[11px] text-rose-300">Delete?</span>
                                <button
                                  type="button"
                                  onClick={() => removeCertification(idx)}
                                  className="font-bold text-rose-400 hover:text-white"
                                >
                                  Yes
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDelete(null)}
                                  className="text-slate-400 hover:text-white ml-1"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDelete({ type: 'cert', index: idx })}
                                className="p-1 text-slate-500 hover:text-rose-400 rounded"
                                title="Remove certification"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                              <label className="text-sm font-medium text-slate-300">Certificate Name</label>
                              <input
                                type="text"
                                placeholder="e.g. AWS Solutions Architect"
                                value={cert.name || ''}
                                onChange={(e) => {
                                  const updated = [...profile.certifications];
                                  updated[idx].name = e.target.value;
                                  setProfile({ ...profile, certifications: updated });
                                }}
                                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-slate-300">Issuing Organization</label>
                              <input
                                type="text"
                                placeholder="e.g. Amazon Web Services"
                                value={cert.issuer || ''}
                                onChange={(e) => {
                                  const updated = [...profile.certifications];
                                  updated[idx].issuer = e.target.value;
                                  setProfile({ ...profile, certifications: updated });
                                }}
                                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-slate-300">Issue Date</label>
                              <input
                                type="text"
                                placeholder="e.g. 2023 or Nov 2023"
                                value={cert.date || ''}
                                onChange={(e) => {
                                  const updated = [...profile.certifications];
                                  updated[idx].date = e.target.value;
                                  setProfile({ ...profile, certifications: updated });
                                }}
                                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-slate-300">Credential URL</label>
                              <input
                                type="url"
                                placeholder="https://..."
                                value={cert.url || ''}
                                onChange={(e) => {
                                  const updated = [...profile.certifications];
                                  updated[idx].url = e.target.value;
                                  setProfile({ ...profile, certifications: updated });
                                }}
                                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 8. Achievements */}
                <div className="glass-panel p-6 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-yellow-400" />
                      <h3 className="text-base font-bold text-white">Achievements & Honors</h3>
                      <span className="px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-xs font-semibold">
                        {(profile.achievements || []).length}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={addAchievement}
                      className="px-3.5 py-1.5 rounded-xl bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-500/30 text-yellow-300 text-sm font-medium flex items-center gap-1.5 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Achievement</span>
                    </button>
                  </div>

                  {(profile.achievements || []).length === 0 ? (
                    <div className="p-8 rounded-xl bg-slate-900/40 border border-dashed border-white/10 text-center space-y-3">
                      <Trophy className="w-8 h-8 text-slate-500 mx-auto" />
                      <p className="text-sm font-medium text-slate-300">No achievements added yet</p>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        Add hackathon prizes, academic scholarships, open source recognitions, or competitive rankings.
                      </p>
                      <button
                        type="button"
                        onClick={addAchievement}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-yellow-600/30 hover:bg-yellow-600/50 text-yellow-200 text-xs font-semibold"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Achievement</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(profile.achievements || []).map((ach, idx) => (
                        <div key={idx} className="glass-card p-4 rounded-xl space-y-3 relative border border-white/10">
                          <div className="flex items-center justify-between border-b border-white/5 pb-2">
                            <span className="text-xs font-bold text-yellow-400">Achievement #{idx + 1}</span>
                            {confirmDelete?.type === 'achievement' && confirmDelete?.index === idx ? (
                              <div className="flex items-center gap-1.5 bg-rose-500/20 border border-rose-500/40 px-2 py-0.5 rounded-lg text-xs">
                                <span className="text-[11px] text-rose-300">Delete?</span>
                                <button
                                  type="button"
                                  onClick={() => removeAchievement(idx)}
                                  className="font-bold text-rose-400 hover:text-white"
                                >
                                  Yes
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDelete(null)}
                                  className="text-slate-400 hover:text-white ml-1"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDelete({ type: 'achievement', index: idx })}
                                className="p-1 text-slate-500 hover:text-rose-400 rounded"
                                title="Remove achievement"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="sm:col-span-2">
                              <label className="text-sm font-medium text-slate-300">Title / Award</label>
                              <input
                                type="text"
                                placeholder="e.g. 1st Place - National Hackathon 2023"
                                value={ach.title || ''}
                                onChange={(e) => {
                                  const updated = [...(profile.achievements || [])];
                                  updated[idx].title = e.target.value;
                                  setProfile({ ...profile, achievements: updated });
                                }}
                                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-slate-300">Date / Year</label>
                              <input
                                type="text"
                                placeholder="e.g. Oct 2023"
                                value={ach.date || ''}
                                onChange={(e) => {
                                  const updated = [...(profile.achievements || [])];
                                  updated[idx].date = e.target.value;
                                  setProfile({ ...profile, achievements: updated });
                                }}
                                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="text-sm font-medium text-slate-300">Issuer / Organization</label>
                              <input
                                type="text"
                                placeholder="e.g. Major League Hacking / University"
                                value={ach.issuer || ''}
                                onChange={(e) => {
                                  const updated = [...(profile.achievements || [])];
                                  updated[idx].issuer = e.target.value;
                                  setProfile({ ...profile, achievements: updated });
                                }}
                                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="text-sm font-medium text-slate-300">Description / Details</label>
                              <input
                                type="text"
                                placeholder="Built an automated pipeline that won top prize among 200+ teams..."
                                value={ach.description || ''}
                                onChange={(e) => {
                                  const updated = [...(profile.achievements || [])];
                                  updated[idx].description = e.target.value;
                                  setProfile({ ...profile, achievements: updated });
                                }}
                                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={saveLoading}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white text-sm font-medium flex items-center gap-2 shadow-lg shadow-indigo-600/20"
              >
                {saveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>Save Profile & Next: Job Preferences</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* STEP 3: JOB PREFERENCES & SEARCH RULES               */}
        {/* ---------------------------------------------------- */}
        {step === 3 && (
          <div className="glass-panel p-8 rounded-2xl shadow-xl space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-400" />
              Target Roles & Discovery Rules
            </h2>

            {/* 1. Target Roles Multi-Select + Custom */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                Target Roles
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {preferences.target_roles.map((role) => (
                  <span
                    key={role}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-xs font-medium"
                  >
                    <span>{role}</span>
                    <button
                      type="button"
                      onClick={() => removeTargetRole(role)}
                      className="text-slate-400 hover:text-rose-400 ml-1"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2 max-w-md">
                <input
                  type="text"
                  placeholder="e.g. React Developer Intern, AI Engineer..."
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTargetRole();
                    }
                  }}
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={addTargetRole}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
                >
                  Add Role
                </button>
              </div>
            </div>

            {/* 2. Experience Level & Workplace Type */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-white/10">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Seniority / Level
                </label>
                <select
                  value={preferences.experience_level}
                  onChange={(e) => setPreferences({ ...preferences, experience_level: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="Intern">Internship</option>
                  <option value="Fresher">Fresher / Graduate</option>
                  <option value="Junior">Junior (1-3 yrs)</option>
                  <option value="Mid">Mid-Level (3-5 yrs)</option>
                  <option value="Senior">Senior (5+ yrs)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Workplace Type
                </label>
                <select
                  value={preferences.workplace_type}
                  onChange={(e) => setPreferences({ ...preferences, workplace_type: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="Remote">Remote Only</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Onsite">Onsite</option>
                  <option value="Any">Any / Flexible</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Minimum Salary / Stipend (USD / yr)
                </label>
                <input
                  type="number"
                  value={preferences.min_salary}
                  onChange={(e) => setPreferences({ ...preferences, min_salary: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* 3. Apply Mode Selector */}
            <div className="pt-4 border-t border-white/10">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">
                Automation Apply Mode
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    id: 'review_then_apply',
                    title: 'Review-then-Apply (Default)',
                    badge: 'Recommended',
                    desc: 'AI scores, tailors resume & stages application for your 1-click preview and approval.',
                  },
                  {
                    id: 'auto_with_cap',
                    title: 'Auto with Daily Cap',
                    badge: 'Controlled',
                    desc: 'Applies automatically to jobs scoring >= 75% up to your daily cap (e.g. 20/day).',
                  },
                  {
                    id: 'full_auto',
                    title: 'Full Auto Pilot',
                    badge: 'Autonomous',
                    desc: 'Continuous non-stop applying across Greenhouse, Lever, and Ashby feeds with zero delay.',
                  },
                ].map((mode) => (
                  <div
                    key={mode.id}
                    onClick={() => setPreferences({ ...preferences, apply_mode: mode.id })}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      preferences.apply_mode === mode.id
                        ? 'bg-indigo-600/20 border-indigo-500 shadow-lg shadow-indigo-600/10'
                        : 'bg-slate-900/60 border-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-white">{mode.title}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-semibold">
                        {mode.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-snug">{mode.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={handleSavePreferences}
                disabled={saveLoading}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white text-sm font-medium flex items-center gap-2 shadow-lg shadow-indigo-600/20"
              >
                {saveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>Save & Next: Common Questions</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* STEP 4: COMMON QUESTIONS BANK                        */}
        {/* ---------------------------------------------------- */}
        {step === 4 && (
          <div className="glass-panel p-8 rounded-2xl shadow-xl space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-indigo-400" />
                  Common Questions Bank
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Answer once. The Playwright form-filler uses these answers on application forms automatically.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-300">Work Authorization Status</label>
                <input
                  type="text"
                  value={questions.work_authorization || ''}
                  onChange={(e) => setQuestions({ ...questions, work_authorization: e.target.value })}
                  placeholder="e.g. Authorized to work without visa sponsorship"
                  className="w-full mt-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Notice Period</label>
                <input
                  type="text"
                  value={questions.notice_period || ''}
                  onChange={(e) => setQuestions({ ...questions, notice_period: e.target.value })}
                  placeholder="e.g. Immediate / 15 days / 1 month"
                  className="w-full mt-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Expected Annual CTC / Salary</label>
                <input
                  type="text"
                  value={questions.expected_ctc || ''}
                  onChange={(e) => setQuestions({ ...questions, expected_ctc: e.target.value })}
                  placeholder="e.g. $95,000 / year or INR 18 LPA"
                  className="w-full mt-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Current Salary / CTC</label>
                <input
                  type="text"
                  value={questions.current_ctc || ''}
                  onChange={(e) => setQuestions({ ...questions, current_ctc: e.target.value })}
                  placeholder="e.g. $80,000 / year"
                  className="w-full mt-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Earliest Availability / Start Date</label>
                <input
                  type="text"
                  value={questions.earliest_start_date || ''}
                  onChange={(e) => setQuestions({ ...questions, earliest_start_date: e.target.value })}
                  placeholder="e.g. Immediately"
                  className="w-full mt-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs"
                />
              </div>

              <div className="flex items-center gap-6 pt-5">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={questions.willing_to_relocate}
                    onChange={(e) => setQuestions({ ...questions, willing_to_relocate: e.target.checked })}
                    className="rounded bg-slate-900 border-white/10 text-indigo-500"
                  />
                  <span>Willing to relocate if required</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={questions.needs_sponsorship}
                    onChange={(e) => setQuestions({ ...questions, needs_sponsorship: e.target.checked })}
                    className="rounded bg-slate-900 border-white/10 text-indigo-500"
                  />
                  <span>Requires visa sponsorship</span>
                </label>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-white/10">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={handleCompleteOnboarding}
                disabled={saveLoading}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-cyan-500 hover:from-emerald-500 hover:to-cyan-400 text-white text-sm font-bold flex items-center gap-2 shadow-xl shadow-emerald-600/25 active:scale-95 transition-all"
              >
                {saveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>Complete Onboarding & Go to Profile</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
