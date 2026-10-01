'use client';

import React from 'react';
import { landingContent } from './content';
import { ShieldCheck, CheckCircle2, ArrowRight, Sparkles, AlertTriangle } from 'lucide-react';

export default function Hallucination() {
  const { hallucination } = landingContent;
  const { comparison } = hallucination;

  return (
    <section id="zero-hallucination" className="scroll-mt-[calc(var(--nav-height)+16px)] py-20 border-t border-white/5 relative overflow-hidden">
      {/* Background Soft Glow */}
      <div className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Heading & Core Explanation */}
          <div className="lg:col-span-6 space-y-6">
            <span className="text-xs uppercase font-bold tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              {hallucination.eyebrow}
            </span>

            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              {hallucination.title}
            </h2>

            <p className="text-base text-slate-300 leading-relaxed">
              {hallucination.subtitle}
            </p>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Our Algorithmic Commitment</span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                {comparison.explanation}
              </p>
            </div>
          </div>

          {/* Right Column: Before / After Comparison Card */}
          <div className="lg:col-span-6">
            <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-white/15 shadow-2xl relative space-y-6 bg-[#0c1220]/90">
              {/* Card Header & Verification Badge */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>Interactive Proof Comparison</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{comparison.verificationBadge}</span>
                </div>
              </div>

              {/* Before: Original Bullet */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-slate-500" />
                  <span>{comparison.originalLabel}</span>
                </div>
                <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5 text-sm text-slate-400 leading-relaxed">
                  &ldquo;{comparison.originalText}&rdquo;
                </div>
              </div>

              {/* Divider Transition Arrow */}
              <div className="flex items-center justify-center">
                <div className="h-8 w-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-cyan-400">
                  <ArrowRight className="w-4 h-4 rotate-90 sm:rotate-0" />
                </div>
              </div>

              {/* After: Tailored Bullet */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-cyan-400">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    {comparison.tailoredLabel}
                  </span>
                  <span className="text-[11px] text-emerald-400 font-semibold lowercase">
                    +45% ATS keyword fit
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/40 to-cyan-950/40 border border-cyan-500/30 text-sm text-slate-100 font-medium leading-relaxed shadow-lg shadow-cyan-950/20">
                  &ldquo;{comparison.tailoredText}&rdquo;
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
