'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/authContext';
import { landingContent } from './content';
import { ArrowRight, Sparkles, LayoutDashboard } from 'lucide-react';

export default function CTA() {
  const { ctaBanner } = landingContent;
  const { user } = useAuth();

  return (
    <section className="py-20 border-t border-white/5 relative overflow-hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl p-8 sm:p-14 overflow-hidden border border-white/15 bg-gradient-to-b from-indigo-950/40 via-slate-900/60 to-[#0c1220]/90 text-center shadow-2xl">
          {/* Ambient Glow in CTA */}
          <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-gradient-to-b from-cyan-500/20 via-indigo-600/20 to-transparent blur-3xl -z-10" />

          <div className="max-w-2xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ready for high-yield job discovery?</span>
            </div>

            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
              {ctaBanner.title}
            </h2>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
              {ctaBanner.subtitle}
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href={user ? "/dashboard" : "/onboarding"}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-semibold text-base shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/50 hover:scale-[1.02] active:scale-95 transition-all text-center"
              >
                {user ? (
                  <>
                    <LayoutDashboard className="w-5 h-5" />
                    <span>Go to Dashboard</span>
                  </>
                ) : (
                  <>
                    <span>{ctaBanner.buttonText}</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </Link>
            </div>

            <p className="text-xs text-slate-400">
              {ctaBanner.secondaryText}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
