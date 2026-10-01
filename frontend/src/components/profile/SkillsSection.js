'use client';

import React, { useState } from 'react';
import { Sparkles, Plus, AlertCircle, ArrowRight, X, Check } from 'lucide-react';
import {
  SKILL_CATEGORIES,
  COMMON_SKILL_SUGGESTIONS,
  normalizeSkillName,
} from './profileMappers';

export default function SkillsSection({
  skills = {},
  onChange,
}) {
  const [newSkillInput, setNewSkillInput] = useState({});
  const [activeSuggestions, setActiveSuggestions] = useState({});

  const categoryLabels = {
    languages: 'Languages',
    frameworks: 'Frameworks & Libraries',
    databases: 'Databases',
    tools: 'Developer Tools',
    cloud_devops: 'Cloud & DevOps',
    concepts: 'Concepts & Fundamentals',
    soft_skills: 'Interpersonal & Soft Skills',
  };

  // Find cross-category duplicates
  const skillOccurrences = {};
  for (const catObj of SKILL_CATEGORIES) {
    const cat = typeof catObj === 'string' ? catObj : catObj.id;
    for (const skill of skills[cat] || []) {
      const lower = (skill || '').toLowerCase();
      if (!lower) continue;
      if (!skillOccurrences[lower]) {
        skillOccurrences[lower] = [];
      }
      skillOccurrences[lower].push({ category: cat, name: skill });
    }
  }

  const duplicates = Object.entries(skillOccurrences).filter(
    ([_, list]) => list.length > 1
  );

  const handleAddSkill = (cat, rawVal) => {
    const norm = normalizeSkillName(rawVal);
    if (!norm) return;

    const currentList = skills[cat] || [];
    // Deduplicate within the same category
    if (currentList.some((s) => s.toLowerCase() === norm.toLowerCase())) {
      setNewSkillInput((prev) => ({ ...prev, [cat]: '' }));
      return;
    }

    const updated = {
      ...skills,
      [cat]: [...currentList, norm],
    };
    onChange(updated);
    setNewSkillInput((prev) => ({ ...prev, [cat]: '' }));
    setActiveSuggestions((prev) => ({ ...prev, [cat]: [] }));
  };

  const handleRemoveSkill = (cat, skillToRemove) => {
    const updated = {
      ...skills,
      [cat]: (skills[cat] || []).filter((s) => s !== skillToRemove),
    };
    onChange(updated);
  };

  const handleMoveDuplicate = (sourceCat, targetCat, skillName) => {
    const updated = { ...skills };
    // Remove from source
    updated[sourceCat] = (updated[sourceCat] || []).filter(
      (s) => s.toLowerCase() !== skillName.toLowerCase()
    );
    // Ensure in target
    if (!updated[targetCat]) updated[targetCat] = [];
    if (!updated[targetCat].some((s) => s.toLowerCase() === skillName.toLowerCase())) {
      updated[targetCat] = [...updated[targetCat], skillName];
    }
    onChange(updated);
  };

  const handleRemoveDuplicate = (catToRemoveFrom, skillName) => {
    const updated = {
      ...skills,
      [catToRemoveFrom]: (skills[catToRemoveFrom] || []).filter(
        (s) => s.toLowerCase() !== skillName.toLowerCase()
      ),
    };
    onChange(updated);
  };

  const onInputChange = (cat, val) => {
    setNewSkillInput((prev) => ({ ...prev, [cat]: val }));
    const trimmed = val.trim().toLowerCase();
    if (!trimmed) {
      setActiveSuggestions((prev) => ({ ...prev, [cat]: [] }));
      return;
    }
    const pool = COMMON_SKILL_SUGGESTIONS[cat] || [];
    const existing = new Set((skills[cat] || []).map((s) => s.toLowerCase()));
    const filtered = pool
      .filter((s) => s.toLowerCase().includes(trimmed) && !existing.has(s.toLowerCase()))
      .slice(0, 5);
    setActiveSuggestions((prev) => ({ ...prev, [cat]: filtered }));
  };

  const totalSkillsCount = SKILL_CATEGORIES.reduce((acc, catObj) => {
    const cat = typeof catObj === 'string' ? catObj : catObj.id;
    return acc + (skills[cat] || []).length;
  }, 0);

  return (
    <div id="section-skills" className="glass-panel p-6 sm:p-7 rounded-2xl space-y-6 border border-white/10 shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-white/5 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">Technical Skills Inventory</h2>
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
                {totalSkillsCount} total
              </span>
            </div>
            <p className="text-xs text-slate-400">Strictly verified core competencies categorized for automated matching</p>
          </div>
        </div>
      </div>

      {/* Duplicate Warning Banner */}
      {duplicates.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-2.5 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 font-semibold text-amber-300">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Cross-Category Duplicates Detected ({duplicates.length})</span>
          </div>
          <p className="text-[12px] text-amber-200/80">
            The same skill appears in multiple categories. Clean up duplicates to ensure clean automated tailoring:
          </p>
          <div className="space-y-2 pt-1">
            {duplicates.map(([lowerSkill, occurrences]) => (
              <div
                key={lowerSkill}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-black/40 border border-amber-500/20"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-white text-xs px-2 py-0.5 rounded bg-white/10">
                    {occurrences[0].name}
                  </span>
                  <span className="text-slate-400 text-[11px]">found in:</span>
                  {occurrences.map((occ) => (
                    <span
                      key={occ.category}
                      className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/20 text-amber-300"
                    >
                      {categoryLabels[occ.category] || occ.category}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {occurrences.length === 2 && (
                    <button
                      type="button"
                      onClick={() =>
                        handleMoveDuplicate(
                          occurrences[1].category,
                          occurrences[0].category,
                          occurrences[0].name
                        )
                      }
                      className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      Keep in {categoryLabels[occurrences[0].category] || occurrences[0].category} only
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      handleRemoveDuplicate(
                        occurrences[occurrences.length - 1].category,
                        occurrences[0].name
                      )
                    }
                    className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    Remove duplicate
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7 Categorized Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SKILL_CATEGORIES.map((catObj) => {
          const cat = typeof catObj === 'string' ? catObj : catObj.id;
          const catLabel = (typeof catObj === 'object' && catObj.label) || categoryLabels[cat] || cat;
          const list = skills[cat] || [];
          const currInput = newSkillInput[cat] || '';
          const catSuggestions = activeSuggestions[cat] || [];

          return (
            <div
              key={cat}
              className="glass-card p-4 sm:p-5 rounded-xl space-y-3 border border-white/10 bg-slate-900/40 relative flex flex-col justify-between hover:border-white/20 transition-all"
            >
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      {catLabel}
                    </span>
                    {cat === 'concepts' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 font-medium">
                        DSA, OOPs, System Design, REST
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {list.length} skills
                  </span>
                </div>

                {/* Chips */}
                <div className="flex flex-wrap gap-1.5 min-h-[44px] py-2 items-center">
                  {list.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-200 text-xs font-medium hover:border-indigo-500/40 transition-colors"
                    >
                      <span>{skill}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(cat, skill)}
                        className="text-indigo-400 hover:text-rose-400 transition-colors cursor-pointer"
                        title={`Remove ${skill}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {list.length === 0 && (
                    <span className="text-xs text-slate-500 italic py-1">
                      No skills added in {String(catLabel).toLowerCase()}
                    </span>
                  )}
                </div>
              </div>

              {/* Add Input + Autocomplete */}
              <div className="pt-2 border-t border-white/5 relative">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={`Add to ${catLabel}...`}
                    value={currInput}
                    onChange={(e) => onInputChange(cat, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSkill(cat, currInput);
                      }
                    }}
                    className="flex-1 h-10 px-3 rounded-xl bg-slate-950 border border-white/10 text-white text-[14px] focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddSkill(cat, currInput)}
                    className="h-10 px-3.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Add</span>
                  </button>
                </div>

                {/* Autocomplete Dropdown */}
                {catSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 p-1.5 bg-slate-900 border border-indigo-500/40 rounded-xl shadow-2xl z-20 space-y-1">
                    <span className="text-[10px] font-semibold text-slate-400 px-2 py-0.5 block uppercase tracking-wider">
                      Suggestions
                    </span>
                    {catSuggestions.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => handleAddSkill(cat, sug)}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-200 hover:text-white hover:bg-indigo-600/30 flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <span>{sug}</span>
                        <span className="text-[10px] text-indigo-400 font-mono">+ add</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
