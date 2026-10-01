import React from 'react';

const badgeVariants = {
  indigo: {
    badge: 'bg-indigo-500/10 border-indigo-500/25 text-indigo-300',
    dot: 'bg-indigo-400',
  },
  cyan: {
    badge: 'bg-cyan-500/10 border-cyan-500/25 text-cyan-300',
    dot: 'bg-cyan-400',
  },
  emerald: {
    badge: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300',
    dot: 'bg-emerald-400',
  },
  amber: {
    badge: 'bg-amber-500/10 border-amber-500/25 text-amber-300',
    dot: 'bg-amber-400',
  },
  rose: {
    badge: 'bg-rose-500/10 border-rose-500/25 text-rose-300',
    dot: 'bg-rose-400',
  },
  slate: {
    badge: 'bg-slate-800/60 border-white/10 text-slate-300',
    dot: 'bg-slate-400',
  },
};

export default function Badge({
  children,
  variant = 'cyan',
  dot = false,
  className = '',
}) {
  const current = badgeVariants[variant] || badgeVariants.cyan;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-medium tracking-wide ${current.badge} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`} />}
      {children}
    </span>
  );
}
