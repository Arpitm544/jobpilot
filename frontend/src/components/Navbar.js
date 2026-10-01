'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { Sparkles, Compass, User, LogOut, ShieldCheck, Layers, TrendingUp } from 'lucide-react';

export default function Navbar() {
  const { user, logout, isLoading } = useAuth();
  const pathname = usePathname();

  // The authenticated app navbar must NEVER render unless the user is authenticated
  if (isLoading || !user) {
    return null;
  }

  const navItems = [
    { label: 'Onboarding', href: '/onboarding', icon: Compass, active: pathname === '/onboarding' },
    { label: 'Pipeline', href: '/pipeline', icon: Layers, active: pathname === '/pipeline' || pathname === '/dashboard' },
    { label: 'Discovery', href: '/discovery', icon: Sparkles, active: pathname === '/discovery' || pathname === '/dashboard/jobs' },
    { label: 'Analytics', href: '/analytics', icon: TrendingUp, active: pathname === '/analytics' || pathname === '/dashboard/analytics' },
    { label: 'Master Profile', href: '/profile', icon: User, active: pathname === '/profile' || pathname === '/dashboard/profile' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#080c14]/90 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-[1px] shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <div className="h-full w-full bg-[#080c14] rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
              Job<span className="gradient-text-primary">Pilot</span>
            </span>
            <span className="hidden sm:block text-[10px] uppercase tracking-widest text-indigo-400 font-semibold">
              Autonomous AI Agent
            </span>
          </div>
        </Link>

        {/* Center Authenticated Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 py-1 px-2.5 rounded-lg transition-colors ${
                  item.active
                    ? 'text-cyan-400 bg-white/5 font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className={`w-4 h-4 ${item.active ? 'text-cyan-400' : 'text-indigo-400'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Zero Hallucination</span>
          </div>
        </nav>

        {/* Right User Profile & Logout */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-white truncate max-w-[160px]">
                {user.full_name || user.email.split('@')[0]}
              </span>
              <span className="text-[10px] text-slate-400 truncate max-w-[160px]">
                {user.email}
              </span>
            </div>
            <button
              onClick={logout}
              className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-rose-500/10 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
