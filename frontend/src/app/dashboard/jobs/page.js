'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/authContext';
import { api } from '@/lib/api';
import {
  Sparkles,
  Search,
  Filter,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Plus,
  Briefcase,
  Building2,
  MapPin,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  X,
  Send,
  Zap,
  Check,
  Ban
} from 'lucide-react';

export default function JobsPage() {
  const { user } = useAuth();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [minScore, setMinScore] = useState(60);
  const [expandedJobId, setExpandedJobId] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  // Modal State for Manual Job Addition
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualForm, setManualForm] = useState({
    company_name: '',
    title: '',
    location: 'Remote',
    workplace_type: 'Remote',
    job_type: 'Full-time',
    salary_range: '',
    jd_text: '',
    apply_url: '',
  });

  useEffect(() => {
    fetchMatches();
  }, [statusFilter, minScore]);

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== 'all') params.match_status = statusFilter;
      if (minScore > 0) params.min_score = minScore;
      if (search.trim()) params.search = search.trim();

      const res = await api.get('/jobs/matches', { params });
      setMatches(res.data);
    } catch (err) {
      console.error('Failed to load job matches:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerDiscovery = async () => {
    setDiscovering(true);
    setError('');
    setMsg('');
    try {
      const res = await api.post('/jobs/discover');
      setMsg(`Discovery complete! Processed ${res.data.length} matching jobs from public ATS feeds.`);
      fetchMatches();
      setTimeout(() => setMsg(''), 4000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Discovery failed. Please verify your Master Profile is set.');
    } finally {
      setDiscovering(false);
    }
  };

  const handleAction = async (jobId, action) => {
    try {
      await api.post(`/jobs/${jobId}/action`, { action });
      setMatches((prev) =>
        prev.map((m) => {
          if (m.job.id === jobId) {
            return {
              ...m,
              status: action === 'queue' ? 'queued' : action === 'dismiss' ? 'dismissed' : 'discovered',
            };
          }
          return m;
        })
      );
    } catch (err) {
      console.error('Failed to update action:', err);
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setManualLoading(true);
    setError('');
    try {
      const res = await api.post('/jobs/manual-add', manualForm);
      setMsg(`Job '${res.data.job.title}' scored and added to pipeline! (Match: ${res.data.match_score}%)`);
      setShowManualModal(false);
      setManualForm({
        company_name: '',
        title: '',
        location: 'Remote',
        workplace_type: 'Remote',
        job_type: 'Full-time',
        salary_range: '',
        jd_text: '',
        apply_url: '',
      });
      fetchMatches();
      setTimeout(() => setMsg(''), 4000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to ingest job.');
    } finally {
      setManualLoading(false);
    }
  };

  // Metrics
  const totalMatches = matches.length;
  const queuedMatches = matches.filter((m) => m.status === 'queued').length;
  const topScore = matches.reduce((max, m) => Math.max(max, m.match_score), 0);
  const avgScore = totalMatches > 0 ? (matches.reduce((sum, m) => sum + m.match_score, 0) / totalMatches).toFixed(1) : 0;

  const filteredMatches = matches.filter((m) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      m.job.title.toLowerCase().includes(term) ||
      m.job.company_name.toLowerCase().includes(term) ||
      m.job.location.toLowerCase().includes(term)
    );
  });

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-white/10 gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                Phase 2 Engine
              </span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-semibold">
                Multi-ATS Feed Ingestion
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
              Discovered Job Matches & Scoring
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Real-time postings from Greenhouse, Lever, Ashby, and custom JDs scored against your Master Profile.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowManualModal(true)}
              className="px-4 py-2.5 rounded-xl bg-slate-900 border border-white/10 hover:border-white/20 text-xs font-semibold text-slate-200 hover:text-white flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4 text-cyan-400" />
              <span>Paste Custom JD</span>
            </button>
            <button
              type="button"
              onClick={handleTriggerDiscovery}
              disabled={discovering}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/25 active:scale-95 transition-all disabled:opacity-50"
            >
              {discovering ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Crawling ATS Feeds...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>Discover Live Jobs</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Global Feedback */}
        {msg && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{msg}</span>
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Top Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="glass-panel p-4 rounded-2xl">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Scored</span>
            <div className="text-2xl font-black text-white mt-1">{totalMatches}</div>
            <span className="text-[10px] text-slate-500">Matching criteria</span>
          </div>
          <div className="glass-panel p-4 rounded-2xl border-indigo-500/20">
            <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">Queued for Tailor</span>
            <div className="text-2xl font-black text-indigo-300 mt-1">{queuedMatches}</div>
            <span className="text-[10px] text-slate-500">Ready for 1-click apply</span>
          </div>
          <div className="glass-panel p-4 rounded-2xl border-emerald-500/20">
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Top Match Score</span>
            <div className="text-2xl font-black text-emerald-300 mt-1">{topScore}%</div>
            <span className="text-[10px] text-slate-500">Highest compatibility</span>
          </div>
          <div className="glass-panel p-4 rounded-2xl">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Avg Match Fit</span>
            <div className="text-2xl font-black text-cyan-300 mt-1">{avgScore}%</div>
            <span className="text-[10px] text-slate-500">Embedding + skills</span>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="glass-panel p-4 rounded-2xl mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            {[
              { id: 'all', label: 'All Jobs' },
              { id: 'queued', label: 'Queued' },
              { id: 'discovered', label: 'Discovered' },
              { id: 'dismissed', label: 'Dismissed' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  statusFilter === tab.id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-slate-900/60 text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search & Min Score */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title, company..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="hidden sm:flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-white/10">
              <span className="text-[11px] text-slate-400 whitespace-nowrap">Min Score:</span>
              <input
                type="range"
                min="0"
                max="90"
                step="5"
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="w-20 accent-indigo-500 cursor-pointer"
              />
              <span className="text-xs font-bold text-indigo-400 w-8 text-right">{minScore}%</span>
            </div>
          </div>
        </div>

        {/* Matches Feed */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
            <p className="text-xs text-slate-400 mt-2">Loading scored jobs...</p>
          </div>
        ) : filteredMatches.length === 0 ? (
          <div className="glass-panel p-12 rounded-2xl text-center">
            <Briefcase className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white mb-1">No Jobs Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mb-6">
              Try adjusting your filter threshold or click &quot;Discover Live Jobs&quot; to crawl public ATS boards.
            </p>
            <button
              onClick={handleTriggerDiscovery}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Fetch Public ATS Feeds</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredMatches.map((m) => {
              const isExpanded = expandedJobId === m.id;
              const score = Math.round(m.match_score);
              const scoreColor =
                score >= 80
                  ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                  : score >= 70
                  ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                  : 'border-amber-500 text-amber-400 bg-amber-500/10';

              return (
                <div
                  key={m.id}
                  className="glass-panel rounded-2xl p-5 border border-white/10 hover:border-indigo-500/30 transition-all shadow-md"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Job Meta */}
                    <div className="flex items-start gap-4">
                      {/* Match Score Badge */}
                      <div
                        className={`h-14 w-14 shrink-0 rounded-2xl border flex flex-col items-center justify-center font-black ${scoreColor}`}
                      >
                        <span className="text-base leading-none">{score}</span>
                        <span className="text-[9px] font-semibold uppercase tracking-wider mt-0.5">% Fit</span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-indigo-400">{m.job.company_name}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400 uppercase font-mono">
                            {m.job.ats_type}
                          </span>
                          {m.status === 'queued' && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              Queued for Tailor
                            </span>
                          )}
                          {m.status === 'dismissed' && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-medium">
                              Dismissed
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-bold text-white hover:text-cyan-400 transition-colors">
                          {m.job.title}
                        </h3>

                        <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-500" />
                            {m.job.location} ({m.job.workplace_type})
                          </span>
                          {m.job.salary_range && (
                            <span className="text-emerald-400 font-medium">{m.job.salary_range}</span>
                          )}
                          <span className="text-slate-500">{m.job.job_type}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-3 shrink-0 self-end lg:self-center">
                      <button
                        type="button"
                        onClick={() => setExpandedJobId(isExpanded ? null : m.id)}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1 transition-all"
                      >
                        <Zap className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Why This Score</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {m.status !== 'queued' && (
                        <button
                          type="button"
                          onClick={() => handleAction(m.job.id, 'queue')}
                          className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all"
                        >
                          Queue
                        </button>
                      )}

                      {m.status !== 'dismissed' ? (
                        <button
                          type="button"
                          onClick={() => handleAction(m.job.id, 'dismiss')}
                          className="p-2 rounded-xl bg-slate-900 border border-white/10 text-slate-500 hover:text-rose-400 transition-all"
                          title="Dismiss Job"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAction(m.job.id, 'restore')}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 text-xs text-slate-300 hover:text-white"
                        >
                          Restore
                        </button>
                      )}

                      <a
                        href={m.job.apply_url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-xl bg-slate-900 border border-white/10 text-slate-400 hover:text-cyan-400 transition-all"
                        title="Open Apply URL"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>

                  {/* Expanded Breakdown: Why This Score */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                      {/* Rationale Quote */}
                      {m.match_rationale && (
                        <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5 text-xs text-slate-300 leading-relaxed font-sans">
                          <span className="font-semibold text-cyan-400 mr-1.5">AI Analysis:</span>
                          {m.match_rationale}
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Matched skills */}
                        <div className="p-3 rounded-xl bg-slate-900/50 border border-emerald-500/10 space-y-1.5">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                            Matched Skills ({m.matched_skills?.length || 0})
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {(m.matched_skills || []).map((skill) => (
                              <span
                                key={skill}
                                className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Missing skills */}
                        <div className="p-3 rounded-xl bg-slate-900/50 border border-amber-500/10 space-y-1.5">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                            Missing Skills ({m.missing_skills?.length || 0})
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {(m.missing_skills || []).length > 0 ? (
                              m.missing_skills.map((skill) => (
                                <span
                                  key={skill}
                                  className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-medium"
                                >
                                  {skill}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-slate-500">None! You possess all required skills.</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* JD Snippet Preview */}
                      <div className="pt-2">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                          Job Description Snippet:
                        </span>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-3 leading-relaxed">
                          {m.job.jd_text}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Modal: Paste Custom Job Description */}
        {showManualModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="glass-panel w-full max-w-2xl p-6 rounded-2xl shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-cyan-400" />
                  Add Custom Job / JD to Pipeline
                </h3>
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300">Company Name *</label>
                    <input
                      type="text"
                      required
                      value={manualForm.company_name}
                      onChange={(e) => setManualForm({ ...manualForm, company_name: e.target.value })}
                      placeholder="e.g. OpenAI"
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300">Job Title *</label>
                    <input
                      type="text"
                      required
                      value={manualForm.title}
                      onChange={(e) => setManualForm({ ...manualForm, title: e.target.value })}
                      placeholder="e.g. Full Stack Engineer"
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300">Location</label>
                    <input
                      type="text"
                      value={manualForm.location}
                      onChange={(e) => setManualForm({ ...manualForm, location: e.target.value })}
                      placeholder="Remote / San Francisco"
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300">Workplace Type</label>
                    <select
                      value={manualForm.workplace_type}
                      onChange={(e) => setManualForm({ ...manualForm, workplace_type: e.target.value })}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs"
                    >
                      <option value="Remote">Remote</option>
                      <option value="Hybrid">Hybrid</option>
                      <option value="Onsite">Onsite</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300">Salary Range</label>
                    <input
                      type="text"
                      value={manualForm.salary_range}
                      onChange={(e) => setManualForm({ ...manualForm, salary_range: e.target.value })}
                      placeholder="$120k - $160k"
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300">Apply URL *</label>
                  <input
                    type="url"
                    required
                    value={manualForm.apply_url}
                    onChange={(e) => setManualForm({ ...manualForm, apply_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300">
                    Full Job Description (Paste Text) *
                  </label>
                  <textarea
                    rows={6}
                    required
                    value={manualForm.jd_text}
                    onChange={(e) => setManualForm({ ...manualForm, jd_text: e.target.value })}
                    placeholder="Paste JD requirements, tech stack, and responsibilities..."
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs font-mono leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowManualModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={manualLoading}
                    className="px-6 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-600/25"
                  >
                    {manualLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    <span>Parse, Score & Ingest</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
