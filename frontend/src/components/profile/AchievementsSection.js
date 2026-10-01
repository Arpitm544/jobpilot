'use client';

import React, { useState } from 'react';
import { Trophy, Plus, Trash2 } from 'lucide-react';

export default function AchievementsSection({
  achievements = [],
  onChange,
}) {
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState(null);

  const addAchievement = () => {
    onChange([
      ...achievements,
      {
        title: '',
        issuer: '',
        date: '',
        description: '',
      },
    ]);
  };

  const updateAchievement = (idx, field, value) => {
    const updated = [...achievements];
    updated[idx] = {
      ...updated[idx],
      [field]: value,
    };
    onChange(updated);
  };

  const removeAchievement = (idx) => {
    onChange(achievements.filter((_, i) => i !== idx));
    setConfirmDeleteIdx(null);
  };

  return (
    <div id="section-achievements" className="glass-panel p-6 sm:p-7 rounded-2xl space-y-5 border border-white/10 shadow-lg">
      <div className="flex items-center justify-between pb-3 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
            <Trophy className="w-4 h-4 text-yellow-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">Achievements & Honors</h2>
              <span className="px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-xs font-semibold">
                {achievements.length}
              </span>
            </div>
            <p className="text-xs text-slate-400">Hackathon wins, competitive rankings, open-source recognitions, and awards</p>
          </div>
        </div>

        <button
          type="button"
          onClick={addAchievement}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-500/30 text-yellow-300 text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add Achievement</span>
        </button>
      </div>

      {achievements.length === 0 ? (
        <div className="p-8 rounded-xl bg-slate-900/40 border border-dashed border-white/10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800/60 flex items-center justify-center mx-auto text-slate-500">
            <Trophy className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-slate-300">No achievements added yet</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Highlight hackathon prizes, academic scholarships, coding contest ranks (LeetCode/Codeforces), or awards.
          </p>
          <button
            type="button"
            onClick={addAchievement}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-yellow-600/30 hover:bg-yellow-600/50 text-yellow-200 text-xs font-semibold cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Achievement</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {achievements.map((ach, idx) => (
            <div
              key={idx}
              className="glass-card p-5 rounded-xl space-y-3.5 relative border border-white/10 bg-slate-900/40 transition-all hover:border-white/20"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-yellow-400">
                  Honor #{idx + 1}
                </span>

                {confirmDeleteIdx === idx ? (
                  <div className="flex items-center gap-1.5 bg-rose-500/20 border border-rose-500/40 px-2.5 py-1 rounded-lg text-xs ml-2">
                    <span className="text-rose-300 text-[11px]">Delete?</span>
                    <button
                      type="button"
                      onClick={() => removeAchievement(idx)}
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
                    title="Remove achievement"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-[13px] font-medium text-slate-300 mb-1">
                    Title / Honor *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1st Place - Smart India Hackathon 2024"
                    value={ach.title || ''}
                    onChange={(e) => updateAchievement(idx, 'title', e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-slate-900 border border-white/10 text-white text-[14px] sm:text-[15px] focus:border-yellow-500 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-slate-300 mb-1">
                    Date / Year
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Oct 2023"
                    value={ach.date || ''}
                    onChange={(e) => updateAchievement(idx, 'date', e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-slate-900 border border-white/10 text-white text-[14px] sm:text-[15px] focus:border-yellow-500 focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-[13px] font-medium text-slate-300 mb-1">
                    Issuer / Organization
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Major League Hacking, University"
                    value={ach.issuer || ''}
                    onChange={(e) => updateAchievement(idx, 'issuer', e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-slate-900 border border-white/10 text-white text-[14px] sm:text-[15px] focus:border-yellow-500 focus:outline-none transition-all"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[13px] font-medium text-slate-300 mb-1">
                    Description / Details
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Built automated task scheduling system ranked top 1% among 500+ teams..."
                    value={ach.description || ''}
                    onChange={(e) => updateAchievement(idx, 'description', e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-slate-900 border border-white/10 text-white text-[14px] sm:text-[15px] focus:border-yellow-500 focus:outline-none transition-all"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
