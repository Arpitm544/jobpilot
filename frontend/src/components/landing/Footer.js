'use client';

import React from 'react';
import Link from 'next/link';
import { landingContent } from './content';
import { Sparkles, Github, Twitter, Linkedin } from 'lucide-react';

export default function Footer() {
  const { footer, nav } = landingContent;

  return (
    <footer className="border-t border-white/10 bg-[#060910] relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 pb-10 border-b border-white/5">
          {/* Brand & Tagline */}
          <div className="space-y-3 max-w-sm">
            <Link href="/" className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-[1px]">
                <div className="h-full w-full bg-[#080c14] rounded-xl flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                </div>
              </div>
              <span className="text-xl font-bold tracking-tight text-white">
                Job<span className="gradient-text-primary">Pilot</span>
              </span>
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed">
              {footer.tagline}
            </p>
          </div>

          {/* Nav / Policy Links */}
          <div className="flex flex-wrap items-center gap-6 sm:gap-8 text-sm text-slate-400">
            {footer.links.map((link, idx) => (
              <a
                key={idx}
                href={link.href}
                className="hover:text-cyan-400 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

        {/* Bottom Bar: Copyright & Security Note */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>{footer.copyright}</p>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Verified Zero Hallucination Standard
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
