'use client';

import React, { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, MapPin, ExternalLink, HelpCircle } from 'lucide-react';

export default function MaybeInternshipsSection({ jobs = [], onAction, onOpenWhy }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!jobs || jobs.length === 0) return null;

  return (
    <div className="glass-panel rounded-2xl border border-amber-500/20 bg-amber-500/5 overflow-hidden mb-6 transition-all">
      {/* Accordion Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-amber-500/10 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-300">
                Maybe Internships ({jobs.length})
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-semibold border border-amber-500/30">
                Borderline Classification
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Roles where internship was mentioned in the description but title was ambiguous.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-amber-400 font-semibold">
          <span>{isOpen ? 'Collapse' : 'Inspect'}</span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Accordion Content */}
      {isOpen && (
        <div className="p-4 pt-0 space-y-3 border-t border-amber-500/10">
          {jobs.map((j) => (
            <div
              key={j.id}
              className="p-3.5 rounded-xl bg-slate-900/90 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-indigo-400">{j.company_name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400 font-mono">
                    {j.ats_type}
                  </span>
                  {j.classification_confidence && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold">
                      {Math.round(j.classification_confidence * 100)}% Confidence
                    </span>
                  )}
                </div>
                <a
                  href={j.apply_url}
                  target="_blank"
                  rel="noreferrer"
                  className="group/title inline-flex items-center gap-1.5"
                  title="Open official job application posting in new tab"
                >
                  <h4 className="text-sm font-bold text-white group-hover/title:text-cyan-400 transition-colors">
                    {j.title}
                  </h4>
                  <ExternalLink className="w-3 h-3 text-slate-500 group-hover/title:text-cyan-400 opacity-60 group-hover/title:opacity-100" />
                </a>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-500" />
                    {j.location}
                  </span>
                  {j.classification_evidence && j.classification_evidence[0] && (
                    <span className="italic text-slate-400 truncate max-w-xs">
                      "{j.classification_evidence[0].quote}"
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                {onOpenWhy && (
                  <button
                    type="button"
                    onClick={() => onOpenWhy(j)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300 hover:text-white"
                  >
                    Details
                  </button>
                )}
                {onAction && (
                  <button
                    type="button"
                    onClick={() => onAction(j.id, 'queue')}
                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20"
                  >
                    Queue
                  </button>
                )}
                <a
                  href={j.apply_url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 hover:text-cyan-400 flex items-center gap-1.5 transition-all"
                  title="Open official job application in new tab"
                >
                  <ExternalLink className="w-3 h-3 text-cyan-400" />
                  <span>View Job</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
