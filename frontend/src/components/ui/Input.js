'use client';

import React, { forwardRef } from 'react';
import { AlertCircle } from 'lucide-react';

const Input = forwardRef(function Input(
  {
    label,
    error,
    helperText,
    icon,
    rightElement,
    className = '',
    id,
    disabled = false,
    ...props
  },
  ref
) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1.5 text-left">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold text-slate-300 uppercase tracking-wider"
        >
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        {icon && (
          <div className="absolute left-3.5 text-slate-400 pointer-events-none shrink-0">
            {icon}
          </div>
        )}

        <input
          id={inputId}
          ref={ref}
          disabled={disabled}
          className={`w-full py-2.5 rounded-xl bg-slate-900/80 border text-white placeholder-slate-500 text-sm transition-all focus:outline-none focus:ring-1 disabled:opacity-50 disabled:cursor-not-allowed ${
            icon ? 'pl-10' : 'pl-3.5'
          } ${rightElement ? 'pr-11' : 'pr-3.5'} ${
            error
              ? 'border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/30'
              : 'border-white/10 hover:border-white/20 focus:border-indigo-500 focus:ring-indigo-500/30'
          } ${className}`}
          {...props}
        />

        {rightElement && (
          <div className="absolute right-3 text-slate-400 shrink-0">
            {rightElement}
          </div>
        )}
      </div>

      {error ? (
        <p className="text-xs text-rose-400 flex items-center gap-1.5 pt-0.5 animate-in fade-in duration-200">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : helperText ? (
        <p className="text-xs text-slate-400 pt-0.5">{helperText}</p>
      ) : null}
    </div>
  );
});

export default Input;
