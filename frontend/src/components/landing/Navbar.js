'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/authContext';
import { landingContent } from './content';
import { Sparkles, Menu, X, ArrowRight, LayoutDashboard } from 'lucide-react';

export default function LandingNavbar() {
  const { nav } = landingContent;
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? 'bg-[#080c14]/90 backdrop-blur-md border-b border-white/10 shadow-lg shadow-black/20'
          : 'bg-[#080c14]/60 backdrop-blur-sm border-b border-white/5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group" onClick={closeMenu}>
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-[1px] shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-200">
            <div className="h-full w-full bg-[#080c14] rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight text-white flex items-center">
              Job<span className="gradient-text-primary">Pilot</span>
            </span>
            <span className="text-[10px] uppercase tracking-wider text-indigo-400 font-semibold hidden sm:block">
              {nav.brandSubtitle}
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300" aria-label="Main Navigation">
          {nav.links.map((link, idx) => (
            <a
              key={idx}
              href={link.href}
              className="text-slate-300 hover:text-cyan-400 transition-colors py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Right Action Buttons */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white text-sm font-semibold shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 transition-all hover:scale-[1.02] active:scale-95"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>{nav.cta.dashboard}</span>
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                {nav.cta.login}
              </Link>
              <Link
                href="/onboarding"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white text-sm font-semibold shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 transition-all hover:scale-[1.02] active:scale-95"
              >
                <span>{nav.cta.getStarted}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger Toggle Button */}
        <div className="md:hidden flex items-center">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400"
            aria-label={mobileMenuOpen ? 'Close Menu' : 'Open Menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0a0f1d]/95 border-b border-white/10 px-4 pt-3 pb-6 space-y-4 backdrop-blur-xl animate-in slide-in-from-top-4 duration-200">
          <nav className="flex flex-col space-y-3" aria-label="Mobile Navigation">
            {nav.links.map((link, idx) => (
              <a
                key={idx}
                href={link.href}
                onClick={closeMenu}
                className="text-base font-medium text-slate-300 hover:text-cyan-400 py-2 border-b border-white/5 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="pt-2 flex flex-col gap-2.5">
            {user ? (
              <Link
                href="/dashboard"
                onClick={closeMenu}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-semibold text-sm shadow-md"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>{nav.cta.dashboard}</span>
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={closeMenu}
                  className="w-full text-center py-2.5 rounded-xl text-sm font-medium text-slate-300 border border-white/10 hover:bg-white/5 transition-colors"
                >
                  {nav.cta.login}
                </Link>
                <Link
                  href="/onboarding"
                  onClick={closeMenu}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 text-white text-sm font-semibold shadow-md shadow-indigo-600/30"
                >
                  <span>{nav.cta.getStarted}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
