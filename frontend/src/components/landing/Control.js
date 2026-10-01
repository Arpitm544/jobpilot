'use client';

import React from 'react';
import { landingContent } from './content';
import { Eye, Power, ShieldAlert } from 'lucide-react';

const iconMap = {
  Eye,
  Power,
  ShieldAlert,
};

export default function Control() {
  const { control } = landingContent;

  return (
    <section className="py-20 border-t border-white/5 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs uppercase font-bold tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
            {control.eyebrow}
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-4 tracking-tight">
            {control.title}
          </h2>
          <p className="mt-3 text-base text-slate-400">
            {control.subtitle}
          </p>
        </div>

        {/* 3 Points Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {control.points.map((point, idx) => {
            const Icon = iconMap[point.icon] || Eye;

            return (
              <div
                key={idx}
                className="glass-panel glass-panel-hover rounded-2xl p-6 sm:p-7 border border-white/10 hover:border-indigo-500/40 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="h-12 w-12 rounded-xl bg-indigo-600/15 border border-indigo-500/25 flex items-center justify-center text-cyan-400 mb-5">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2.5">
                    {point.title}
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    {point.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-white/5 flex items-center gap-2 text-xs text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Enforced on every session</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
