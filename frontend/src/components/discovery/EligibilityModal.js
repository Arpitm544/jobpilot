'use client';

import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  Quote,
  CheckCircle2,
  FileText,
  Building2,
  UserCheck,
  Edit3,
  Loader2
} from 'lucide-react';
import { api } from '@/lib/api';
import { VERDICT_CONFIG } from './EligibilityBadge';

export default function EligibilityModal({
  job,
  eligibilityData,
  onClose,
  onOverrideSuccess
}) {
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overrideVerdict, setOverrideVerdict] = useState('eligible');
  const [overrideNotes, setOverrideNotes] = useState('');
  const [savingOverride, setSavingOverride] = useState(false);
  const [overrideError, setOverrideError] = useState('');

  if (!job || !eligibilityData) return null;

  const currentVerdict = eligibilityData.user_override?.verdict || eligibilityData.verdict || 'unclear';
  const cfg = VERDICT_CONFIG[currentVerdict] || VERDICT_CONFIG.unclear;
  const isOverridden = Boolean(eligibilityData.user_override);

  const handleSaveOverride = async (e) => {
    e.preventDefault();
    setSavingOverride(true);
    setOverrideError('');
    try {
      const res = await api.post(`/jobs/${job.id}/eligibility/override`, {
        verdict: overrideVerdict,
        notes: overrideNotes.trim() || 'Confirmed with recruiter'
      });
      if (onOverrideSuccess) {
        onOverrideSuccess(res.data);
      }
      setShowOverrideForm(false);
    } catch (err) {
      setOverrideError(err.response?.data?.detail || 'Failed to submit override.');
    } finally {
      setSavingOverride(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-panel w-full max-w-2xl max-h-[90vh] rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden bg-slate-900/95">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400">{job.company_name}</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${cfg.badgeClass}`}>
                  {cfg.label}
                </span>
                {isOverridden && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                    <UserCheck className="w-3 h-3" />
                    Candidate Overridden
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-white mt-0.5 line-clamp-1">{job.title}</h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Overridden Banner */}
          {isOverridden && (
            <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs flex items-start gap-3">
              <UserCheck className="w-4 h-4 shrink-0 mt-0.5 text-cyan-400" />
              <div>
                <span className="font-bold">Manual Recruiter Override Recorded:</span>
                <p className="mt-0.5 text-slate-300">{eligibilityData.user_override.notes}</p>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Overridden at {new Date(eligibilityData.user_override.overridden_at).toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* Reasons Section */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-400" />
              <span>Evaluation Reasons</span>
            </h3>
            <ul className="space-y-2">
              {(eligibilityData.reasons || []).map((reason, idx) => (
                <li key={idx} className="text-xs text-slate-200 bg-white/5 border border-white/5 rounded-xl p-3 flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Verbatim Supporting Evidence */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Quote className="w-4 h-4 text-indigo-400" />
              <span>Verbatim Evidence from Posting & Public Policy</span>
            </h3>

            {(eligibilityData.evidence || []).length === 0 ? (
              <p className="text-xs text-slate-400 italic bg-white/5 rounded-xl p-3">
                No direct geographic restrictions or policy quotes were extracted from this posting.
              </p>
            ) : (
              <div className="space-y-2.5">
                {eligibilityData.evidence.map((ev, i) => (
                  <div key={i} className="p-3.5 rounded-xl bg-slate-950/60 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="px-2 py-0.5 rounded-md bg-white/5 font-mono text-[10px] uppercase text-cyan-300">
                        {ev.signal_type || 'Source Signal'}
                      </span>
                      {ev.source_url && (
                        <a
                          href={ev.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-cyan-400 flex items-center gap-1 transition-colors"
                        >
                          <span>Source URL</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <blockquote className="text-xs italic text-slate-100 border-l-2 border-cyan-400 pl-3 py-0.5">
                      "{ev.quote}"
                    </blockquote>
                    <p className="text-[11px] text-slate-400">{ev.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Legal Disclaimer */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              {eligibilityData.disclaimer || 'This is a guide based on public information, confirm with the employer if unsure.'}
            </p>
          </div>

          {/* Override Form / Toggle */}
          <div className="pt-2 border-t border-white/10">
            {!showOverrideForm ? (
              <button
                type="button"
                onClick={() => setShowOverrideForm(true)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-xs font-semibold text-slate-200 hover:text-white flex items-center justify-center gap-2 transition-all"
              >
                <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Confirmed with recruiter? Override Verdict</span>
              </button>
            ) : (
              <form onSubmit={handleSaveOverride} className="p-4 rounded-xl bg-slate-950/80 border border-indigo-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-cyan-400" />
                    Candidate Override Entry
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowOverrideForm(false)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>

                {overrideError && (
                  <p className="text-xs text-rose-400">{overrideError}</p>
                )}

                <div>
                  <label className="text-[11px] font-medium text-slate-300">Set New Verdict</label>
                  <select
                    value={overrideVerdict}
                    onChange={(e) => setOverrideVerdict(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-xs text-white"
                  >
                    <option value="eligible">Eligible (Recruiter confirmed hiring in my country)</option>
                    <option value="likely_eligible">Likely Eligible</option>
                    <option value="unclear">Unclear</option>
                    <option value="not_eligible">Not Eligible</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-300">Notes / Audit Details</label>
                  <input
                    type="text"
                    placeholder="e.g. Recruiter Sarah confirmed hiring in India via Deel on LinkedIn"
                    value={overrideNotes}
                    onChange={(e) => setOverrideNotes(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-xs text-white placeholder:text-slate-500"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingOverride}
                  className="w-full py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {savingOverride ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Audit Log...</span>
                    </>
                  ) : (
                    <span>Confirm & Save Override</span>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
