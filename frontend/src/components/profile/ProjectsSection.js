'use client';

import React, { useState } from 'react';
import {
  FolderGit2,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Github,
  ExternalLink,
  Sparkles,
  Loader2,
  AlertCircle,
  X,
  ChevronRight
} from 'lucide-react';
import { api } from '@/lib/api';
import { logger } from '@/lib/logger';

export default function ProjectsSection({
  projects = [],
  githubUrl = '',
  onChange,
}) {
  const [collapsed, setCollapsed] = useState({});
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState(null);
  const [techInputs, setTechInputs] = useState({});

  // GitHub suggestions state
  const [suggestions, setSuggestions] = useState({});
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsNotice, setSuggestionsNotice] = useState('');

  const toggleCollapse = (idx) => {
    setCollapsed((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const addProject = () => {
    const newIdx = projects.length;
    onChange([
      ...projects,
      {
        title: '',
        role: '',
        description: '',
        github_url: '',
        demo_url: '',
        tech_stack: [],
        bullets: [''],
        source: 'manual',
      },
    ]);
    setCollapsed((prev) => ({ ...prev, [newIdx]: false }));
  };

  const updateProject = (idx, field, value) => {
    const updated = [...projects];
    updated[idx] = {
      ...updated[idx],
      [field]: value,
    };
    onChange(updated);
  };

  const removeProject = (idx) => {
    onChange(projects.filter((_, i) => i !== idx));
    setConfirmDeleteIdx(null);
  };

  const moveProject = (idx, direction) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= projects.length) return;
    const updated = [...projects];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;
    onChange(updated);
  };

  const addTech = (idx, rawTech) => {
    const val = (rawTech || '').trim();
    if (!val) return;
    const updated = [...projects];
    const stack = updated[idx].tech_stack || [];
    if (!stack.includes(val)) {
      updated[idx] = {
        ...updated[idx],
        tech_stack: [...stack, val],
      };
      onChange(updated);
    }
    setTechInputs((prev) => ({ ...prev, [idx]: '' }));
  };

  const removeTech = (idx, techToRemove) => {
    const updated = [...projects];
    updated[idx] = {
      ...updated[idx],
      tech_stack: (updated[idx].tech_stack || []).filter((t) => t !== techToRemove),
    };
    onChange(updated);
  };

  const addBullet = (idx) => {
    const updated = [...projects];
    const bullets = [...(updated[idx].bullets || []), ''];
    updated[idx] = { ...updated[idx], bullets };
    onChange(updated);
  };

  const updateBullet = (projIdx, bIdx, val) => {
    const updated = [...projects];
    const bullets = [...(updated[projIdx].bullets || [])];
    bullets[bIdx] = val;
    updated[projIdx] = { ...updated[projIdx], bullets };
    onChange(updated);
  };

  const removeBullet = (projIdx, bIdx) => {
    const updated = [...projects];
    const bullets = (updated[projIdx].bullets || []).filter((_, i) => i !== bIdx);
    updated[projIdx] = { ...updated[projIdx], bullets };
    onChange(updated);
  };

  const fetchGithubRepoSuggestions = async () => {
    setSuggestionsLoading(true);
    setSuggestionsNotice('');
    try {
      const res = await api.get('/profile/projects/github-suggestions');
      if (res.data?.suggestions) {
        setSuggestions(res.data.suggestions);
        if (res.data.rate_limit_notice) {
          setSuggestionsNotice(res.data.rate_limit_notice);
        }
      }
    } catch (e) {
      logger.warn('Failed to fetch github suggestions:', e);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  return (
    <div id="section-projects" className="glass-panel p-6 sm:p-7 rounded-2xl space-y-5 border border-white/10 shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-white/5 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <FolderGit2 className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">Projects</h2>
              <span className="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold">
                {projects.length}
              </span>
            </div>
            <p className="text-xs text-slate-400">Featured applications, open source libraries, and production demos</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {githubUrl && (
            <button
              type="button"
              onClick={fetchGithubRepoSuggestions}
              disabled={suggestionsLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-white/10 text-slate-200 text-xs font-medium transition-all disabled:opacity-50 cursor-pointer shadow-sm"
              title="Fuzzy match projects to your public GitHub repositories"
            >
              {suggestionsLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
              ) : (
                <Github className="w-3.5 h-3.5 text-purple-400" />
              )}
              <span>{suggestionsLoading ? 'Finding repos...' : 'Find GitHub repos'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={addProject}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Project</span>
          </button>
        </div>
      </div>

      {suggestionsNotice && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{suggestionsNotice}</span>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="p-8 rounded-xl bg-slate-900/40 border border-dashed border-white/10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800/60 flex items-center justify-center mx-auto text-slate-500">
            <FolderGit2 className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-slate-300">No projects added yet</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Showcase your best side projects, full-stack web applications, hackathon entries, or open-source repositories.
          </p>
          <button
            type="button"
            onClick={addProject}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 text-xs font-semibold cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add First Project</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map((proj, idx) => {
            const isCardCollapsed = Boolean(collapsed[idx]);

            return (
              <div
                key={idx}
                className="glass-card p-5 rounded-xl space-y-4 relative border border-white/10 bg-slate-900/40 transition-all hover:border-white/20"
              >
                {/* Header & Controls */}
                <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                  <div
                    className="flex items-center gap-2 cursor-pointer select-none"
                    onClick={() => toggleCollapse(idx)}
                  >
                    <button
                      type="button"
                      className="p-1 text-slate-400 hover:text-white rounded"
                      title={isCardCollapsed ? 'Expand project' : 'Collapse project'}
                    >
                      <ChevronRight
                        className={`w-4 h-4 transition-transform duration-200 ${
                          !isCardCollapsed ? 'rotate-90 text-purple-400' : 'text-slate-500'
                        }`}
                      />
                    </button>
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
                      Project #{idx + 1}
                    </span>
                    <span className="text-xs text-slate-300 font-semibold truncate max-w-[200px] sm:max-w-md">
                      {proj.title || 'Untitled Project'}
                    </span>
                    {(proj.tech_stack || []).length > 0 && isCardCollapsed && (
                      <span className="hidden sm:inline-block text-[11px] text-slate-500 truncate max-w-xs">
                        ({proj.tech_stack.slice(0, 3).join(', ')}{proj.tech_stack.length > 3 ? '...' : ''})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => moveProject(idx, -1)}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                        title="Move up"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                    )}
                    {idx < projects.length - 1 && (
                      <button
                        type="button"
                        onClick={() => moveProject(idx, 1)}
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
                          onClick={() => removeProject(idx)}
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
                        title="Remove project"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Collapsible Content */}
                {!isCardCollapsed && (
                  <div className="space-y-4 pt-1 animate-in fade-in duration-200">
                    {/* Row 1: Title & Role */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-[13px] font-medium text-slate-300 mb-1">
                          Project Title *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Distributed Task Queue"
                          value={proj.title || ''}
                          onChange={(e) => updateProject(idx, 'title', e.target.value)}
                          className="w-full h-10 px-3.5 rounded-xl bg-slate-900 border border-white/10 text-white text-[14px] sm:text-[15px] focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/30 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[13px] font-medium text-slate-300 mb-1">
                          Role / Contribution <span className="text-slate-500 font-normal">(optional)</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Creator / Full-Stack Engineer"
                          value={proj.role || ''}
                          onChange={(e) => updateProject(idx, 'role', e.target.value)}
                          className="w-full h-10 px-3.5 rounded-xl bg-slate-900 border border-white/10 text-white text-[14px] sm:text-[15px] focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/30 transition-all"
                        />
                      </div>
                    </div>

                    {/* Row 2: Short Description */}
                    <div>
                      <label className="block text-[13px] font-medium text-slate-300 mb-1">
                        Short Description <span className="text-slate-500 font-normal">(1-2 sentence architectural overview)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Brief overview of the project architecture and what problem it solves..."
                        value={proj.description || ''}
                        onChange={(e) => updateProject(idx, 'description', e.target.value)}
                        className="w-full h-10 px-3.5 rounded-xl bg-slate-900 border border-white/10 text-white text-[14px] sm:text-[15px] focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/30 transition-all"
                      />
                    </div>

                    {/* Row 3: GitHub Repo URL & Live Demo */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[13px] font-medium text-slate-300 flex items-center gap-1.5">
                            <Github className="w-3.5 h-3.5 text-slate-400" />
                            <span>GitHub Repository URL</span>
                          </label>
                          {proj.source === 'github_suggestion' ? (
                            <span className="text-[10px] font-medium text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-indigo-400" />
                              GitHub suggestion
                            </span>
                          ) : !proj.github_url ? (
                            <span className="text-[10px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                              Missing • Check this
                            </span>
                          ) : null}
                        </div>
                        <input
                          type="url"
                          placeholder="https://github.com/username/project"
                          value={proj.github_url || ''}
                          onChange={(e) => {
                            updateProject(idx, 'github_url', e.target.value);
                            updateProject(idx, 'source', 'manual');
                          }}
                          className="w-full h-10 px-3.5 rounded-xl bg-slate-900 border border-white/10 text-white text-[14px] sm:text-[15px] focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/30 transition-all"
                        />

                        {/* GitHub Suggestion Chips */}
                        {suggestions[proj.title] && suggestions[proj.title].length > 0 && !proj.github_url && (
                          <div className="mt-2 p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 space-y-1.5">
                            <div className="text-[11px] font-medium text-indigo-300 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Suggested from your GitHub repositories:</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {suggestions[proj.title].map((sug, sIdx) => (
                                <button
                                  key={sIdx}
                                  type="button"
                                  onClick={() => {
                                    updateProject(idx, 'github_url', sug.url);
                                    updateProject(idx, 'source', 'github_suggestion');
                                  }}
                                  className="text-xs px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-400/30 text-indigo-200 flex items-center gap-1.5 transition-all text-left cursor-pointer group"
                                  title={sug.description || sug.repo_name}
                                >
                                  <Github className="w-3 h-3 text-indigo-300 group-hover:text-white" />
                                  <span className="font-semibold">{sug.repo_name}</span>
                                  <span className="text-[10px] text-indigo-300/70">({sug.score}%)</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[13px] font-medium text-slate-300 flex items-center gap-1.5">
                            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                            <span>Live Demo URL</span>
                          </label>
                          {!proj.demo_url && (
                            <span className="text-[11px] text-slate-500 italic">Optional</span>
                          )}
                        </div>
                        <input
                          type="url"
                          placeholder="https://myproject.vercel.app"
                          value={proj.demo_url || ''}
                          onChange={(e) => updateProject(idx, 'demo_url', e.target.value)}
                          className="w-full h-10 px-3.5 rounded-xl bg-slate-900 border border-white/10 text-white text-[14px] sm:text-[15px] focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/30 transition-all"
                        />
                      </div>
                    </div>

                    {/* Row 4: Tech Stack Chips */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[13px] font-medium text-slate-300">
                          Technologies Used
                        </label>
                        <span className="text-[11px] text-slate-500">
                          {(proj.tech_stack || []).length} technologies
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[36px]">
                        {(proj.tech_stack || []).map((tech) => (
                          <span
                            key={tech}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-200 text-xs font-medium"
                          >
                            <span>{tech}</span>
                            <button
                              type="button"
                              onClick={() => removeTech(idx, tech)}
                              className="text-purple-400 hover:text-rose-400 ml-0.5 cursor-pointer"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Add technology (e.g. Next.js, FastAPI, Redis) & press Enter..."
                          value={techInputs[idx] || ''}
                          onChange={(e) =>
                            setTechInputs((prev) => ({ ...prev, [idx]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addTech(idx, techInputs[idx]);
                            }
                          }}
                          className="flex-1 h-9 px-3 rounded-lg bg-slate-950 border border-white/10 text-white text-xs focus:border-purple-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => addTech(idx, techInputs[idx])}
                          className="h-9 px-3.5 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 text-xs font-semibold cursor-pointer transition-colors"
                        >
                          + Add
                        </button>
                      </div>
                    </div>

                    {/* Row 5: Bullet Points */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[13px] font-medium text-slate-300">
                          Key Highlights & Architecture Points
                        </label>
                        <button
                          type="button"
                          onClick={() => addBullet(idx)}
                          className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 font-medium cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Bullet</span>
                        </button>
                      </div>
                      <div className="space-y-2">
                        {(proj.bullets || []).map((bullet, bIdx) => (
                          <div key={bIdx} className="flex items-center gap-2">
                            <span className="text-purple-400 text-sm font-mono">•</span>
                            <input
                              type="text"
                              value={bullet}
                              onChange={(e) => updateBullet(idx, bIdx, e.target.value)}
                              placeholder="e.g. Engineered task queue pipeline with Redis & FastAPI with 99.9% uptime..."
                              className="flex-1 h-10 px-3.5 rounded-xl bg-slate-950 border border-white/10 text-white text-[14px] sm:text-[15px] focus:border-purple-500 focus:outline-none transition-all placeholder:text-slate-600"
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
                        {(proj.bullets || []).length === 0 && (
                          <button
                            type="button"
                            onClick={() => addBullet(idx)}
                            className="w-full py-2.5 border border-dashed border-white/10 rounded-xl text-xs text-slate-400 hover:text-purple-300 hover:border-purple-500/30 text-center transition-all cursor-pointer"
                          >
                            + Add first project highlight bullet
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
