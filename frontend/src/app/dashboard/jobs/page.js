'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import { api } from '@/lib/api';
import {
  Sparkles, Search, ExternalLink, CheckCircle2, AlertCircle, Loader2,
  Briefcase, MapPin, ChevronDown, ChevronUp, FileText,
  Check, GraduationCap, Globe, RefreshCw, Send, Settings,
  Building2, Clock, Layers, Filter, ShieldCheck,
  Award, Star, Zap
} from 'lucide-react';
import TailorModal from '@/components/tailor/TailorModal';
import EligibilityBadge from '@/components/discovery/EligibilityBadge';
import EligibilityModal from '@/components/discovery/EligibilityModal';
import Link from 'next/link';

function formatJdSnippet(rawText) {
  if (!rawText) return 'No job description provided.';
  let text = String(rawText)
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&')
    .replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ')
    .replace(/\ufffd/g,"'");
  return text.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
}

export default function JobsPage() {
  const [prefs, setPrefs]                   = useState(null);
  const [matches, setMatches]               = useState([]);
  const [selected, setSelected]             = useState(new Set());
  const [pushing, setPushing]               = useState(false);
  const [loading, setLoading]               = useState(true);
  const [refreshing, setRefreshing]         = useState(false);
  const [expandedId, setExpandedId]         = useState(null);
  const [search, setSearch]                 = useState('');
  const [minScore, setMinScore]             = useState(0);
  const [msg, setMsg]                       = useState('');
  const [error, setError]                   = useState('');
  const [selectedTailorMatch, setSelectedTailorMatch]       = useState(null);
  const [selectedEligibilityJob, setSelectedEligibilityJob] = useState(null);
  const [eligibilityData, setEligibilityData]               = useState(null);

  // Discovery interactive filter states
  const [roleType, setRoleType]             = useState('all');       // 'all' | 'internship' | 'full_time' | 'part_time'
  const [workplaceMode, setWorkplaceMode]   = useState('all');       // 'all' | 'remote' | 'onsite' | 'hybrid'
  const [experienceLevel, setExperienceLevel] = useState('all');     // 'all' | 'fresher' | 'junior' | 'mid' | 'senior' | 'lead'
  const [selectedTargetRole, setSelectedTargetRole] = useState('all'); // 'all' | specific user target role

  // Load preferences once on mount
  useEffect(() => {
    api.get('/preferences')
      .then(r => setPrefs(r.data))
      .catch(() => {});
  }, []);

  // ── Fetch jobs with active role type, workplace & experience filters ─────
  const fetchJobs = useCallback(async (rType = roleType, wMode = workplaceMode, expLvl = experienceLevel) => {
    setLoading(true);
    setError('');
    try {
      const params = {
        sort: 'country_first',
        limit: 100,
        include_maybe: true,
        actively_hiring_only: true,
      };

      if (wMode && wMode !== 'all') {
        params.work_mode = wMode.toLowerCase();
      }

      if (rType && rType !== 'all') {
        params.employment_type = rType.toLowerCase();
        if (rType === 'internship') {
          params.include_fresher = true;
        }
      }

      if (expLvl && expLvl !== 'all') {
        params.experience_level = expLvl.toLowerCase();
      }

      const [jobsRes, matchesRes] = await Promise.allSettled([
        api.get('/jobs', { params }),
        api.get('/jobs/matches', { params: {} }),
      ]);

      const jobsList    = jobsRes.status    === 'fulfilled' && Array.isArray(jobsRes.value.data)    ? jobsRes.value.data    : [];
      const matchesList = matchesRes.status === 'fulfilled' && Array.isArray(matchesRes.value.data) ? matchesRes.value.data : [];

      const matchMap = new Map();
      matchesList.forEach(m => { if (m.job?.id) matchMap.set(m.job.id, m); });

      const combined = jobsList.map(j => {
        const m = matchMap.get(j.id);
        return {
          id:              m?.id || j.id,
          match_score:     m ? m.match_score : 75,
          matched_skills:  m?.matched_skills  || [],
          missing_skills:  m?.missing_skills  || [],
          match_rationale: m?.match_rationale || 'Ranked via candidate authorization and role matching pipeline.',
          status:          m?.status || 'discovered',
          job: j,
        };
      });

      setMatches(combined);
      setSelected(new Set(combined.map(m => m.id)));
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not load jobs. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, [roleType, workplaceMode, experienceLevel]);

  // Automatically fetch jobs on mount and when filter pills change
  useEffect(() => {
    fetchJobs(roleType, workplaceMode, experienceLevel);
  }, [roleType, workplaceMode, experienceLevel, fetchJobs]);

  // ── Background ATS crawl ──────────────────────────────────────────────────
  const triggerRefresh = async () => {
    setRefreshing(true);
    try {
      await api.post('/jobs/discover');
      await fetchJobs(roleType, workplaceMode, experienceLevel);
      setMsg('Jobs refreshed from live ATS feeds!');
      setTimeout(() => setMsg(''), 5000);
    } catch {
      // silently ignore — existing jobs remain visible
    } finally {
      setRefreshing(false);
    }
  };

  const handlePushToPipeline = async () => {
    const list = filteredMatches.filter(m => selected.has(m.id));
    if (!list.length) return;
    setPushing(true);
    setError('');
    try {
      const ids = list.map(m => m.id).filter(Boolean);
      if (ids.length) await api.post('/apply/queue-auto', { match_ids: ids, is_dry_run: true });
      setMsg(`Pushed ${list.length} jobs to your pipeline!`);
      setTimeout(() => setMsg(''), 6000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to push jobs.');
    } finally {
      setPushing(false);
    }
  };

  const handleOpenWhy = async (job) => {
    setSelectedEligibilityJob(job);
    setEligibilityData({ verdict: job.eligibility_verdict || 'unclear', confidence: 0.85, reasons: ['Loading...'], evidence: [] });
    try {
      const r = await api.get(`/jobs/${job.id}/eligibility`);
      setEligibilityData(r.data);
    } catch {}
  };

  const toggleSelect = id =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const filteredMatches = matches.filter(m => {
    const t = search.toLowerCase();
    const searchMatch = !t || m.job.title.toLowerCase().includes(t) || m.job.company_name.toLowerCase().includes(t);
    const scoreMatch = minScore === 0 || m.match_score >= minScore;
    
    let targetRoleMatch = true;
    if (selectedTargetRole && selectedTargetRole !== 'all') {
      const rLower = selectedTargetRole.toLowerCase();
      const titleLower = m.job.title.toLowerCase();
      if (rLower.includes('full-stack') || rLower.includes('full stack')) {
        targetRoleMatch = titleLower.includes('full stack') || titleLower.includes('fullstack') || titleLower.includes('full-stack');
      } else if (rLower.includes('frontend')) {
        targetRoleMatch = titleLower.includes('frontend') || titleLower.includes('front-end') || titleLower.includes('ui engineer');
      } else if (rLower.includes('backend')) {
        targetRoleMatch = titleLower.includes('backend') || titleLower.includes('back-end') || titleLower.includes('api');
      } else if (rLower.includes('ai agent') || rLower.includes('agentic')) {
        targetRoleMatch = titleLower.includes('ai agent') || titleLower.includes('agentic') || titleLower.includes('agent');
      } else if (rLower.includes('gen ai') || rLower.includes('generative')) {
        targetRoleMatch = titleLower.includes('gen ai') || titleLower.includes('generative') || titleLower.includes('ai engineer') || titleLower.includes('workers ai') || titleLower.includes('ai gateway') || titleLower.includes('llm');
      } else {
        const words = rLower.split(/[\s\-_/]+/).filter(w => w.length > 2 && w !== 'developer' && w !== 'engineer');
        targetRoleMatch = words.some(w => titleLower.includes(w)) || titleLower.includes(rLower);
      }
    }
    
    let expMatch = true;
    if (experienceLevel && experienceLevel !== 'all') {
      expMatch = m.job.experience_level === experienceLevel;
    }

    return searchMatch && scoreMatch && targetRoleMatch && expMatch;
  });

  const selectedCount = filteredMatches.filter(m => selected.has(m.id)).length;
  const topScore = matches.reduce((mx, m) => Math.max(mx, m.match_score), 0);

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-extrabold text-white">Discovered Jobs</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> India Authorized
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Directly listed and prioritized by your saved target roles • Showing {filteredMatches.length} matching jobs
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={triggerRefresh}
              disabled={refreshing}
              title="Crawl live ATS feeds for new jobs"
              className="px-3.5 py-2 rounded-xl bg-slate-900 border border-white/10 hover:border-white/20 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition-all"
            >
              {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <RefreshCw className="w-3.5 h-3.5"/>}
              {refreshing ? 'Crawling...' : 'Refresh from ATS'}
            </button>
            <button
              onClick={handlePushToPipeline}
              disabled={pushing || selectedCount === 0}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-bold text-sm flex items-center gap-2 shadow-xl shadow-indigo-600/30 disabled:opacity-50 transition-all active:scale-[0.98]"
            >
              {pushing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
              Push {selectedCount} to Pipeline
            </button>
          </div>
        </div>

        {/* Saved Target Roles Strip (Interactive 1-Click Filters) */}
        {prefs?.target_roles?.length > 0 && (
          <div className="glass-panel px-4 py-2.5 rounded-2xl mb-4 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-slate-400 font-medium">Prioritizing Target Roles:</span>
              <button
                type="button"
                onClick={() => setSelectedTargetRole('all')}
                className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-all ${
                  selectedTargetRole === 'all'
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                All Target Roles ({prefs.target_roles.length})
              </button>
              {prefs.target_roles.map(role => {
                const active = selectedTargetRole === role;
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setSelectedTargetRole(active ? 'all' : role)}
                    className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-all flex items-center gap-1.5 cursor-pointer ${
                      active
                        ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/40 border border-indigo-400'
                        : 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25'
                    }`}
                  >
                    <span>{role}</span>
                    {active && <span className="text-[9px] opacity-80">✕</span>}
                  </button>
                );
              })}
            </div>
            <Link href="/onboarding" className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold shrink-0 hover:underline">
              <Settings className="w-3.5 h-3.5" /> Edit in Onboarding
            </Link>
          </div>
        )}

        {/* Feedback banners */}
        {msg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0"/>{msg}
            {msg.includes('pipeline') && <Link href="/pipeline" className="ml-auto text-emerald-300 underline font-semibold whitespace-nowrap">Go to Pipeline →</Link>}
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0"/>{error}
          </div>
        )}

        {/* Interactive Role Type & Workplace Filters */}
        <div className="glass-panel p-4 rounded-2xl mb-5 space-y-3.5">
          {/* 1. Role Type Pills */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 w-24 shrink-0 flex items-center gap-1.5">
              <Filter className="w-3 h-3 text-indigo-400" /> Role Type:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'all', label: 'All Roles', icon: Sparkles },
                { id: 'internship', label: 'Internships', icon: GraduationCap },
                { id: 'full_time', label: 'Full-Time', icon: Briefcase },
                { id: 'part_time', label: 'Part-Time', icon: Clock },
              ].map(tab => {
                const Icon = tab.icon;
                const active = roleType === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setRoleType(tab.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      active
                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/25 border border-indigo-400/40'
                        : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-white/10 hover:border-white/20'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-slate-400'}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Workplace Mode Pills */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2.5 border-t border-white/5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 w-24 shrink-0 flex items-center gap-1.5">
              <Globe className="w-3 h-3 text-cyan-400" /> Workplace:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'all', label: 'All Modes', icon: Sparkles },
                { id: 'remote', label: 'Remote', icon: Globe },
                { id: 'onsite', label: 'On-site', icon: Building2 },
                { id: 'hybrid', label: 'Hybrid / Off-site', icon: Layers },
              ].map(tab => {
                const Icon = tab.icon;
                const active = workplaceMode === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setWorkplaceMode(tab.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      active
                        ? 'bg-gradient-to-r from-cyan-600 to-cyan-500 text-white shadow-md shadow-cyan-500/25 border border-cyan-400/40'
                        : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-white/10 hover:border-white/20'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-slate-400'}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Experience / Seniority Level Pills */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2.5 border-t border-white/5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 w-24 shrink-0 flex items-center gap-1.5">
              <Award className="w-3 h-3 text-purple-400" /> Experience:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'all', label: 'All Levels', icon: Sparkles },
                { id: 'fresher', label: 'Freshers / Entry', icon: GraduationCap },
                { id: 'junior', label: 'Junior (1-3 yrs)', icon: Zap },
                { id: 'mid', label: 'Mid-Level (3-5 yrs)', icon: Briefcase },
                { id: 'senior', label: 'Senior (5+ yrs)', icon: Star },
                { id: 'lead', label: 'Lead / Staff', icon: ShieldCheck },
              ].map(tab => {
                const Icon = tab.icon;
                const active = experienceLevel === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setExperienceLevel(tab.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      active
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/25 border border-purple-400/40'
                        : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-white/10 hover:border-white/20'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-slate-400'}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label:'Total Authorized', value: matches.length, color:'text-white' },
            { label:'Selected',         value: selectedCount, color:'text-indigo-400' },
            { label:'Top Match Score',  value: `${Math.round(topScore)}%`, color:'text-emerald-400' },
            { label:'Country Eligible', value: 'India (IN)', color:'text-cyan-400' },
          ].map(s => (
            <div key={s.label} className="glass-panel p-3 rounded-xl">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">{s.label}</div>
              <div className={`text-lg font-black mt-0.5 ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Search & Score Filter Bar */}
        <div className="glass-panel p-3 rounded-2xl mb-5 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5"/>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search title, tech stack, or company name..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-slate-400">Min Score:</span>
            <input
              type="range"
              min="0"
              max="90"
              step="5"
              value={minScore}
              onChange={e => setMinScore(+e.target.value)}
              className="w-20 accent-indigo-500"
            />
            <span className="text-xs font-bold text-indigo-400 w-8">{minScore}%</span>
          </div>
          <button
            onClick={() => selected.size === filteredMatches.length ? setSelected(new Set()) : setSelected(new Set(filteredMatches.map(m=>m.id)))}
            className="shrink-0 px-3 py-2 rounded-xl bg-slate-800 border border-white/10 hover:border-white/20 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5"
          >
            <Check className="w-3 h-3"/>
            {selected.size === filteredMatches.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        {/* Loading Indicator */}
        {loading && (
          <div className="glass-panel p-10 rounded-2xl text-center mb-4">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-2" />
            <p className="text-slate-300 text-sm font-semibold">Loading Authorized Jobs...</p>
            <p className="text-slate-500 text-xs mt-1">Filtering by role type, workplace, and Indian work authorization.</p>
          </div>
        )}

        {/* Jobs List */}
        {!loading && filteredMatches.length === 0 ? (
          <div className="glass-panel p-12 rounded-2xl text-center">
            <Briefcase className="w-12 h-12 text-slate-600 mx-auto mb-3"/>
            <p className="text-slate-400 text-sm">No jobs match your selected filters.</p>
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                onClick={() => { setRoleType('all'); setWorkplaceMode('all'); setExperienceLevel('all'); setSearch(''); }}
                className="px-4 py-2 rounded-xl bg-slate-800 border border-white/10 hover:border-white/20 text-white text-xs font-semibold"
              >
                Reset Filters
              </button>
              <button
                onClick={triggerRefresh}
                disabled={refreshing}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2"
              >
                {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <RefreshCw className="w-3.5 h-3.5"/>}
                Refresh from Live ATS
              </button>
            </div>
          </div>
        ) : !loading && (
          <div className="space-y-3">
            {filteredMatches.map(m => {
              const isSel = selected.has(m.id);
              const isExp = expandedId === m.id;
              const score = Math.round(m.match_score);
              const sc = score>=80 ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                       : score>=70 ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                       : 'border-amber-500 text-amber-400 bg-amber-500/10';
              return (
                <div
                  key={m.id}
                  className={`rounded-2xl border p-4 transition-all shadow-md ${
                    isSel ? 'border-indigo-500/40 bg-indigo-950/10' : 'border-white/10 glass-panel opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleSelect(m.id)}
                      className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                        isSel ? 'bg-indigo-600 border-indigo-500' : 'border-slate-600 hover:border-indigo-500 bg-transparent'
                      }`}
                    >
                      {isSel && <Check className="w-3 h-3 text-white"/>}
                    </button>

                    {/* Score badge */}
                    <div className={`h-12 w-12 shrink-0 rounded-xl border flex flex-col items-center justify-center font-black ${sc}`}>
                      <span className="text-sm leading-none">{score}</span>
                      <span className="text-[8px] font-semibold uppercase mt-0.5">%Fit</span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-bold text-indigo-400">{m.job.company_name}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 font-mono uppercase">{m.job.ats_type}</span>
                        {m.job.work_mode && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-300 uppercase font-semibold">
                            {m.job.work_mode}
                          </span>
                        )}
                        {m.job.employment_type === 'internship' && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold">
                            Internship
                          </span>
                        )}
                        {m.job.experience_level && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-semibold ${
                            m.job.experience_level === 'fresher' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' :
                            m.job.experience_level === 'junior'  ? 'bg-blue-500/15 border-blue-500/30 text-blue-300' :
                            m.job.experience_level === 'mid'     ? 'bg-purple-500/15 border-purple-500/30 text-purple-300' :
                            m.job.experience_level === 'senior'  ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' :
                            'bg-rose-500/15 border-rose-500/30 text-rose-300'
                          }`}>
                            {m.job.experience_level === 'fresher' ? 'Fresher / Entry' :
                             m.job.experience_level === 'junior' ? 'Junior (1-3y)' :
                             m.job.experience_level === 'mid' ? 'Mid-Level (3-5y)' :
                             m.job.experience_level === 'senior' ? 'Senior (5+y)' :
                             'Lead / Staff'}
                          </span>
                        )}
                        {m.job.is_actively_hiring && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block"/>Hiring
                          </span>
                        )}
                        <EligibilityBadge verdict={m.job.eligibility_verdict || 'eligible'} onClick={() => handleOpenWhy(m.job)}/>
                      </div>

                      <a
                        href={m.job.apply_url}
                        target="_blank"
                        rel="noreferrer"
                        className="group/t inline-flex items-center gap-1.5 mb-1"
                        onClick={e => e.stopPropagation()}
                      >
                        <h3 className="text-sm font-bold text-white group-hover/t:text-cyan-400 transition-colors truncate max-w-sm">
                          {m.job.title}
                        </h3>
                        <ExternalLink className="w-3 h-3 text-slate-500 group-hover/t:text-cyan-400 shrink-0"/>
                      </a>

                      <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500"/>
                          {m.job.location || 'Remote / Worldwide'}
                        </span>
                        {m.job.stipend_min && (
                          <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                            {m.job.stipend_currency || 'INR'} {Number(m.job.stipend_min).toLocaleString()}/mo
                          </span>
                        )}
                        {!m.job.stipend_min && m.job.salary_range && (
                          <span className="text-emerald-400">{m.job.salary_range}</span>
                        )}
                        {m.job.days_since_posted !== undefined && (
                          <span className="text-slate-500">
                            {m.job.days_since_posted === 0 ? 'Posted Today' : `${m.job.days_since_posted}d ago`}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setExpandedId(isExp ? null : m.id)}
                        className="p-2 rounded-xl bg-slate-900 border border-white/10 hover:border-white/20 text-slate-400 hover:text-white transition-all"
                      >
                        {isExp ? <ChevronUp className="w-3.5 h-3.5"/> : <ChevronDown className="w-3.5 h-3.5"/>}
                      </button>
                      <a
                        href={m.job.apply_url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-xl bg-slate-900 border border-white/10 hover:border-cyan-500/40 text-slate-400 hover:text-cyan-400 transition-all"
                        onClick={e => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3.5 h-3.5"/>
                      </a>
                    </div>
                  </div>

                  {/* Expanded */}
                  {isExp && (
                    <div className="mt-4 pt-4 border-t border-white/10 space-y-3 ml-20">
                      {m.match_rationale && (
                        <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5 text-xs text-slate-300 leading-relaxed">
                          <span className="font-semibold text-cyan-400 mr-1.5">AI Analysis:</span>
                          {m.match_rationale}
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-slate-900/50 border border-emerald-500/10">
                          <div className="text-[10px] font-bold uppercase text-emerald-400 mb-1.5">
                            Matched Skills ({m.matched_skills?.length || 0})
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {(m.matched_skills || []).map(s => (
                              <span key={s} className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px]">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-900/50 border border-amber-500/10">
                          <div className="text-[10px] font-bold uppercase text-amber-400 mb-1.5">
                            Missing Skills ({m.missing_skills?.length || 0})
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {(m.missing_skills || []).length > 0 ? (
                              m.missing_skills.map(s => (
                                <span key={s} className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px]">
                                  {s}
                                </span>
                              ))
                            ) : (
                              <span className="text-[11px] text-slate-500">None! All skills matched.</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {m.job.jd_text && (
                        <div className="p-3 rounded-xl bg-slate-950/40 border border-white/5 text-xs text-slate-300 leading-relaxed">
                          <div className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                            <FileText className="w-3 h-3"/>Job Description
                          </div>
                          <p className="line-clamp-3">{formatJdSnippet(m.job.jd_text)}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Sticky Push Bar */}
        {selectedCount > 0 && (
          <div className="sticky bottom-6 mt-6">
            <div className="max-w-lg mx-auto glass-panel border border-indigo-500/30 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-2xl">
              <div>
                <div className="text-sm font-bold text-white">{selectedCount} job{selectedCount !== 1 ? 's' : ''} selected</div>
                <div className="text-[11px] text-slate-400">Will be queued for AI resume tailoring & automation</div>
              </div>
              <button
                onClick={handlePushToPipeline}
                disabled={pushing}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-indigo-600/30 disabled:opacity-50 transition-all shrink-0"
              >
                {pushing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
                Push to Pipeline
              </button>
            </div>
          </div>
        )}

        <TailorModal
          isOpen={!!selectedTailorMatch}
          jobMatch={selectedTailorMatch}
          onClose={() => setSelectedTailorMatch(null)}
          onTailorComplete={() => {}}
        />
        {selectedEligibilityJob && (
          <EligibilityModal
            job={selectedEligibilityJob}
            eligibilityData={eligibilityData}
            onClose={() => setSelectedEligibilityJob(null)}
            onOverrideSuccess={u => setEligibilityData(u)}
          />
        )}
      </main>
    </div>
  );
}
