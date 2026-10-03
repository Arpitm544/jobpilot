'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/authContext';
import { api } from '@/lib/api';
import { logger } from '@/lib/logger';
import ResumeUploader from '@/components/resume/ResumeUploader';
import ProfileEditor from '@/components/profile/ProfileEditor';
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
  X,
  Download,
  RefreshCw,
  FileCheck
} from 'lucide-react';


export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading: authLoading, bootstrapData } = useAuth();

  const [step, setStep] = useState(1);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [viewJson, setViewJson] = useState(false);
  const [parseMetadata, setParseMetadata] = useState(null);
  const [accountFallbackFields, setAccountFallbackFields] = useState({});
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Step 1: Resume & Onboarding Server State
  const [selectedFile, setSelectedFile] = useState(null);
  const [activeResumeId, setActiveResumeId] = useState(null);
  const [onboardingState, setOnboardingState] = useState(null);
  const [stateLoading, setStateLoading] = useState(true);
  const [stateError, setStateError] = useState(false);
  const [forceShowUploader, setForceShowUploader] = useState(false);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [incomingProfile, setIncomingProfile] = useState(null);

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
        github_url: cleanStr(p.github_url || p.links?.github_repo || (p.link && p.link.includes('github.com') ? p.link : '')),
        demo_url: cleanStr(p.demo_url || p.links?.live_demo || (p.link && !p.link.includes('github.com') ? p.link : '')),
        link: cleanStr(p.link || p.github_url || p.demo_url),
        links: {
          github_repo: cleanStr(p.github_url || p.links?.github_repo || (p.link && p.link.includes('github.com') ? p.link : '')),
          live_demo: cleanStr(p.demo_url || p.links?.live_demo || (p.link && !p.link.includes('github.com') ? p.link : '')),
        },
        source: p.source || 'resume',
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
        links: {
          github_repo: cleanStr(p.github_url) || null,
          live_demo: cleanStr(p.demo_url) || null,
        },
        source: p.source || 'resume',
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

  // Step 2: GitHub repo suggestion state
  const [githubSuggestions, setGithubSuggestions] = useState({});
  const [githubSuggestionsLoading, setGithubSuggestionsLoading] = useState(false);
  const [githubSuggestionsNotice, setGithubSuggestionsNotice] = useState('');

  const fetchGithubRepoSuggestions = async () => {
    setGithubSuggestionsLoading(true);
    setGithubSuggestionsNotice('');
    try {
      const res = await api.get('/profile/projects/github-suggestions');
      if (res.data?.suggestions) {
        setGithubSuggestions(res.data.suggestions);
        if (res.data.rate_limit_notice) {
          setGithubSuggestionsNotice(res.data.rate_limit_notice);
        }
      }
    } catch (e) {
      logger.warn('Failed to fetch github suggestions:', e);
    } finally {
      setGithubSuggestionsLoading(false);
    }
  };

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
    home_country: 'IN',
    home_city: '',
    citizenship: 'IN',
    work_authorization: 'Authorized to work without sponsorship',
    needs_sponsorship: false,
    notice_period: 'Immediate (0-15 days)',
    expected_ctc: '$90,000 / year (or INR 15-20 LPA)',
    current_ctc: '$75,000 / year',
    willing_to_relocate: true,
    open_to_international: false,
    earliest_start_date: 'Immediately',
    portfolio_url: '',
    linkedin_url: '',
    github_url: '',
  });

  // New Skill Temp State
  const [newSkill, setNewSkill] = useState({ category: 'languages', value: '' });

  // Fetch onboarding state from backend and sync steps
  const fetchOnboardingState = async (shouldSetInitialStep = false, fallbackData = null) => {
    try {
      setStateError(false);
      let data = fallbackData;
      if (!data) {
        const res = await api.get('/onboarding/state');
        data = res.data;
      }
      if (data) {
        setOnboardingState(data);
        if (shouldSetInitialStep) {
          const lastCompleted = data.last_completed_step || 0;
          if (lastCompleted >= 4) {
            setStep(1);
          } else {
            setStep(Math.min(4, Math.max(1, lastCompleted + 1)));
          }
        }
      }
    } catch (e) {
      logger.error('Failed to fetch onboarding state:', e);
      setStateError(true);
    }
  };

  const loadAllUserData = async () => {
    setStateLoading(true);

    // If we have bootstrap data from the shell, use it to skip the onboarding state API call
    if (bootstrapData?.onboarding) {
      fetchOnboardingState(true, bootstrapData.onboarding);
    } else {
      fetchOnboardingState(true);
    }

    // Fetch form data concurrently to prevent waterfalls
    try {
      const [profRes, prefRes, qbRes] = await Promise.allSettled([
        api.get('/profile/master'),
        api.get('/preferences/'),
        api.get('/profile/question-bank'),
      ]);

      if (profRes.status === 'fulfilled' && profRes.value.data) {
        setProfile(mapApiProfileToForm(profRes.value.data, user));
      }
      if (prefRes.status === 'fulfilled' && prefRes.value.data) {
        setPreferences((prev) => ({ ...prev, ...prefRes.value.data }));
      }
      if (qbRes.status === 'fulfilled' && qbRes.value.data) {
        setQuestions((prev) => ({ ...prev, ...qbRes.value.data }));
      }
    } catch (e) {
      logger.error('Failed to load user data concurrently:', e);
    }

    setStateLoading(false);
  };

  useEffect(() => {
    if (user) {
      loadAllUserData();
    }
  }, [user]);

  // Step 1: Upload Resume Handlers
  const handleUploadComplete = async ({ resumeId, isCached, filename }) => {
    if (!resumeId) return;
    setActiveResumeId(resumeId);
    setError('');
    setUploadLoading(true);
    try {
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

        const parsedProfile = parsedData.profile;
        if (parsedProfile) {
          const mappedIncoming = mapApiProfileToForm(parsedProfile, user);
          if (onboardingState?.has_active_profile) {
            // If profile already exists, ask user whether to merge or replace
            setIncomingProfile(mappedIncoming);
            setMergeModalOpen(true);
          } else {
            // Fresh user: directly apply parsed profile
            setProfile(mappedIncoming);
            setSuccessMsg(isCached ? 'Resume retrieved from cache instantly!' : 'Resume parsed and verified successfully!');
            await api.put('/onboarding/step', { step: 1 });
            await fetchOnboardingState();
            setTimeout(() => {
              setSuccessMsg('');
              setStep(2);
            }, 1000);
          }
        }
      }
    } catch (err) {
      logger.error('Failed to retrieve parsed resume:', err);
      setError(err.response?.data?.detail || 'Failed to retrieve parsed resume.');
    } finally {
      setUploadLoading(false);
    }
  };

  // Merge / Replace Choice Handlers
  const handleKeepAndFillEmpties = async () => {
    if (!incomingProfile) return;
    setProfile((prev) => {
      const mergedContact = { ...prev.contact_info };
      for (const [k, v] of Object.entries(incomingProfile.contact_info || {})) {
        if (!mergedContact[k] && v) {
          mergedContact[k] = v;
        }
      }

      const mergedSummary = prev.summary || incomingProfile.summary;

      const mergedSkills = { ...prev.skills };
      for (const cat of ['languages', 'frameworks', 'databases', 'tools', 'cloud_devops', 'soft_skills']) {
        const existingList = prev.skills?.[cat] || [];
        const incomingList = incomingProfile.skills?.[cat] || [];
        mergedSkills[cat] = Array.from(new Set([...existingList, ...incomingList]));
      }

      let mergedProjects = [...(prev.projects || [])];
      if (mergedProjects.length === 0) {
        mergedProjects = incomingProfile.projects || [];
      } else {
        const existingTitles = new Set(mergedProjects.map((p) => p.title?.toLowerCase().trim()));
        for (const p of incomingProfile.projects || []) {
          if (p.title && !existingTitles.has(p.title.toLowerCase().trim())) {
            mergedProjects.push(p);
          }
        }
      }

      let mergedExp = [...(prev.experience || [])];
      if (mergedExp.length === 0) {
        mergedExp = incomingProfile.experience || [];
      } else {
        const existingKeys = new Set(mergedExp.map((e) => `${e.company?.toLowerCase()}_${e.role?.toLowerCase()}`));
        for (const e of incomingProfile.experience || []) {
          const key = `${e.company?.toLowerCase()}_${e.role?.toLowerCase()}`;
          if (!existingKeys.has(key)) {
            mergedExp.push(e);
          }
        }
      }

      let mergedEdu = [...(prev.education || [])];
      if (mergedEdu.length === 0) {
        mergedEdu = incomingProfile.education || [];
      }

      // Merge certifications: add new ones not already present (by name)
      let mergedCerts = [...(prev.certifications || [])];
      if (mergedCerts.length === 0) {
        mergedCerts = incomingProfile.certifications || [];
      } else {
        const existingCertNames = new Set(mergedCerts.map((c) => c.name?.toLowerCase().trim()));
        for (const c of incomingProfile.certifications || []) {
          if (c.name && !existingCertNames.has(c.name.toLowerCase().trim())) {
            mergedCerts.push(c);
          }
        }
      }

      // Merge achievements: add new ones not already present (by title)
      let mergedAchievements = [...(prev.achievements || [])];
      if (mergedAchievements.length === 0) {
        mergedAchievements = incomingProfile.achievements || [];
      } else {
        const existingTitles = new Set(mergedAchievements.map((a) => a.title?.toLowerCase().trim()));
        for (const a of incomingProfile.achievements || []) {
          if (a.title && !existingTitles.has(a.title.toLowerCase().trim())) {
            mergedAchievements.push(a);
          }
        }
      }

      return {
        ...prev,
        contact_info: mergedContact,
        summary: mergedSummary,
        skills: mergedSkills,
        projects: mergedProjects,
        experience: mergedExp,
        education: mergedEdu,
        certifications: mergedCerts,
        achievements: mergedAchievements,
      };
    });


    setMergeModalOpen(false);
    setDiffModalOpen(false);
    setForceShowUploader(false);
    setSuccessMsg('Merged new resume data into your profile (preserved your edits).');
    await api.put('/onboarding/step', { step: 1 });
    await fetchOnboardingState();
    setTimeout(() => {
      setSuccessMsg('');
      setStep(2);
    }, 800);
  };

  const handleReplaceProfile = async () => {
    if (!incomingProfile) return;
    setProfile(incomingProfile);
    setMergeModalOpen(false);
    setDiffModalOpen(false);
    setForceShowUploader(false);
    setSuccessMsg('Replaced profile with newly parsed resume data.');
    await api.put('/onboarding/step', { step: 1 });
    await fetchOnboardingState();
    setTimeout(() => {
      setSuccessMsg('');
      setStep(2);
    }, 800);
  };

  // Step 1 direct file upload (fallback)
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
      const mapped = mapApiProfileToForm(parsed, user);
      if (onboardingState?.has_active_profile) {
        setIncomingProfile(mapped);
        setMergeModalOpen(true);
      } else {
        setProfile(mapped);
        setSuccessMsg('Resume parsed and structured into Master Profile successfully!');
        await api.put('/onboarding/step', { step: 1 });
        await fetchOnboardingState();
        setTimeout(() => {
          setSuccessMsg('');
          setStep(2);
        }, 1200);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to parse resume.');
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

  // Step 2: Save Master Profile
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
      await api.put('/onboarding/step', { step: 2 });
      await fetchOnboardingState();
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

  // Step 3: Save Job Preferences
  const handleSavePreferences = async () => {
    setError('');
    setSaveLoading(true);
    try {
      await api.put('/preferences', preferences);
      await api.put('/onboarding/step', { step: 3 });
      await fetchOnboardingState();
      setSuccessMsg('Job preferences saved!');
      setTimeout(() => {
        setSuccessMsg('');
        setStep(4);
      }, 600);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save job preferences.');
    } finally {
      setSaveLoading(false);
    }
  };

  // Step 4: Complete Onboarding & Save Question Bank
  const handleCompleteOnboarding = async () => {
    setError('');
    setSaveLoading(true);
    try {
      await Promise.allSettled([
        api.put('/profile/question-bank', questions),
        api.put('/settings/location', {
          home_country: questions.home_country || 'IN',
          home_city: questions.home_city || '',
          citizenship: questions.citizenship || 'IN',
          needs_visa_sponsorship: Boolean(questions.needs_sponsorship),
          willing_to_relocate: Boolean(questions.willing_to_relocate),
          open_to_international: Boolean(questions.open_to_international),
        })
      ]);
      await api.put('/onboarding/step', { step: 4 });
      await fetchOnboardingState();
      setSuccessMsg('Onboarding complete! Your profile is automated.');
      setTimeout(() => {
        setSuccessMsg('');
        router.push('/pipeline');
      }, 800);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save questions.');
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
        {/* Onboarding Complete Banner (if fully onboarded) */}
        {onboardingState?.last_completed_step >= 4 && (
          <div className="mb-8 p-5 rounded-2xl bg-gradient-to-r from-emerald-950/70 via-indigo-950/40 to-slate-900 border border-emerald-500/40 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 backdrop-blur-md">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                <Trophy className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Onboarding Complete!</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Ready for Automation
                  </span>
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Your Master Profile, job preferences, and question bank are set up. You can review them anytime or proceed to your job pipeline.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => router.push('/pipeline')}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>Open Pipeline</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

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
            ].map((s) => {
              const isCompleted = (onboardingState?.last_completed_step || 0) >= s.num;
              const isClickable = isCompleted || s.num <= (onboardingState?.last_completed_step || 0) + 1;
              return (
                <button
                  key={s.num}
                  disabled={!isClickable}
                  onClick={() => setStep(s.num)}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    step === s.num
                      ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-lg shadow-indigo-500/10'
                      : isCompleted
                      ? 'bg-slate-900/60 border-emerald-500/30 text-emerald-400 hover:border-emerald-500/60 cursor-pointer'
                      : isClickable
                      ? 'bg-slate-900/30 border-white/10 text-slate-300 hover:border-indigo-500/40 cursor-pointer'
                      : 'bg-slate-900/20 border-white/5 text-slate-600 cursor-not-allowed opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        step === s.num
                          ? 'bg-indigo-500 text-white'
                          : isCompleted
                          ? 'bg-emerald-500 text-black'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isCompleted ? '✓' : s.num}
                    </span>
                    <span className="text-xs font-medium truncate">{s.label}</span>
                  </div>
                </button>
              );
            })}
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
            {stateLoading ? (
              /* Loading Skeleton: prevents flash of empty upload screen */
              <div className="space-y-6 animate-pulse">
                <div className="text-center max-w-lg mx-auto space-y-2">
                  <div className="h-7 bg-slate-800 rounded-xl w-3/4 mx-auto" />
                  <div className="h-4 bg-slate-800/60 rounded-lg w-1/2 mx-auto" />
                </div>
                <div className="p-8 rounded-2xl bg-slate-900/40 border border-white/5 space-y-4">
                  <div className="h-12 bg-slate-800/50 rounded-xl w-full" />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="h-20 bg-slate-800/30 rounded-xl" />
                    <div className="h-20 bg-slate-800/30 rounded-xl" />
                  </div>
                  <div className="h-10 bg-slate-800/50 rounded-xl w-1/3" />
                </div>
              </div>
            ) : stateError ? (
              /* Error State with Retry */
              <div className="p-8 rounded-2xl bg-rose-950/20 border border-rose-500/30 text-center space-y-4">
                <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
                <h3 className="text-base font-semibold text-white">Could not load onboarding state</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Unable to connect to the backend server. Please check your network connection and retry.
                </p>
                <button
                  type="button"
                  onClick={loadAllUserData}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-600/20"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              </div>
            ) : (onboardingState?.has_resume && onboardingState?.has_active_profile && !forceShowUploader) ? (
              /* RESUME ON FILE CARD: Displays saved resume, summary, and actions */
              <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950 border border-indigo-500/20 shadow-2xl backdrop-blur-xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                      <FileCheck className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-bold text-white truncate max-w-[280px] sm:max-w-md">
                          {onboardingState.resume?.filename || 'Resume on File'}
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Parsed & Verified
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Uploaded {onboardingState.resume?.uploaded_at ? new Date(onboardingState.resume.uploaded_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'recently'} • Zero Hallucination Verified
                      </p>
                    </div>
                  </div>

                  {onboardingState.resume?.download_url && (
                    <a
                      href={api.defaults.baseURL ? `${api.defaults.baseURL}${onboardingState.resume.download_url}` : onboardingState.resume.download_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium border border-white/10 transition-colors shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download / View Resume</span>
                    </a>
                  )}
                </div>

                {/* Resume Summary & Completeness Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Extracted Content</span>
                    <p className="text-sm font-medium text-white">
                      {onboardingState.resume?.parse_summary || '22 frameworks, 4 projects, 1 education entry'}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Master Profile Completeness</span>
                      <span className="text-xs font-bold text-indigo-400">{onboardingState.profile_completeness || 0}%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${onboardingState.profile_completeness || 0}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Primary Actions */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(Math.min(4, Math.max(2, (onboardingState.last_completed_step || 1) + 1)))}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <span>Continue with this resume</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium border border-white/10 transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-slate-400" />
                    <span>Review / edit my profile</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForceShowUploader(true)}
                    className="px-4 py-2.5 rounded-xl bg-transparent hover:bg-white/5 text-slate-400 hover:text-slate-200 text-sm font-medium transition-colors ml-auto flex items-center gap-2 cursor-pointer"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>Upload a new resume</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Upload Zone (New Users or Uploading a New Resume) */
              <div className="space-y-4">
                {forceShowUploader && (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Info className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        <strong>Notice:</strong> Uploading a new resume creates a draft and will not overwrite your saved profile until you confirm.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForceShowUploader(false)}
                      className="text-amber-400 hover:text-white underline underline-offset-2 shrink-0 cursor-pointer"
                    >
                      ← Keep current resume
                    </button>
                  </div>
                )}

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
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* STEP 2: MASTER PROFILE EDITOR                        */}
        {/* ---------------------------------------------------- */}
        {step === 2 && (
          <div className="space-y-6">
            <ProfileEditor
              mode="onboarding"
              parseMetadata={parseMetadata}
              onBack={() => setStep(1)}
              onSaveSuccess={async () => {
                await api.put('/onboarding/step', { step: 2 });
                await fetchOnboardingState();
                setSuccessMsg('Master Profile saved as single source of truth!');
                setTimeout(() => {
                  setSuccessMsg('');
                  setStep(3);
                }, 800);
              }}
            />
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

            {/* 2. Apply Mode Selector */}
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
                <label className="text-xs font-semibold text-slate-300">Home Country (Drives Job Ranking & Local Currency)</label>
                <select
                  value={questions.home_country || 'IN'}
                  onChange={(e) => setQuestions({ ...questions, home_country: e.target.value })}
                  className="w-full mt-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs"
                >
                  <option value="IN">India (IN) - ₹ / INR</option>
                  <option value="US">United States (US) - $ / USD</option>
                  <option value="GB">United Kingdom (GB) - £ / GBP</option>
                  <option value="DE">Germany (DE) - € / EUR</option>
                  <option value="CA">Canada (CA) - C$ / CAD</option>
                  <option value="SG">Singapore (SG) - S$ / SGD</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Citizenship / Passport Country</label>
                <select
                  value={questions.citizenship || 'IN'}
                  onChange={(e) => setQuestions({ ...questions, citizenship: e.target.value })}
                  className="w-full mt-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs"
                >
                  <option value="IN">India (IN)</option>
                  <option value="US">United States (US)</option>
                  <option value="GB">United Kingdom (GB)</option>
                  <option value="DE">Germany (DE)</option>
                  <option value="CA">Canada (CA)</option>
                  <option value="SG">Singapore (SG)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Home City</label>
                <input
                  type="text"
                  value={questions.home_city || ''}
                  onChange={(e) => setQuestions({ ...questions, home_city: e.target.value })}
                  placeholder="e.g. Bengaluru, Berlin, London..."
                  className="w-full mt-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs"
                />
              </div>

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

              <div className="sm:col-span-2 flex flex-wrap items-center gap-6 pt-3 border-t border-white/5">
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
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={questions.open_to_international}
                    onChange={(e) => setQuestions({ ...questions, open_to_international: e.target.checked })}
                    className="rounded bg-slate-900 border-white/10 text-indigo-500"
                  />
                  <span>Open to international remote roles</span>
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

        {/* Merge vs Replace Decision Modal */}
        {mergeModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">New Resume Parsed</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      You already have an active profile saved. How would you like to apply the newly parsed data?
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMergeModalOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                {/* Option 1: Safest - Keep edits & fill empties */}
                <div
                  onClick={handleKeepAndFillEmpties}
                  className="p-4 rounded-xl border border-indigo-500/40 bg-indigo-950/30 hover:bg-indigo-950/50 cursor-pointer transition-all space-y-1 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">
                      Keep my profile and only fill empty fields
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">
                      Recommended (Safest)
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Preserves any manual edits you made previously. Missing contact info, skills, and new projects from this resume are added.
                  </p>
                </div>

                {/* Option 2: Replace */}
                <div
                  onClick={handleReplaceProfile}
                  className="p-4 rounded-xl border border-white/10 bg-slate-800/40 hover:bg-slate-800/70 cursor-pointer transition-all space-y-1 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white group-hover:text-amber-300 transition-colors">
                      Replace my profile with the new data
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                      Overwrites All
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Replaces your current profile entirely with the newly parsed resume content.
                  </p>
                </div>

                {/* Option 3: Review differences */}
                <button
                  type="button"
                  onClick={() => {
                    setMergeModalOpen(false);
                    setDiffModalOpen(true);
                  }}
                  className="w-full text-center py-2 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors cursor-pointer"
                >
                  Review differences first →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Diff Review Modal */}
        {diffModalOpen && incomingProfile && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-white/10 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-start justify-between border-b border-white/10 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    Review Profile Differences
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Compare your saved Master Profile with the newly parsed resume data.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDiffModalOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
                {/* Contact comparison */}
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 space-y-2">
                  <span className="font-semibold text-slate-300 uppercase tracking-wider text-[10px]">Contact Info</span>
                  <div className="grid grid-cols-2 gap-3 text-slate-400">
                    <div>
                      <span className="text-[10px] text-slate-500 block font-semibold mb-0.5">Current Saved</span>
                      <p className="text-white font-medium">{profile.contact_info?.full_name || '(empty)'}</p>
                      <p>{profile.contact_info?.email || '(empty)'}</p>
                      <p>{profile.contact_info?.phone || '(empty)'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-indigo-400 block font-semibold mb-0.5">New from Resume</span>
                      <p className="text-white font-medium">{incomingProfile.contact_info?.full_name || '(empty)'}</p>
                      <p>{incomingProfile.contact_info?.email || '(empty)'}</p>
                      <p>{incomingProfile.contact_info?.phone || '(empty)'}</p>
                    </div>
                  </div>
                </div>

                {/* Skills Comparison */}
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 space-y-2">
                  <span className="font-semibold text-slate-300 uppercase tracking-wider text-[10px]">Skills Count</span>
                  <div className="grid grid-cols-2 gap-3 text-slate-400">
                    <div>
                      <span className="text-[10px] text-slate-500 block font-semibold mb-0.5">Current Skills</span>
                      <p className="text-white">
                        {Object.values(profile.skills || {}).reduce((acc, l) => acc + (Array.isArray(l) ? l.length : 0), 0)} skills recorded
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-indigo-400 block font-semibold mb-0.5">Incoming Skills</span>
                      <p className="text-white">
                        {Object.values(incomingProfile.skills || {}).reduce((acc, l) => acc + (Array.isArray(l) ? l.length : 0), 0)} skills detected
                      </p>
                    </div>
                  </div>
                </div>

                {/* Projects Comparison */}
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 space-y-2">
                  <span className="font-semibold text-slate-300 uppercase tracking-wider text-[10px]">Projects Detected</span>
                  <div className="grid grid-cols-2 gap-3 text-slate-400">
                    <div>
                      <span className="text-[10px] text-slate-500 block font-semibold mb-0.5">Current ({profile.projects?.length || 0})</span>
                      <ul className="list-disc list-inside space-y-0.5 text-slate-300 mt-1">
                        {(profile.projects || []).map((p, idx) => (
                          <li key={idx} className="truncate">{p.title || 'Untitled Project'}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <span className="text-[10px] text-indigo-400 block font-semibold mb-0.5">Incoming ({incomingProfile.projects?.length || 0})</span>
                      <ul className="list-disc list-inside space-y-0.5 text-slate-300 mt-1">
                        {(incomingProfile.projects || []).map((p, idx) => (
                          <li key={idx} className="truncate">{p.title || 'Untitled Project'}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setDiffModalOpen(false);
                    setMergeModalOpen(true);
                  }}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleReplaceProfile}
                  className="px-4 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-semibold cursor-pointer"
                >
                  Replace All
                </button>
                <button
                  type="button"
                  onClick={handleKeepAndFillEmpties}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 cursor-pointer"
                >
                  Keep My Edits & Fill Empties
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
