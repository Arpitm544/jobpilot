'use client';

import React from 'react';
import { m } from 'framer-motion';
import { X } from 'lucide-react';

export default function Chip({
  label,
  selected = false,
  onSelect,
  onRemove,
  className = '',
  icon,
}) {
  const isClickable = Boolean(onSelect);

  return (
    <m.span
      whileHover={isClickable ? { scale: 1.03 } : undefined}
      whileTap={isClickable ? { scale: 0.97 } : undefined}
      onClick={onSelect}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium border transition-colors select-none ${
        selected
          ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-200 shadow-sm shadow-cyan-950/40'
          : 'bg-slate-900/70 border-white/10 text-slate-300 hover:border-white/20'
      } ${isClickable ? 'cursor-pointer' : ''} ${className}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-0.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          aria-label={`Remove ${label}`}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </m.span>
  );
}
