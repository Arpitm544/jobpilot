'use client';

import React, { useState } from 'react';
import { GraduationCap, Plus, Trash2, ChevronUp, ChevronDown, Award } from 'lucide-react';

export default function EducationSection({
  education = [],
  onChange,
}) {
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState(null);

  const addEducation = () => {
    onChange([
      ...education,
      {
        institution: '',
        degree: '',
        field_of_study: '',
        start_year: '',
        end_year: '',
        grade_type: 'CGPA',
        grade_value: '',
        secondary_percentage: '',
      },
    ]);
  };

  const updateEducation = (idx, field, value) => {
    const updated = [...education];
    updated[idx] = {
      ...updated[idx],
      [field]: value,
    };
    onChange(updated);
  };

  const removeEducation = (idx) => {
    onChange(education.filter((_, i) => i !== idx));
    setConfirmDeleteIdx(null);
  };

  const moveEducation = (idx, direction) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= education.length) return;
    const updated = [...education];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;
    onChange(updated);
  };

  return (
    <div id="section-education" className="glass-panel p-6 sm:p-7 rounded-2xl space-y-5 border border-white/10 shadow-lg">
      <div className="flex items-center justify-between pb-3 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <GraduationCap className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">Education</h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold">
                {education.length}
              </span>
            </div>
            <p className="text-xs text-slate-400">Degrees, academic performance, and secondary credentials</p>
          </div>
        </div>

        <button
          type="button"
          onClick={addEducation}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add Education</span>
        </button>
      </div>

      {education.length === 0 ? (
        <div className="p-8 rounded-xl bg-slate-900/40 border border-dashed border-white/10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800/60 flex items-center justify-center mx-auto text-slate-500">
            <GraduationCap className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-slate-300">No education credentials added yet</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Add your university degree, bootcamp, or secondary school credentials to establish your academic credentials.
          </p>
          <button
            type="button"
            onClick={addEducation}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 text-xs font-semibold cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Education Entry</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {education.map((edu, idx) => (
            <div
              key={idx}
              className="glass-card p-5 rounded-xl space-y-4 relative border border-white/10 bg-slate-900/40 transition-all hover:border-white/20"
            >
              {/* Card Header & Reorder Controls */}
              <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Degree #{idx + 1}
                  </span>
                  <span className="text-xs text-slate-300 font-medium truncate max-w-[240px] sm:max-w-md">
                    {edu.institution ? edu.institution : 'New Education Entry'}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={() => moveEducation(idx, -1)}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                      title="Move up"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                  )}
                  {idx < education.length - 1 && (
                    <button
                      type="button"
                      onClick={() => moveEducation(idx, 1)}
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
                        onClick={() => removeEducation(idx)}
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
                      title="Remove education"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Row 1: Institution, Degree, Field */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-[13px] font-medium text-slate-300 mb-1">
                    Institution / University *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UC Berkeley, IIT Bombay"
                    value={edu.institution || ''}
                    onChange={(e) => updateEducation(idx, 'institution', e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-slate-900 border border-white/10 text-white text-[14px] sm:text-[15px] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-slate-300 mb-1">
                    Degree / Qualification *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. B.S., B.Tech, M.S."
                    value={edu.degree || ''}
                    onChange={(e) => updateEducation(idx, 'degree', e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-slate-900 border border-white/10 text-white text-[14px] sm:text-[15px] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-slate-300 mb-1">
                    Field of Study / Major
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Computer Science"
                    value={edu.field_of_study || ''}
                    onChange={(e) => updateEducation(idx, 'field_of_study', e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-slate-900 border border-white/10 text-white text-[14px] sm:text-[15px] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all"
                  />
                </div>
              </div>

              {/* Row 2: Start, End, Grade Type, Grade Value */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div>
                  <label className="block text-[13px] font-medium text-slate-300 mb-1">
                    Start Year
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2020"
                    value={edu.start_year || ''}
                    onChange={(e) => updateEducation(idx, 'start_year', e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-slate-900 border border-white/10 text-white text-[14px] sm:text-[15px] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-slate-300 mb-1">
                    End Year / Expected
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2024 or Present"
                    value={edu.end_year || ''}
                    onChange={(e) => updateEducation(idx, 'end_year', e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-slate-900 border border-white/10 text-white text-[14px] sm:text-[15px] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-slate-300 mb-1">
                    Grade Metric
                  </label>
                  <select
                    value={edu.grade_type || 'CGPA'}
                    onChange={(e) => updateEducation(idx, 'grade_type', e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-white/10 text-white text-[14px] focus:border-indigo-500 focus:outline-none transition-all cursor-pointer"
                  >
                    <option value="CGPA">CGPA (out of 10 or 4)</option>
                    <option value="Percentage">Percentage (%)</option>
                    <option value="GPA">GPA (out of 4.0)</option>
                    <option value="Grade">Letter Grade</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-slate-300 mb-1">
                    Score / CGPA
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 8.7 or 3.8 / 4.0"
                    value={edu.grade_value || ''}
                    onChange={(e) => updateEducation(idx, 'grade_value', e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-slate-900 border border-white/10 text-white text-[14px] sm:text-[15px] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all"
                  />
                </div>
              </div>

              {/* Row 3: 10th and 12th / Secondary % */}
              <div>
                <label className="block text-[13px] font-medium text-slate-300 mb-1">
                  Secondary / Higher Secondary % <span className="text-slate-500 font-normal">(10th / 12th Grade, optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 10th: 92%, 12th: 94%"
                  value={edu.secondary_percentage || ''}
                  onChange={(e) => updateEducation(idx, 'secondary_percentage', e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl bg-slate-900 border border-white/10 text-white text-[14px] sm:text-[15px] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
