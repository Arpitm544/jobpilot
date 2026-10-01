'use client';

import React from 'react';
import { landingContent } from './content';
import { FileUp, Sliders, Sparkles, Send } from 'lucide-react';

const iconMap = {
  FileUp,
  Sliders,
  Sparkles,
  Send,
};

export default function HowItWorks() {
  const { howItWorks } = landingContent;

  return (
    <section id="how-it-works" className="scroll-mt-[calc(var(--nav-height)+16px)] py-20 border-t border-white/5 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs uppercase font-bold tracking-widest text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">
            {howItWorks.eyebrow}
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-4 tracking-tight">
            {howItWorks.title}
          </h2>
          <p className="mt-3 text-base text-slate-400">
            {howItWorks.subtitle}
          </p>
        </div>

        {/* 4 Steps: Horizontal on Desktop, Vertical on Mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {howItWorks.steps.map((step, idx) => {
            const Icon = iconMap[step.icon] || Sparkles;

            return (
              <div
                key={idx}
                className="glass-panel glass-panel-hover rounded-2xl p-6 relative flex flex-col justify-between group border border-white/10 hover:border-indigo-500/40 transition-all duration-300"
              >
                {/* Step Top Bar: Number & Icon */}
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
                      {step.stepNumber}
                    </span>
                    <div className="h-11 w-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-110 group-hover:bg-indigo-500/20 transition-all duration-300">
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-lg font-bold text-white mb-2 group-hover:text-cyan-300 transition-colors">
                    {step.title}
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Subtle indicator bar */}
                <div className="mt-6 pt-4 border-t border-white/5 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Step {idx + 1} of 4
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
