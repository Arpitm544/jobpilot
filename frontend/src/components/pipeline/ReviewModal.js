'use client';

import React, { useState } from 'react';
import { api } from '@/lib/api';
import {
  X,
  Camera,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  ShieldCheck,
  Send,
  Ban,
  Download,
  Eye,
  Sparkles,
  Play
} from 'lucide-react';

export default function ReviewModal({ isOpen, onClose, application, onStatusUpdate }) {
  const [runningDryRun, setRunningDryRun] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [appState, setAppState] = useState(application);

  React.useEffect(() => {
    if (application) {
      setAppState(application);
      setError('');
      setMsg('');
    }
  }, [application]);

  if (!isOpen || !application) return null;

  const app = appState || application || {};
  const appId = app.application_id || app.id;

  const handleDryRun = async () => {
    setRunningDryRun(true);
    setError('');
    setMsg('');
    try {
      const res = await api.post(`/apply/${appId}/dry-run`);
      setAppState({
        ...app,
        ...res.data,
        has_proof: true,
        status: 'review_ready',
      });
      setMsg('Dry-run completed! Form filled and high-res proof screenshot captured.');
      if (onStatusUpdate) onStatusUpdate('review_ready');
    } catch (err) {
      setError(err.response?.data?.detail || 'Dry-run execution failed.');
    } finally {
      setRunningDryRun(false);
    }
  };

  const handleApprove = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post(`/apply/${appId}/approve`);
      setAppState({ ...app, ...res.data, status: 'applied' });
      setMsg('Application approved! Marked as submitted in your pipeline.');
      if (onStatusUpdate) onStatusUpdate('applied');
      setTimeout(() => onClose(), 1200);
    } catch (err) {
      setError(err.response?.data?.detail || 'Approval failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    try {
      await api.post(`/apply/${appId}/reject`);
      if (onStatusUpdate) onStatusUpdate('rejected');
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  const screenshotUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/apply/${appId}/screenshot?t=${Date.now()}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md">
      <div className="glass-panel w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-white/10">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-start justify-between gap-4 bg-slate-950/70">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                Review & Apply Engine (Dry-Run Mode)
              </span>
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-semibold uppercase">
                {app.ats_type || 'Greenhouse / Lever'}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white mt-1">
              {app.title} <span className="text-slate-400 font-normal">at</span> {app.company_name}
            </h2>
            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
              <span>{app.location} ({app.workplace_type || 'Remote'})</span>
              <a
                href={app.apply_url}
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 hover:underline flex items-center gap-1"
              >
                <span>View Job Portal</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Alerts */}
        {msg && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{msg}</span>
          </div>
        )}
        {error && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Status banner */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 flex items-center justify-between flex-wrap gap-3">
            <div>
              <span className="text-[11px] text-slate-400 uppercase font-semibold block">Application Status</span>
              <span className="text-sm font-bold text-white uppercase tracking-wider">
                {app.status === 'review_ready' ? 'Review Ready (Dry-Run Proof Available)' : app.status}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDryRun}
                disabled={runningDryRun}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
              >
                {runningDryRun ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Filling Form in Headless Browser...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>{app.has_proof ? 'Re-run Dry-Run Fill' : 'Run Playwright Dry-Run'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Screenshot Proof Card */}
          <div className="glass-card p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-cyan-400" />
                Playwright Form-Filling Verification Proof
              </span>
              <span className="text-[10px] text-slate-500">
                {app.has_proof ? 'High-Res Full Page Proof' : 'No screenshot yet'}
              </span>
            </div>

            {app.has_proof ? (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden border border-white/10 bg-slate-950 max-h-[350px] overflow-y-auto shadow-inner group">
                  <img
                    src={screenshotUrl}
                    alt="Application Proof Screenshot"
                    className="w-full object-cover object-top"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
                {app.proof_text && (
                  <p className="text-xs text-slate-400 font-mono bg-slate-950 p-2.5 rounded-lg border border-white/5">
                    {app.proof_text}
                  </p>
                )}
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-950/60 rounded-xl border border-dashed border-white/10 space-y-2">
                <Camera className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">
                  Run a dry-run to test Playwright form filling and capture high-resolution proof before submitting.
                </p>
              </div>
            )}
          </div>

          {/* Tailored Resume & Letter Info */}
          {app.tailored_resume_id && (
            <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">1-Page ATS PDF Attached</span>
                  <span className="text-[10px] text-slate-400">Tailored exclusively to this JD</span>
                </div>
              </div>

              <a
                href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/tailor/${app.tailored_resume_id}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>View PDF</span>
              </a>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-950/80 border-t border-white/10 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleReject}
            className="px-4 py-2 rounded-xl bg-slate-900 border border-white/10 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 text-xs font-medium flex items-center gap-1.5 transition-all"
          >
            <Ban className="w-3.5 h-3.5" />
            <span>Skip / Reject</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-cyan-500 hover:from-emerald-500 hover:to-cyan-400 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/25 active:scale-95 transition-all"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Approve & Submit Application</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
