'use client';

import React, { useState } from 'react';
import { Briefcase, Plus, Trash2, ChevronUp, ChevronDown, MapPin, Calendar, Clock, X } from 'lucide-react';

export default function ExperienceSection({
  experience = [],
  onChange,
}) {
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState(null);

  const addExperience = () => {
    onChange([
      ...experience,
      {
        company: '',
        role: '',
        employment_type: 'Full-time',
        location: '',
        start_date: '',
        end_date: '',
        is_current: false,
        technologies: [],
        bullets: [''],
      },
    ]);
  };

  const updateExperience = (idx, field, value) => {
    const updated = [...experience];
    updated[idx] = {
      ...updated[idx],
      [field]: value,
    };
    onChange(updated);
  };

  const removeExperience = (idx) => {
    onChange(experience.filter((_, i) => i !== idx));
    setConfirmDeleteIdx(null);
  };

  const moveExperience = (idx, direction) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= experience.length) return;
    const updated = [...experience];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;
    onChange(updated);
  };

  const addBullet = (expIdx) => {
    const updated = [...experience];
    const bullets = [...(updated[expIdx].bullets || []), ''];
    updated[expIdx] = { ...updated[expIdx], bullets };
    onChange(updated);
  };

  const updateBullet = (expIdx, bIdx, val) => {
    const updated = [...experience];
    const bullets = [...(updated[expIdx].bullets || [])];
    bullets[bIdx] = val;
    updated[expIdx] = { ...updated[expIdx], bullets };
    onChange(updated);
  };

  const removeBullet = (expIdx, bIdx) => {
    const updated = [...experience];
    const bullets = (updated[expIdx].bullets || []).filter((_, i) => i !== bIdx);
    updated[expIdx] = { ...updated[expIdx], bullets };
    onChange(updated);
  };

  return (
    <div id="section-experience" className="glass-panel p-6 sm:p-7 rounded-2xl space-y-5 border border-white/10 shadow-lg">
      <div className="flex items-center justify-between pb-3 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <Briefcase className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">Work Experience</h2>
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold">
                {experience.length}
              </span>
            </div>
            <p className="text-xs text-slate-400">Full-time roles, internships, and contract or freelance engagements</p>
          </div>
        </div>

        <button
          type="button"
          onClick={addExperience}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-cyan-300 text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add Experience</span>
        </button>
      </div>

      {experience.length === 0 ? (
        <div className="p-8 rounded-xl bg-slate-900/40 border border-dashed border-white/10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800/60 flex items-center justify-center mx-auto text-slate-500">
            <Briefcase className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-slate-300">No work experience yet</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            No work experience yet. That's fine, add internships or freelance work if you have any.
          </p>
          <button
            type="button"
            onClick={addExperience}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 text-xs font-semibold cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Internship / Freelance Role</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {experience.map((exp, idx) => (
            <div
              key={idx}
              className="glass-card p-5 rounded-xl space-y-4 relative border border-white/10 bg-slate-900/40 transition-all hover:border-white/20"
            >
              {/* Card Header & Controls */}
              <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                    Position #{idx + 1}
                  </span>
                  <span className="text-xs text-slate-300 font-medium truncate max-w-[240px] sm:max-w-md">
                    {exp.role && exp.company ? `${exp.role} at ${exp.company}` : exp.company || 'New Position'}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={() => moveExperience(idx, -1)}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                      title="Move up"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                  )}
                  {idx < experience.length - 1 && (
                    <button
                      type="button"
                      onClick={() => moveExperience(idx, 1)}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                      title="Move down"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  )}

                  {confirmDeleteIdx === idx ? (
                    <div className="flex items-center gap-1.5 bg-rose-500/20 border border-rose-500/40 px-2.5 py-1 rounded-lg text-xs ml-2">
                      <span className="text-rose-300 text-[11px]">Delete?</span>
                      <button
                        type="button"
                        onClick={() => removeExperience(idx)}
                        className="font-bold text-rose-400 hover:text-white cursor-pointer px-1"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteIdx(null)}
                        className="text-slate-400 hover:text-white ml-1 cursor-pointer"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteIdx(idx)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors ml-1 cursor-pointer"
                      title="Remove experience"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Row 1: Company, Role, Employment Type */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-[13px] font-medium text-slate-300 mb-1">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Acme Corp, Google"
                    value={exp.company || ''}
                    onChange={(e) => updateExperience(idx, 'company', e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-slate-900 border border-white/10 text-white text-[14px] sm:text-[15px] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-slate-300 mb-1">
                    Job Title / Role *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Software Engineer, Backend Intern"
                    value={exp.role || ''}
                    onChange={(e) => updateExperience(idx, 'role', e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-slate-900 border border-white/10 text-white text-[14px] sm:text-[15px] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-slate-300 mb-1">
                    Employment Type
                  </label>
                  <select
                    value={exp.employment_type || 'Full-time'}
                    onChange={(e) => updateExperience(idx, 'employment_type', e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-white/10 text-white text-[14px] focus:border-indigo-500 focus:outline-none transition-all cursor-pointer"
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Internship">Internship</option>
                    <option value="Freelance">Freelance / Contract</option>
                    <option value="Part-time">Part-time</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Location, Start Date, End Date, Currently working */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5 items-end">
                <div>
                  <label className="block text-[13px] font-medium text-slate-300 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. San Francisco, CA or Remote"
                    value={exp.location || ''}
                    onChange={(e) => updateExperience(idx, 'location', e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-slate-900 border border-white/10 text-white text-[14px] sm:text-[15px] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-slate-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Jun 2022"
                    value={exp.start_date || ''}
                    onChange={(e) => updateExperience(idx, 'start_date', e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-slate-900 border border-white/10 text-white text-[14px] sm:text-[15px] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-slate-300 mb-1">
                    End Date
                  </label>
                  <input
                    type="text"
                    disabled={Boolean(exp.is_current)}
                    placeholder="e.g. Aug 2023 or Present"
                    value={exp.is_current ? 'Present' : exp.end_date || ''}
                    onChange={(e) => updateExperience(idx, 'end_date', e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-slate-900 border border-white/10 text-white text-[14px] sm:text-[15px] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all disabled:opacity-50"
                  />
                </div>
                <div className="h-10 flex items-center">
                  <label className="flex items-center gap-2 cursor-pointer text-[13px] text-slate-300 select-none">
                    <input
                      type="checkbox"
                      checked={Boolean(exp.is_current)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        const updated = [...experience];
                        updated[idx] = {
                          ...updated[idx],
                          is_current: checked,
                          end_date: checked ? 'Present' : (updated[idx].end_date === 'Present' ? '' : updated[idx].end_date),
                        };
                        onChange(updated);
                      }}
                      className="w-4 h-4 rounded bg-slate-900 border-white/20 text-cyan-500 focus:ring-cyan-500/30 cursor-pointer"
                    />
                    <span>Currently working here</span>
                  </label>
                </div>
              </div>

              {/* Row 3: Technologies Used */}
              <div>
                <label className="block text-[13px] font-medium text-slate-300 mb-1">
                  Technologies / Tools <span className="text-slate-500 font-normal">(comma-separated)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Python, FastAPI, Docker, PostgreSQL, AWS"
                  value={Array.isArray(exp.technologies) ? exp.technologies.join(', ') : (exp.technologies || '')}
                  onChange={(e) => {
                    const parts = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                    updateExperience(idx, 'technologies', parts);
                  }}
                  className="w-full h-10 px-3.5 rounded-xl bg-slate-900 border border-white/10 text-white text-[14px] sm:text-[15px] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all"
                />
              </div>

              {/* Row 4: Bullets */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[13px] font-medium text-slate-300">
                    Key Highlights & Impact <span className="text-slate-500 font-normal">(Action Verb + Metric + Tech)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => addBullet(idx)}
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Bullet</span>
                  </button>
                </div>
                <div className="space-y-2">
                  {(exp.bullets || []).map((bullet, bIdx) => (
                    <div key={bIdx} className="flex items-center gap-2">
                      <span className="text-cyan-400 text-sm font-mono">•</span>
                      <input
                        type="text"
                        value={bullet}
                        onChange={(e) => updateBullet(idx, bIdx, e.target.value)}
                        placeholder="e.g. Architected microservices with FastAPI reducing p99 latency by 35%..."
                        className="flex-1 h-10 px-3.5 rounded-xl bg-slate-950 border border-white/10 text-white text-[14px] sm:text-[15px] focus:border-cyan-500 focus:outline-none transition-all placeholder:text-slate-600"
                      />
                      <button
                        type="button"
                        onClick={() => removeBullet(idx, bIdx)}
                        className="p-2 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Remove bullet"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {(exp.bullets || []).length === 0 && (
                    <button
                      type="button"
                      onClick={() => addBullet(idx)}
                      className="w-full py-2.5 border border-dashed border-white/10 rounded-xl text-xs text-slate-400 hover:text-cyan-300 hover:border-cyan-500/30 text-center transition-all cursor-pointer"
                    >
                      + Add first work experience bullet point
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
