'use client';

import React from 'react';
import { CheckCircle2, AlertCircle, HelpCircle, XCircle } from 'lucide-react';

export const VERDICT_CONFIG = {
  eligible: {
    label: 'Eligible',
    badgeClass: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25',
    icon: CheckCircle2,
    dotColor: 'bg-emerald-400',
  },
  likely_eligible: {
    label: 'Likely Eligible',
    badgeClass: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/25',
    icon: CheckCircle2,
    dotColor: 'bg-cyan-400',
  },
  unclear: {
    label: 'Unclear',
    badgeClass: 'bg-amber-500/15 border-amber-500/30 text-amber-400 hover:bg-amber-500/25',
    icon: HelpCircle,
    dotColor: 'bg-amber-400',
  },
  likely_not_eligible: {
    label: 'Likely Ineligible',
    badgeClass: 'bg-rose-500/15 border-rose-500/30 text-rose-400 hover:bg-rose-500/25',
    icon: AlertCircle,
    dotColor: 'bg-rose-400',
  },
  not_eligible: {
    label: 'Not Eligible',
    badgeClass: 'bg-rose-500/20 border-rose-500/40 text-rose-400 hover:bg-rose-500/30',
    icon: XCircle,
    dotColor: 'bg-rose-500',
  },
};

export default function EligibilityBadge({
  verdict = 'unclear',
  onClick,
  showWhyButton = true,
  size = 'sm'
}) {
  const cfg = VERDICT_CONFIG[verdict] || VERDICT_CONFIG.unclear;
  const Icon = cfg.icon;

  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={onClick}
        title="Click to see eligibility evidence and reasons"
        className={`px-2.5 py-1 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${cfg.badgeClass}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor} animate-pulse`} />
        <Icon className="w-3.5 h-3.5" />
        <span>{cfg.label}</span>
      </button>

      {showWhyButton && (
        <button
          type="button"
          onClick={onClick}
          className="text-[11px] font-medium text-slate-400 hover:text-cyan-400 underline decoration-slate-600 underline-offset-2 transition-colors ml-0.5"
        >
          Why?
        </button>
      )}
    </div>
  );
}
