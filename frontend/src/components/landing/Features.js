'use client';

import React from 'react';
import { landingContent } from './content';
import {
  Search,
  PieChart,
  FileText,
  ShieldCheck,
  SlidersHorizontal,
  Kanban,
  HelpCircle,
  MailCheck,
  Sparkles
} from 'lucide-react';

const iconMap = {
  Search,
  PieChart,
  FileText,
  ShieldCheck,
  SlidersHorizontal,
  Kanban,
  HelpCircle,
  MailCheck,
};

export default function Features() {
  const { features } = landingContent;

  return (
    <section id="features" className="scroll-mt-[calc(var(--nav-height)+16px)] py-20 border-t border-white/5 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs uppercase font-bold tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
            {features.eyebrow}
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-4 tracking-tight">
            {features.title}
          </h2>
          <p className="mt-3 text-base text-slate-400">
            {features.subtitle}
          </p>
        </div>

        {/* 8 Cards Grid (3 Columns on Desktop) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.items.map((item, idx) => {
            const Icon = iconMap[item.icon] || Sparkles;

            return (
              <div
                key={idx}
                className="glass-panel glass-panel-hover rounded-2xl p-6 relative flex flex-col justify-between group border border-white/10 hover:border-cyan-500/30 transition-all duration-300"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="h-11 w-11 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-110 group-hover:bg-cyan-500/20 transition-all duration-300">
                      <Icon className="w-5 h-5" />
                    </div>
                    {item.badge && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                        {item.badge}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-white mb-2 group-hover:text-cyan-300 transition-colors">
                    {item.title}
                  </h3>

                  <p className="text-sm text-slate-400 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-white/5 flex items-center gap-1.5 text-xs text-indigo-400 font-medium opacity-80 group-hover:opacity-100 transition-opacity">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  <span>Integrated into Autonomous Engine</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
