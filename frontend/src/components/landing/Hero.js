'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/authContext';
import { landingContent } from './content';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  FileText,
  Building,
  MapPin,
  DollarSign,
  ChevronRight,
  Bot
} from 'lucide-react';

export default function Hero() {
  const { hero } = landingContent;
  const { user } = useAuth();
  const { mockup } = hero;

  return (
    <section className="relative pt-12 pb-20 md:pt-20 md:pb-28 overflow-hidden">
      {/* Subtle Hero Background Radial Glow */}
      <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
        <div className="h-[400px] w-[600px] md:h-[500px] md:w-[850px] rounded-full bg-gradient-to-tr from-indigo-600/15 via-cyan-500/10 to-transparent blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Headlines & CTA */}
          <div className="lg:col-span-7 text-left space-y-6">
            {/* Small Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold shadow-sm">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>{hero.badge}</span>
            </div>

            {/* Main H1 Heading */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.12]">
              Your AI agent that finds jobs and{' '}
              <span className="gradient-text-primary">applies for you</span>
            </h1>

            {/* Subtext */}
            <p className="text-base sm:text-lg text-slate-300 max-w-xl leading-relaxed">
              {hero.subtitle}
            </p>

            {/* Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <Link
                href={user ? "/dashboard" : "/onboarding"}
                className="inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-semibold text-base shadow-xl shadow-indigo-600/25 hover:shadow-indigo-600/40 hover:scale-[1.02] active:scale-95 transition-all text-center"
              >
                <span>{user ? "Go to Dashboard" : hero.primaryCta}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 hover:text-white border border-white/10 hover:border-white/20 font-semibold text-base transition-all text-center"
              >
                <span>{hero.secondaryCta}</span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </a>
            </div>

            {/* Trust Line */}
            <div className="pt-1 flex items-center gap-2 text-xs sm:text-sm text-slate-400">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{hero.trustLine}</span>
            </div>
          </div>

          {/* Right Column: HTML/CSS Product Mockup Card */}
          <div className="lg:col-span-5 relative">
            {/* Ambient card back glow */}
            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-indigo-500/20 to-cyan-500/20 blur-xl -z-10" />

            <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-white/15 shadow-2xl relative bg-[#0d1322]/90 backdrop-blur-xl space-y-5">
              {/* Card Header with Status & Match Score Ring */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-cyan-400">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wider font-semibold text-indigo-400">
                      Live Match Pipeline
                    </span>
                    <h2 className="text-base font-bold text-white leading-tight">
                      {mockup.role}
                    </h2>
                  </div>
                </div>

                {/* Score Circular Ring Indicator */}
                <div className="relative flex items-center justify-center h-14 w-14 shrink-0">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-slate-800"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-cyan-400 stroke-current transition-all duration-1000 ease-out"
                      strokeDasharray={`${mockup.matchScore}, 100`}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-xs font-black text-white leading-none">
                      {mockup.matchScore}%
                    </span>
                    <span className="text-[8px] text-slate-400 uppercase">Match</span>
                  </div>
                </div>
              </div>

              {/* Company & Role Details Meta */}
              <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-slate-300">
                <span className="flex items-center gap-1">
                  <Building className="w-3.5 h-3.5 text-indigo-400" />
                  {mockup.company}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                  {mockup.location}
                </span>
                <span className="flex items-center gap-1 text-emerald-400 font-medium">
                  <DollarSign className="w-3.5 h-3.5" />
                  {mockup.salary}
                </span>
              </div>

              {/* Matched Skills Chips */}
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Matched Core Competencies
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {mockup.skills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Tailored Bullet Preview */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-white/5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    AI JD-Tailored Resume Bullet
                  </span>
                  <span className="text-[10px] text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Verified
                  </span>
                </div>
                <p className="text-xs text-slate-300 italic leading-relaxed">
                  &ldquo;{mockup.bulletHighlight}&rdquo;
                </p>
              </div>

              {/* Status Banner & Action */}
              <div className="pt-1 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-emerald-400 font-medium">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>{mockup.status}</span>
                </div>
                <span className="text-[11px] text-slate-400 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                  Review-Mode Staged
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
