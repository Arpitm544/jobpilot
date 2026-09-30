'use client';

import React from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { 
  ArrowRight, 
  Sparkles, 
  CheckCircle2, 
  Bot, 
  FileText, 
  Send, 
  ShieldAlert, 
  Layers, 
  Search, 
  Zap, 
  TrendingUp 
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative pt-20 pb-24 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            {/* Top Tag */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold mb-8 animate-pulse-slow">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Next-Gen Autonomous Career Agent</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-[1.15]">
              Land high-paying tech roles <br className="hidden sm:inline" />
              <span className="gradient-text-primary">tailored & applied on autopilot.</span>
            </h1>

            {/* Subtitle */}
            <p className="mt-6 text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Upload your resume once. JobPilot continuously fetches matching roles, creates ATS-friendly 1-page resumes tailored to every JD without hallucinations, and applies automatically.
            </p>

            {/* CTA Buttons */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/onboarding"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-semibold text-base shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/50 hover:scale-[1.02] active:scale-95 transition-all"
              >
                <span>Start Free Onboarding</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 font-semibold text-base transition-all"
              >
                <span>Sign in to Dashboard</span>
              </Link>
            </div>

            {/* Feature Highlights Grid */}
            <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              {/* Card 1 */}
              <div className="glass-panel glass-panel-hover p-6 rounded-2xl">
                <div className="h-12 w-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-5 text-indigo-400">
                  <Search className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Live ATS Job Discovery</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Real-time direct feeds from Greenhouse, Lever, Ashby, and top boards with duplicate-free hashing and intelligent keyword filtering.
                </p>
              </div>

              {/* Card 2 */}
              <div className="glass-panel glass-panel-hover p-6 rounded-2xl">
                <div className="h-12 w-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-5 text-cyan-400">
                  <Bot className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Zero-Hallucination Tailoring</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Every bullet is adapted to the JD with Action + Tech + Impact. Dual-pass Gemini verification guarantees 100% truthfulness to your master profile.
                </p>
              </div>

              {/* Card 3 */}
              <div className="glass-panel glass-panel-hover p-6 rounded-2xl">
                <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5 text-emerald-400">
                  <Send className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Autonomous Form Filling</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Playwright headless workers automate applications with isolated contexts, screenshot confirmations, and human-in-the-loop fallback for CAPTCHAs.
                </p>
              </div>
            </div>

            {/* Live Pipeline Flow Preview */}
            <div className="mt-16 glass-panel rounded-2xl p-6 sm:p-8 border border-white/10 text-left">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-white/10 gap-4">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-400" />
                    How JobPilot Automates Your Pipeline
                  </h3>
                  <p className="text-sm text-slate-400 mt-1">
                    Continuous lifecycle from initial upload to interview offer
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                  Autonomous Cycle Active
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-6">
                {[
                  { step: "01", title: "Master Profile", desc: "Parsed from PDF/DOCX into unified source of truth" },
                  { step: "02", title: "Discovery & Scoring", desc: "Matched against live JDs via embeddings & skill overlap" },
                  { step: "03", title: "AI Tailoring", desc: "ATS 1-page PDF generated with claim verification" },
                  { step: "04", title: "Review or Auto", desc: "One-click approval or auto-apply with daily limits" },
                  { step: "05", title: "Live Tracking", desc: "Audit trail, proof screenshots, and status sync" },
                ].map((item, idx) => (
                  <div key={idx} className="glass-card p-4 rounded-xl relative group">
                    <span className="text-xs font-black text-indigo-400/80 mb-1 block">{item.step}</span>
                    <h4 className="text-sm font-semibold text-white">{item.title}</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-snug">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#060910] py-8 text-center text-xs text-slate-500">
        <p>© 2026 JobPilot Inc. Engineered with FastAPI, Next.js, and Google Gemini AI.</p>
      </footer>
    </div>
  );
}
