import React from 'react';
import LandingNavbar from '@/components/landing/Navbar';
import Hero from '@/components/landing/Hero';
import HowItWorks from '@/components/landing/HowItWorks';
import Features from '@/components/landing/Features';
import Hallucination from '@/components/landing/Hallucination';
import Control from '@/components/landing/Control';
import Audience from '@/components/landing/Audience';
import FAQ from '@/components/landing/FAQ';
import CTA from '@/components/landing/CTA';
import Footer from '@/components/landing/Footer';

export const metadata = {
  title: 'JobPilot — Autonomous AI Agent That Finds Jobs & Applies For You',
  description:
    'Upload your resume once. JobPilot discovers matching roles across top ATS platforms, tailors your resume without hallucination, and applies with you in control.',
  openGraph: {
    title: 'JobPilot — Autonomous AI Career Agent',
    description:
      'Zero-hallucination resume tailoring, automated ATS job discovery, and human-in-the-loop auto-applying.',
    url: 'https://jobpilot.io',
    siteName: 'JobPilot',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'JobPilot — Autonomous AI Career Agent',
    description:
      'Upload your resume once. Discovers roles, tailors your ATS resume, and applies with you in control.',
  },
};

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#080c14] text-slate-100 selection:bg-indigo-500 selection:text-white overflow-x-hidden">
      {/* Accessible Skip to Content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 z-[100] px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold shadow-2xl outline-none ring-2 ring-cyan-400"
      >
        Skip to content
      </a>

      {/* 1. Fixed Navbar */}
      <LandingNavbar />

      <main id="main-content" className="flex-1 pt-[var(--nav-height)]">
        {/* 2. Hero Section */}
        <Hero />

        {/* 3. How It Works (4 Steps) */}
        <HowItWorks />

        {/* 4. Features Grid (8 Cards) */}
        <Features />

        {/* 5. Zero Hallucination Explainer */}
        <Hallucination />

        {/* 6. You Stay in Control (3 Guardrail Points) */}
        <Control />

        {/* 7. Who It's For (Audience) */}
        <Audience />

        {/* 8. FAQ Accordion */}
        <FAQ />

        {/* 9. Final CTA Banner */}
        <CTA />
      </main>

      {/* 10. Footer */}
      <Footer />
    </div>
  );
}
