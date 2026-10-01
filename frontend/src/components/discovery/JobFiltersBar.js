'use client';

import React, { useState, useEffect } from 'react';
import {
  Globe,
  MapPin,
  Briefcase,
  SlidersHorizontal,
  CheckCircle2,
  GraduationCap,
  Sparkles,
  Settings2
} from 'lucide-react';
import { api } from '@/lib/api';

export default function JobFiltersBar({
  filters,
  onFilterChange,
  onOpenLocationSettings,
  maybeCount = 0,
  showMaybe,
  onToggleMaybe
}) {
  const [countries, setCountries] = useState([]);
  const [loadingCountries, setLoadingCountries] = useState(false);

  useEffect(() => {
    async function loadCountries() {
      setLoadingCountries(true);
      try {
        const res = await api.get('/countries');
        if (Array.isArray(res.data)) {
          setCountries(res.data);
        }
      } catch (err) {
        // Fallback default country list
        setCountries([
          { code: 'IN', name: 'India' },
          { code: 'US', name: 'United States' },
          { code: 'GB', name: 'United Kingdom' },
          { code: 'DE', name: 'Germany' },
          { code: 'CA', name: 'Canada' },
          { code: 'SG', name: 'Singapore' },
        ]);
      } finally {
        setLoadingCountries(false);
      }
    }
    loadCountries();
  }, []);

  const isInternship = filters.employment_type === 'internship';

  return (
    <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4 mb-6">
      {/* Primary Filter Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {/* Country Selector */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span>Target Country</span>
          </label>
          <select
            value={filters.country || ''}
            onChange={(e) => onFilterChange('country', e.target.value)}
            className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-white/10 text-xs text-white focus:border-cyan-500 focus:outline-none transition-all"
          >
            <option value="">Home Country First (Default)</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>

        {/* City Input */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-indigo-400" />
            <span>City or Metro</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Bengaluru, Berlin, London..."
            value={filters.city || ''}
            onChange={(e) => onFilterChange('city', e.target.value)}
            className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none transition-all"
          />
        </div>

        {/* Work Mode */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
            <span>Work Mode</span>
          </label>
          <select
            value={filters.work_mode || 'any'}
            onChange={(e) => onFilterChange('work_mode', e.target.value)}
            className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-white/10 text-xs text-white focus:border-emerald-500 focus:outline-none transition-all"
          >
            <option value="any">Any Work Mode</option>
            <option value="remote">Remote Only</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">On-site</option>
          </select>
        </div>

        {/* Employment Type */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5 text-amber-400" />
            <span>Job Type</span>
          </label>
          <select
            value={filters.employment_type || 'all'}
            onChange={(e) => onFilterChange('employment_type', e.target.value)}
            className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-white/10 text-xs text-white focus:border-amber-500 focus:outline-none transition-all"
          >
            <option value="all">All Roles</option>
            <option value="full_time">Full-Time Only</option>
            <option value="internship">Strict Internship Mode</option>
          </select>
        </div>
      </div>

      {/* Secondary Controls & Strict Toggles */}
      <div className="pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Actively Hiring Only Toggle */}
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200 hover:text-white transition-colors">
            <input
              type="checkbox"
              checked={filters.actively_hiring_only !== false}
              onChange={(e) => onFilterChange('actively_hiring_only', e.target.checked)}
              className="w-4 h-4 rounded bg-slate-900 border-white/20 text-emerald-500 focus:ring-0"
            />
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-medium text-emerald-300">Actively Hiring Only</span>
            </span>
          </label>

          {/* Remote Jobs I Can Apply To Toggle */}
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200 hover:text-white transition-colors">
            <input
              type="checkbox"
              checked={Boolean(filters.only_eligible)}
              onChange={(e) => onFilterChange('only_eligible', e.target.checked)}
              className="w-4 h-4 rounded bg-slate-900 border-white/20 text-cyan-500 focus:ring-0"
            />
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Remote jobs I can apply to (Eligible only)</span>
            </span>
          </label>

          {/* Strict Internship Mode: Fresher Toggle */}
          {isInternship && (
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200 hover:text-white transition-colors">
              <input
                type="checkbox"
                checked={Boolean(filters.include_fresher)}
                onChange={(e) => onFilterChange('include_fresher', e.target.checked)}
                className="w-4 h-4 rounded bg-slate-900 border-white/20 text-amber-500 focus:ring-0"
              />
              <span className="flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-amber-400" />
                <span>Include Fresher / Entry-Level Full-Time</span>
              </span>
            </label>
          )}

          {/* Borderline / Maybe internships button */}
          {isInternship && maybeCount > 0 && (
            <button
              type="button"
              onClick={onToggleMaybe}
              className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 transition-all ${
                showMaybe
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Maybe Internships ({maybeCount})</span>
            </button>
          )}
        </div>

        {/* Location & Remote Preferences Button */}
        {onOpenLocationSettings && (
          <button
            type="button"
            onClick={onOpenLocationSettings}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition-all ml-auto"
          >
            <Settings2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Country & Remote Settings</span>
          </button>
        )}
      </div>
    </div>
  );
}
