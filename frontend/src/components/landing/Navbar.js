'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/authContext';
import { landingContent } from './content';
import { Sparkles, Menu, X, ArrowRight, LayoutDashboard } from 'lucide-react';

const SECTION_IDS = ['how-it-works', 'features', 'zero-hallucination', 'audience', 'faq'];

export default function LandingNavbar() {
  const { nav } = landingContent;
  const { user } = useAuth();

  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef(null);
  const toggleBtnRef = useRef(null);

  // -----------------------------------------------------------
  // 1. Lightweight Scroll-Aware State with requestAnimationFrame
  // -----------------------------------------------------------
  useEffect(() => {
    let ticking = false;

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrolled(window.scrollY > 10);
          ticking = false;
        });
        ticking = true;
      }
    };

    // Initial check
    setScrolled(window.scrollY > 10);

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // -----------------------------------------------------------
  // 2. Active Section Scroll Spy via IntersectionObserver
  // -----------------------------------------------------------
  useEffect(() => {
    const observerCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, {
      root: null,
      rootMargin: '-20% 0px -65% 0px',
      threshold: 0,
    });

    SECTION_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // -----------------------------------------------------------
  // 3. Initial Hash Navigation Alignment (e.g., /#faq on load)
  // -----------------------------------------------------------
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hashId = window.location.hash.replace('#', '');
      const target = document.getElementById(hashId);
      if (target) {
        setActiveSection(hashId);
        // Small delay to ensure DOM is fully laid out before scrolling
        const timer = setTimeout(() => {
          target.scrollIntoView({ behavior: 'smooth' });
        }, 150);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  // -----------------------------------------------------------
  // 4. Mobile Menu: Scroll Lock & Keyboard Escape & Outside Click
  // -----------------------------------------------------------
  useEffect(() => {
    if (mobileMenuOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          setMobileMenuOpen(false);
          toggleBtnRef.current?.focus();
        }
      };

      const handleClickOutside = (e) => {
        if (
          mobileMenuRef.current &&
          !mobileMenuRef.current.contains(e.target) &&
          toggleBtnRef.current &&
          !toggleBtnRef.current.contains(e.target)
        ) {
          setMobileMenuOpen(false);
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);

      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [mobileMenuOpen]);

  // Smooth scroll handler for anchor links
  const handleNavClick = useCallback((e, href) => {
    if (href.startsWith('#')) {
      e.preventDefault();
      const targetId = href.replace('#', '');
      setActiveSection(targetId);
      setMobileMenuOpen(false);

      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        window.history.pushState(null, '', href);
      }
    }
  }, []);

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 w-full transition-all duration-300 ease-in-out ${
        scrolled
          ? 'bg-[#080c14]/90 backdrop-blur-md border-b border-white/10 shadow-lg shadow-black/25'
          : 'bg-transparent border-b border-transparent shadow-none'
      }`}
      style={{
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className={`flex items-center justify-between transition-all duration-300 ${
            scrolled ? 'h-16' : 'h-[var(--nav-height)]'
          }`}
        >
          {/* Brand Logo */}
          <Link
            href="/"
            className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-xl"
            onClick={closeMenu}
          >
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

          {/* Desktop Navigation Links (with Framer Motion animated active pill) */}
          <nav
            className="hidden md:flex items-center gap-1 lg:gap-2 text-sm font-medium"
            aria-label="Main"
          >
            {nav.links.map((link) => {
              const linkId = link.href.replace('#', '');
              const isActive = activeSection === linkId;

              return (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className={`relative px-3.5 py-1.5 rounded-lg text-sm transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                    isActive
                      ? 'text-cyan-300 font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {/* Sliding layoutId animated active pill */}
                  {isActive && (
                    <motion.span
                      layoutId="activeNavPill"
                      className="absolute inset-0 rounded-lg bg-indigo-500/15 border border-indigo-500/30 -z-10 shadow-sm shadow-indigo-500/10"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span>{link.label}</span>
                </a>
              );
            })}
          </nav>

          {/* Right Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white text-sm font-semibold shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 transition-all hover:scale-[1.02] active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
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
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white text-sm font-semibold shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 transition-all hover:scale-[1.02] active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
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
              ref={toggleBtnRef}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              aria-label={mobileMenuOpen ? 'Close Menu' : 'Open Menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Panel */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            ref={mobileMenuRef}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="md:hidden bg-[#0a0f1d]/95 backdrop-blur-xl border-b border-white/10 px-4 pt-3 pb-6 shadow-2xl shadow-black/50"
          >
            <nav className="flex flex-col space-y-1" aria-label="Mobile Navigation">
              {nav.links.map((link) => {
                const linkId = link.href.replace('#', '');
                const isActive = activeSection === linkId;

                return (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={(e) => handleNavClick(e, link.href)}
                    className={`px-3 py-2.5 rounded-xl text-base font-medium transition-colors flex items-center justify-between ${
                      isActive
                        ? 'bg-indigo-500/15 text-cyan-300 font-semibold border border-indigo-500/30'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span>{link.label}</span>
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                  </a>
                );
              })}
            </nav>

            <div className="pt-4 mt-3 border-t border-white/10 flex flex-col gap-2.5">
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
                    className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 text-white text-sm font-semibold shadow-md shadow-indigo-600/30"
                  >
                    <span>{nav.cta.getStarted}</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
