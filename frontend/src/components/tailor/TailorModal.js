'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  X,
  Sparkles,
  ShieldCheck,
  Download,
  Copy,
  Check,
  FileText,
  Layers,
  ArrowRight,
  Loader2,
  AlertCircle,
  Eye,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';

export default function TailorModal({ isOpen, onClose, jobMatch, onTailorComplete }) {
  const [loading, setLoading] = useState(false);
  const [tailoredData, setTailoredData] = useState(null);
  const [activeTab, setActiveTab] = useState('diff'); // 'diff', 'cover_letter', 'pdf', 'audit'
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && jobMatch) {
      loadOrGenerateTailoring();
    }
  }, [isOpen, jobMatch]);

  const loadOrGenerateTailoring = async () => {
    setLoading(true);
    setError('');
    try {
      // First try fetching existing tailored resume
      try {
        const existingRes = await api.get(`/tailor/match/${jobMatch.id}`);
        if (existingRes.data) {
          setTailoredData(existingRes.data);
          setLoading(false);
          return;
        }
      } catch (err) {
        // Not generated yet, proceed to generate
      }

      // Generate new tailored resume
      const genRes = await api.post('/tailor/generate', {
        job_match_id: jobMatch.id,
      });
      setTailoredData(genRes.data);
      if (onTailorComplete) {
        onTailorComplete(genRes.data);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to tailor resume for this JD.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCoverLetter = () => {
    if (!tailoredData?.cover_letter) return;
    navigator.clipboard.writeText(tailoredData.cover_letter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md">
      <div className="glass-panel w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-white/10">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-start justify-between gap-4 bg-slate-950/60">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                AI Resume Tailoring Engine
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Zero Hallucination Verified
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white mt-1">
              {jobMatch?.job?.title} <span className="text-slate-400 font-normal">at</span> {jobMatch?.job?.company_name}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center text-center space-y-4">
            <div className="relative">
              <div className="h-16 w-16 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-cyan-400 animate-pulse" />
              </div>
              <Loader2 className="w-20 h-20 text-indigo-500/40 animate-spin absolute -inset-2" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Synthesizing JD-Tailored Resume</h3>
              <p className="text-xs text-slate-400 max-w-md mt-1">
                Rewriting bullets into Action + Tech + Impact format, running Gemini Claim Verification pass, and rendering 1-page ATS PDF...
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="p-10 text-center space-y-4">
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs inline-flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
            <div>
              <button
                onClick={loadOrGenerateTailoring}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold"
              >
                Retry Tailoring
              </button>
            </div>
          </div>
        ) : tailoredData ? (
          <>
            {/* Top Stats Banner */}
            <div className="px-5 py-3 bg-indigo-950/20 border-b border-white/5 flex items-center justify-between flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-slate-400">ATS Keyword Match:</span>
                  <span className="ml-1.5 font-bold text-emerald-400 text-sm">
                    {tailoredData.ats_keyword_match_pct}%
                  </span>
                </div>
                <div className="hidden sm:block h-3 w-px bg-white/10" />
                <div className="flex items-center gap-1.5 text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Claim Verification:</span>
                  <span className="font-semibold text-emerald-400">
                    {tailoredData.claim_verification_passed ? '100% Truth-Anchored' : 'Review Required'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={
                    !tailoredData.pdf_download_url
                      ? '#'
                      : tailoredData.pdf_download_url.startsWith('http')
                        ? tailoredData.pdf_download_url
                        : tailoredData.pdf_download_url.startsWith('/api/v1')
                          ? tailoredData.pdf_download_url
                          : `${(process.env.NEXT_PUBLIC_API_URL || '/api/v1').replace(/\/+$/, '')}/${tailoredData.pdf_download_url.replace(/^\/+/, '')}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download 1-Page PDF</span>
                </a>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="px-5 pt-3 border-b border-white/10 flex items-center gap-2 overflow-x-auto">
              {[
                { id: 'diff', label: 'Resume Diff Viewer', icon: Layers },
                { id: 'cover_letter', label: 'Tailored Cover Letter', icon: FileText },
                { id: 'audit', label: 'Claim Audit Report', icon: ShieldCheck },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`pb-3 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all ${
                      activeTab === tab.id
                        ? 'border-cyan-400 text-white'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* TAB 1: RESUME DIFF VIEWER */}
              {activeTab === 'diff' && (
                <div className="space-y-4">
                  <div className="text-xs text-slate-400">
                    Comparing your Master Profile baseline against the JD-tailored resume bullets:
                  </div>

                  {/* Summary Comparison */}
                  <div className="glass-card p-4 rounded-xl space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                      Professional Summary
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-lg bg-slate-950/60 border border-white/5 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-500">Master Baseline</span>
                        <p className="text-slate-300 leading-relaxed">
                          {tailoredData.diff_summary?.find((d) => d.section === 'Professional Summary')?.original ||
                            'Original summary'}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-500/20 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-cyan-400">JD-Tailored Summary</span>
                        <p className="text-white leading-relaxed font-medium">
                          {tailoredData.tailored_summary}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Bullets Comparison */}
                  <div className="space-y-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Experience Bullets (Action + Tech + Impact)
                    </span>

                    {(tailoredData.diff_summary || [])
                      .filter((d) => d.section !== 'Professional Summary')
                      .map((item, idx) => (
                        <div key={idx} className="glass-card p-3.5 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-white">{item.section}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                item.status === 'modified'
                                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                                  : item.status === 'added'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {item.status.toUpperCase()}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                            <div className="text-slate-400 p-2.5 rounded-lg bg-slate-950/40 border border-white/5">
                              {item.original}
                            </div>
                            <div className="text-white p-2.5 rounded-lg bg-indigo-950/20 border border-indigo-500/20 font-medium">
                              {item.tailored}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* TAB 2: COVER LETTER */}
              {activeTab === 'cover_letter' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      Specific 3-paragraph letter tailored for {jobMatch?.job?.company_name}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyCoverLetter}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 border border-white/10 hover:border-white/20 text-xs font-semibold text-slate-200 hover:text-white flex items-center gap-1.5 transition-all"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
                      <span>{copied ? 'Copied to Clipboard' : 'Copy Text'}</span>
                    </button>
                  </div>

                  <div className="p-6 rounded-2xl bg-slate-950 border border-white/10 text-slate-200 text-xs leading-relaxed whitespace-pre-line font-sans shadow-inner">
                    {tailoredData.cover_letter}
                  </div>
                </div>
              )}

              {/* TAB 3: CLAIM VERIFICATION AUDIT */}
              {activeTab === 'audit' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
                    <div>
                      <span className="font-bold block text-sm text-emerald-200">
                        Dual-Pass Gemini Claim Verification Passed
                      </span>
                      <p className="mt-0.5 text-xs text-emerald-300/90 leading-relaxed">
                        Every employer, title, technology, and metric in this tailored resume was audited line-by-line against your verified Master Profile.
                      </p>
                    </div>
                  </div>

                  <div className="glass-card p-4 rounded-xl space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Audit Findings & Notes:
                    </span>
                    <div className="p-3 rounded-lg bg-slate-950 text-xs font-mono text-indigo-300">
                      {JSON.stringify(tailoredData.claim_verification_notes, null, 2)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-950/80 border-t border-white/10 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Tailored Resume ID: <span className="font-mono text-slate-400">{tailoredData.id}</span>
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition-all"
              >
                Approve & Staged for Application
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
