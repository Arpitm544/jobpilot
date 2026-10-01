'use client';

import React, { useState } from 'react';
import { FileText, Sparkles, Check, X, Loader2, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';

export default function SummarySection({
  summary = '',
  onChange,
  getFieldBadge,
}) {
  const [polishLoading, setPolishLoading] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const charCount = (summary || '').length;

  const handlePolish = async () => {
    if (!summary.trim()) {
      setErrorMsg('Please enter a summary first before requesting AI polish.');
      return;
    }
    setErrorMsg('');
    setPolishLoading(true);
    try {
      const res = await api.post('/profile/polish-summary', { summary: summary.trim() });
      if (res.data?.polished) {
        setSuggestion(res.data.polished);
      }
    } catch (err) {
      console.warn('AI polish failed:', err);
      setErrorMsg(err.response?.data?.detail || 'Could not polish summary. Please try again.');
    } finally {
      setPolishLoading(false);
    }
  };

  const handleAccept = () => {
    if (suggestion) {
      onChange(suggestion);
      setSuggestion(null);
    }
  };

  const handleReject = () => {
    setSuggestion(null);
  };

  return (
    <div id="section-summary" className="glass-panel p-6 sm:p-7 rounded-2xl space-y-4 border border-white/10 shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <FileText className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Professional Summary</h2>
            <p className="text-xs text-slate-400">High-signal engineering overview tailored for hiring managers</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {getFieldBadge && getFieldBadge('summary')}
          <button
            type="button"
            onClick={handlePolish}
            disabled={polishLoading || !summary.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600/30 to-purple-600/30 hover:from-indigo-600/50 hover:to-purple-600/50 border border-indigo-400/30 text-indigo-200 text-xs font-semibold shadow-sm transition-all disabled:opacity-40 cursor-pointer"
            title="Polish with Gemini AI (shows preview to accept/reject)"
          >
            {polishLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-300" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
            )}
            <span>{polishLoading ? 'Polishing...' : 'AI Polish'}</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg('')} className="text-rose-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Suggestion Box: Shown when AI generates a proposal */}
      {suggestion && (
        <div className="p-4 rounded-xl bg-gradient-to-b from-indigo-950/60 to-purple-950/40 border border-indigo-500/30 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold text-indigo-200 uppercase tracking-wider">AI Polish Suggestion</span>
            </div>
            <span className="text-[11px] text-slate-400">Review before applying</span>
          </div>

          <p className="text-sm text-white/95 leading-relaxed bg-black/30 p-3 rounded-lg border border-white/5 font-sans">
            {suggestion}
          </p>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleReject}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-white/10 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reject</span>
            </button>
            <button
              type="button"
              onClick={handleAccept}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Accept Suggestion</span>
            </button>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <textarea
          rows={4}
          value={summary || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Brief background summary of your career, engineering background, and technical focus (e.g. Full-Stack Engineer with 3+ years experience building distributed backend microservices and modern React applications)..."
          className="w-full px-3.5 py-3 rounded-xl bg-slate-900/90 border border-white/10 text-white text-[14px] sm:text-[15px] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 leading-relaxed transition-all placeholder:text-slate-500"
        />
        <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
          <span>Keep it concise (2-4 impactful sentences recommended).</span>
          <span className={charCount > 600 ? 'text-amber-400 font-semibold' : 'text-slate-400'}>
            {charCount} characters
          </span>
        </div>
      </div>
    </div>
  );
}
