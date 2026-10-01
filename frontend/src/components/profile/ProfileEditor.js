'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User,
  FileText,
  GraduationCap,
  Briefcase,
  FolderGit2,
  Sparkles,
  Award,
  Trophy,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  Code,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Info,
  RefreshCw,
  UploadCloud,
  Compass
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/authContext';

import ContactSection from './ContactSection';
import SummarySection from './SummarySection';
import EducationSection from './EducationSection';
import ExperienceSection from './ExperienceSection';
import ProjectsSection from './ProjectsSection';
import SkillsSection from './SkillsSection';
import CertificationsSection from './CertificationsSection';
import AchievementsSection from './AchievementsSection';

import {
  mapApiProfileToForm,
  formToApi,
  calculateProfileCompleteness,
  createEmptyProfile,
} from './profileMappers';

const TOC_SECTIONS = [
  { id: 'section-contact', label: 'Contact & Info', icon: User },
  { id: 'section-summary', label: 'Summary', icon: FileText },
  { id: 'section-education', label: 'Education', icon: GraduationCap },
  { id: 'section-experience', label: 'Work Experience', icon: Briefcase },
  { id: 'section-projects', label: 'Projects', icon: FolderGit2 },
  { id: 'section-skills', label: 'Technical Skills', icon: Sparkles },
  { id: 'section-certifications', label: 'Certifications', icon: Award },
  { id: 'section-achievements', label: 'Achievements', icon: Trophy },
];

export default function ProfileEditor({
  mode = 'page', // 'page' | 'onboarding'
  onSaveSuccess, // used in onboarding mode
  onBack, // used in onboarding mode
  parseMetadata = null, // optional metadata passed from onboarding
}) {
  const router = useRouter();
  const { user } = useAuth();

  // Profile data & metadata
  const [profile, setProfile] = useState(() => createEmptyProfile(user));
  const [savedSnapshot, setSavedSnapshot] = useState(null);
  const [versionInfo, setVersionInfo] = useState({ version: 1, updated_at: null });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Dirty state & Draft
  const [isDirty, setIsDirty] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  // Save state
  const [saving, setSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [saveErrorMsg, setSaveErrorMsg] = useState('');

  // UI state
  const [viewJson, setViewJson] = useState(false);
  const [activeSection, setActiveSection] = useState('section-contact');
  const [lastSavedTime, setLastSavedTime] = useState(null);

  const DRAFT_STORAGE_KEY = `jobpilot_profile_draft_${user?.id || 'guest'}`;

  // 1. Fetch active profile
  const fetchProfile = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await api.get('/profile');
      if (res.data) {
        const mapped = mapApiProfileToForm(res.data, user);
        setProfile(mapped);
        setSavedSnapshot(JSON.stringify(mapped));
        setVersionInfo({
          version: res.data.version || 1,
          updated_at: res.data.updated_at || null,
        });
        if (res.data.updated_at) {
          setLastSavedTime(new Date(res.data.updated_at));
        }

        // Check if there is an unsaved local draft newer than remote
        try {
          const localDraftRaw = localStorage.getItem(DRAFT_STORAGE_KEY);
          if (localDraftRaw) {
            const localDraft = JSON.parse(localDraftRaw);
            if (localDraft?.profile && JSON.stringify(localDraft.profile) !== JSON.stringify(mapped)) {
              setProfile(localDraft.profile);
              setIsDirty(true);
              setDraftRestored(true);
            }
          }
        } catch (e) {
          // ignore localStorage errors
        }
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
      setLoadError(err.response?.data?.detail || 'Unable to connect to the backend server to load your Master Profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  // Track isDirty and update local draft
  useEffect(() => {
    if (!savedSnapshot) return;
    const currentJson = JSON.stringify(profile);
    const changed = currentJson !== savedSnapshot;
    setIsDirty(changed);

    if (changed) {
      try {
        localStorage.setItem(
          DRAFT_STORAGE_KEY,
          JSON.stringify({ profile, timestamp: Date.now() })
        );
      } catch (e) {}
    }
  }, [profile, savedSnapshot, DRAFT_STORAGE_KEY]);

  // Warn before leaving page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes in your Master Profile. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Track active section for table of contents
  useEffect(() => {
    if (mode !== 'page') return;

    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200;
      for (const item of TOC_SECTIONS) {
        const el = document.getElementById(item.id);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(item.id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [mode]);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      const offset = 80;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = el.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
      setActiveSection(id);
    }
  };

  // Profile completeness computation
  const completeness = useMemo(() => {
    return calculateProfileCompleteness(profile);
  }, [profile]);

  // Zero-hallucination field badge helper
  const getFieldBadge = (fieldPath) => {
    if (!parseMetadata?.field_meta) return null;
    const meta = parseMetadata.field_meta.find((m) => m.field_path === fieldPath);
    if (!meta) return null;

    if (meta.status === 'verified') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          Verified
        </span>
      );
    }
    if (meta.status === 'unverified') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
          <AlertCircle className="w-3 h-3 text-amber-400" />
          Check this
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-800 text-slate-400 border border-white/5">
        Missing
      </span>
    );
  };

  // Save handler with optimistic UI and rollback
  const handleSave = async () => {
    setSaveErrorMsg('');
    setSaveSuccessMsg('');

    // Validations
    const name = profile.contact_info?.full_name?.trim();
    const email = profile.contact_info?.email?.trim();

    if (!name) {
      setSaveErrorMsg('Full Name is required.');
      scrollToSection('section-contact');
      return;
    }
    if (!email) {
      setSaveErrorMsg('Email Address is required.');
      scrollToSection('section-contact');
      return;
    }

    const hasEducation = (profile.education || []).length > 0;
    const hasProjects = (profile.projects || []).length > 0;
    const hasExperience = (profile.experience || []).length > 0;

    if (!hasEducation && !hasProjects && !hasExperience) {
      setSaveErrorMsg('Please add at least one entry under Education, Projects, or Work Experience.');
      return;
    }

    setSaving(true);
    const previousSnapshot = savedSnapshot;

    try {
      const payload = formToApi(profile);
      const res = await api.put('/profile', payload);

      if (res.data) {
        const mapped = mapApiProfileToForm(res.data, user);
        setProfile(mapped);
        setSavedSnapshot(JSON.stringify(mapped));
        setVersionInfo({
          version: res.data.version || (versionInfo.version + 1),
          updated_at: res.data.updated_at || new Date().toISOString(),
        });
        setLastSavedTime(new Date());
        setIsDirty(false);
        setDraftRestored(false);

        try {
          localStorage.removeItem(DRAFT_STORAGE_KEY);
        } catch (e) {}

        setSaveSuccessMsg('Master Profile successfully synchronized and saved!');
        setTimeout(() => setSaveSuccessMsg(''), 4000);

        if (mode === 'onboarding' && onSaveSuccess) {
          onSaveSuccess(res.data);
        }
      }
    } catch (err) {
      console.error('Save failed:', err);
      // Rollback to previous snapshot if necessary
      setSaveErrorMsg(err.response?.data?.detail || 'Failed to save changes. Your draft is preserved locally.');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscardChanges = () => {
    if (savedSnapshot) {
      setProfile(JSON.parse(savedSnapshot));
      setIsDirty(false);
      setDraftRestored(false);
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch (e) {}
    }
  };

  // Format timestamp relative or date
  const formatSavedTime = (date) => {
    if (!date) return '';
    try {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  // Render loading skeleton
  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto py-8">
        <div className="glass-panel p-8 rounded-2xl animate-pulse space-y-4">
          <div className="h-7 bg-slate-800 rounded-xl w-1/3" />
          <div className="h-4 bg-slate-800/60 rounded-lg w-2/3" />
          <div className="h-2 bg-slate-800/50 rounded-full w-full mt-4" />
        </div>
        <div className="glass-panel p-6 rounded-2xl animate-pulse space-y-4">
          <div className="h-5 bg-slate-800 rounded-lg w-1/4" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="h-10 bg-slate-800/50 rounded-xl" />
            <div className="h-10 bg-slate-800/50 rounded-xl" />
            <div className="h-10 bg-slate-800/50 rounded-xl" />
          </div>
        </div>
        <div className="glass-panel p-6 rounded-2xl animate-pulse space-y-4">
          <div className="h-5 bg-slate-800 rounded-lg w-1/4" />
          <div className="h-24 bg-slate-800/40 rounded-xl" />
        </div>
      </div>
    );
  }

  // Render load error state
  if (loadError) {
    return (
      <div className="glass-panel p-8 rounded-2xl border border-rose-500/30 text-center space-y-4 max-w-2xl mx-auto my-12">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-400">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-white">Could not load Master Profile</h3>
        <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
          {loadError}
        </p>
        <button
          type="button"
          onClick={fetchProfile}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry Connection</span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Aria-live announcement for screen readers */}
      <div aria-live="polite" className="sr-only">
        {saveSuccessMsg || saveErrorMsg}
      </div>

      {/* Mode: PAGE - Master Header */}
      {mode === 'page' && (
        <div className="mb-8 pb-6 border-b border-white/10 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                  Candidate Core
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold">
                  Single Source of Truth
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-medium border border-white/5">
                  Version {versionInfo.version}
                  {versionInfo.updated_at && ` • Updated ${new Date(versionInfo.updated_at).toLocaleDateString()}`}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Master Profile Editor
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
                All tailored resumes and application forms are generated only from this verified profile.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={() => setViewJson(!viewJson)}
                className="px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 hover:border-white/20 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-2 transition-all cursor-pointer"
              >
                {viewJson ? <Eye className="w-4 h-4 text-indigo-400" /> : <Code className="w-4 h-4 text-indigo-400" />}
                <span>{viewJson ? 'Visual Editor' : 'View JSON'}</span>
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition-all cursor-pointer disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{saving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>

          {/* Completeness Meter & Status Bar */}
          <div className="glass-panel p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-white/10">
            <div className="flex items-center gap-3.5 flex-1 max-w-xl">
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Profile Completeness
                </span>
                <span className="text-lg font-extrabold text-white flex items-center gap-1.5">
                  <span>{completeness.percentage}%</span>
                  {completeness.missingCount > 0 ? (
                    <span className="text-xs font-medium text-amber-400">
                      ({completeness.missingCount} items need attention)
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-emerald-400">
                      (All core sections complete)
                    </span>
                  )}
                </span>
              </div>
              <div className="flex-1 bg-slate-950 h-2.5 rounded-full overflow-hidden border border-white/5 ml-2">
                <div
                  className="bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 h-full rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${completeness.percentage}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400 shrink-0">
              {lastSavedTime && (
                <span>Last saved at {formatSavedTime(lastSavedTime)}</span>
              )}
              {isDirty && (
                <span className="inline-flex items-center gap-1 text-amber-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  Unsaved changes
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Extraction Metadata Banner (if passed or parsed recently) */}
      {parseMetadata?.summary_counts && (
        <div className="mb-6 p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-indigo-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg backdrop-blur-md">
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
        </div>
      )}

      {/* Global Alerts */}
      {saveSuccessMsg && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex items-center gap-3 animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}
      {saveErrorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-3 animate-in fade-in duration-200">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{saveErrorMsg}</span>
        </div>
      )}

      {/* Draft Restored Banner */}
      {draftRestored && (
        <div className="mb-6 p-3.5 rounded-xl bg-indigo-950/50 border border-indigo-500/30 text-xs text-indigo-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>Restored an unsaved local draft from your browser session.</span>
          </div>
          <button
            type="button"
            onClick={handleDiscardChanges}
            className="text-xs font-semibold text-indigo-300 hover:text-white underline underline-offset-2 cursor-pointer"
          >
            Discard draft & load saved
          </button>
        </div>
      )}

      {/* Mode: JSON Inspector Mode */}
      {viewJson ? (
        <div className="glass-panel p-6 rounded-2xl space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-white/5">
            <span>Normalized JSON Schema representation</span>
            <span>Read-only inspection</span>
          </div>
          <pre className="text-xs text-indigo-300 bg-slate-950 p-4 rounded-xl overflow-x-auto max-h-[600px] leading-relaxed font-mono">
            {JSON.stringify(formToApi(profile), null, 2)}
          </pre>
        </div>
      ) : (
        /* Main Layout: Desktop Sidebar TOC + Content Area */
        <div className={`grid grid-cols-1 ${mode === 'page' ? 'lg:grid-cols-[220px_1fr]' : 'w-full'} gap-8 items-start`}>
          {/* Desktop Table of Contents (Sticky Mini Sidebar) */}
          {mode === 'page' && (
            <aside className="hidden lg:block sticky top-24 space-y-1 p-3 rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-md">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1.5 block">
                Sections
              </span>
              <nav className="space-y-0.5">
                {TOC_SECTIONS.map((sec) => {
                  const Icon = sec.icon;
                  const isActive = activeSection === sec.id;
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => scrollToSection(sec.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all text-left cursor-pointer ${
                        isActive
                          ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-semibold shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                      <span className="truncate">{sec.label}</span>
                    </button>
                  );
                })}
              </nav>
            </aside>
          )}

          {/* Form Sections */}
          <div className="space-y-8 w-full max-w-[950px] mx-auto">
            {/* 1. Contact & Identification */}
            <ContactSection
              contactInfo={profile.contact_info}
              onChange={(contact_info) => setProfile((prev) => ({ ...prev, contact_info }))}
              getFieldBadge={getFieldBadge}
            />

            {/* 2. Professional Summary */}
            <SummarySection
              summary={profile.summary}
              onChange={(summary) => setProfile((prev) => ({ ...prev, summary }))}
              getFieldBadge={getFieldBadge}
            />

            {/* 3. Education */}
            <EducationSection
              education={profile.education}
              onChange={(education) => setProfile((prev) => ({ ...prev, education }))}
            />

            {/* 4. Work Experience */}
            <ExperienceSection
              experience={profile.experience}
              onChange={(experience) => setProfile((prev) => ({ ...prev, experience }))}
            />

            {/* 5. Projects */}
            <ProjectsSection
              projects={profile.projects}
              githubUrl={profile.contact_info?.github}
              onChange={(projects) => setProfile((prev) => ({ ...prev, projects }))}
            />

            {/* 6. Technical Skills */}
            <SkillsSection
              skills={profile.skills}
              onChange={(skills) => setProfile((prev) => ({ ...prev, skills }))}
            />

            {/* 7. Certifications */}
            <CertificationsSection
              certifications={profile.certifications}
              onChange={(certifications) => setProfile((prev) => ({ ...prev, certifications }))}
            />

            {/* 8. Achievements */}
            <AchievementsSection
              achievements={profile.achievements}
              onChange={(achievements) => setProfile((prev) => ({ ...prev, achievements }))}
            />

            {/* Mode: ONBOARDING Navigation Action Buttons */}
            {mode === 'onboarding' && (
              <div className="flex items-center justify-between pt-6 border-t border-white/10">
                {onBack ? (
                  <button
                    type="button"
                    onClick={onBack}
                    className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                ) : <div />}

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>Save Profile & Next: Job Preferences</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sticky Bottom Save Bar (Appears when isDirty === true) */}
      {isDirty && !viewJson && (
        <div className="fixed bottom-6 left-0 right-0 z-40 px-4 pointer-events-none">
          <div className="max-w-xl mx-auto p-4 rounded-2xl bg-slate-900/95 border border-indigo-500/40 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-4 pointer-events-auto animate-in slide-in-from-bottom-5 duration-300">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
              <div>
                <p className="text-xs sm:text-sm font-bold text-white">Unsaved changes</p>
                <p className="text-[11px] text-slate-400">Remember to save before navigating away</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDiscardChanges}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Save</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
