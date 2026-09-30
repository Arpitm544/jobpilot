'use client';

import React from 'react';
import { landingContent } from './content';
import { GraduationCap, GitBranch, Briefcase, CheckCircle2 } from 'lucide-react';

const iconMap = {
  GraduationCap,
  GitBranch,
  Briefcase,
};

export default function Audience() {
  const { audience } = landingContent;

  return (
    <section id="who-its-for" className="py-20 border-t border-white/5 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs uppercase font-bold tracking-widest text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">
            {audience.eyebrow}
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-4 tracking-tight">
            {audience.title}
          </h2>
          <p className="mt-3 text-base text-slate-400">
            {audience.subtitle}
          </p>
        </div>

        {/* 3 Audience Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {audience.cards.map((card, idx) => {
            const Icon = iconMap[card.icon] || GraduationCap;

            return (
              <div
                key={idx}
                className="glass-panel glass-panel-hover rounded-2xl p-6 sm:p-7 border border-white/10 hover:border-cyan-500/30 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="h-12 w-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-5">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">
                    {card.category}
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed mb-6">
                    {card.description}
                  </p>
                </div>

                <div className="space-y-2.5 pt-4 border-t border-white/5">
                  {card.highlights.map((highlight, hIdx) => (
                    <div key={hIdx} className="flex items-center gap-2 text-xs text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{highlight}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
