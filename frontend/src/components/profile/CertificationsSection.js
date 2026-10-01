'use client';

import React, { useState } from 'react';
import { Award, Plus, Trash2, ExternalLink } from 'lucide-react';

export default function CertificationsSection({
  certifications = [],
  onChange,
}) {
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState(null);

  const addCertification = () => {
    onChange([
      ...certifications,
      {
        name: '',
        issuer: '',
        date: '',
        url: '',
      },
    ]);
  };

  const updateCert = (idx, field, value) => {
    const updated = [...certifications];
    updated[idx] = {
      ...updated[idx],
      [field]: value,
    };
    onChange(updated);
  };

  const removeCert = (idx) => {
    onChange(certifications.filter((_, i) => i !== idx));
    setConfirmDeleteIdx(null);
  };

  return (
    <div id="section-certifications" className="glass-panel p-6 sm:p-7 rounded-2xl space-y-5 border border-white/10 shadow-lg">
      <div className="flex items-center justify-between pb-3 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Award className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">Certifications & Licenses</h2>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold">
                {certifications.length}
              </span>
            </div>
            <p className="text-xs text-slate-400">Industry credentials, cloud certifications (AWS, GCP, CKA), and accreditations</p>
          </div>
        </div>

        <button
          type="button"
          onClick={addCertification}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-300 text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add Certification</span>
        </button>
      </div>

      {certifications.length === 0 ? (
        <div className="p-8 rounded-xl bg-slate-900/40 border border-dashed border-white/10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800/60 flex items-center justify-center mx-auto text-slate-500">
            <Award className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-slate-300">No certifications added yet</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Add cloud badges, security accreditations, or specialized technical certifications to strengthen your profile.
          </p>
          <button
            type="button"
            onClick={addCertification}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 text-xs font-semibold cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Certification</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {certifications.map((cert, idx) => (
            <div
              key={idx}
              className="glass-card p-5 rounded-xl space-y-3.5 relative border border-white/10 bg-slate-900/40 transition-all hover:border-white/20"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Certification #{idx + 1}
                </span>

                {confirmDeleteIdx === idx ? (
                  <div className="flex items-center gap-1.5 bg-rose-500/20 border border-rose-500/40 px-2.5 py-1 rounded-lg text-xs ml-2">
                    <span className="text-rose-300 text-[11px]">Delete?</span>
                    <button
                      type="button"
                      onClick={() => removeCert(idx)}
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
                    title="Remove certification"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                <div>
                  <label className="block text-[13px] font-medium text-slate-300 mb-1">
                    Certification Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. AWS Solutions Architect"
                    value={cert.name || ''}
                    onChange={(e) => updateCert(idx, 'name', e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-slate-900 border border-white/10 text-white text-[14px] sm:text-[15px] focus:border-amber-500 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-slate-300 mb-1">
                    Issuing Organization *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Amazon Web Services"
                    value={cert.issuer || ''}
                    onChange={(e) => updateCert(idx, 'issuer', e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-slate-900 border border-white/10 text-white text-[14px] sm:text-[15px] focus:border-amber-500 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-slate-300 mb-1">
                    Issue Date
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Nov 2023"
                    value={cert.date || ''}
                    onChange={(e) => updateCert(idx, 'date', e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-slate-900 border border-white/10 text-white text-[14px] sm:text-[15px] focus:border-amber-500 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-slate-300 mb-1">
                    Credential URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://credly.com/..."
                    value={cert.url || ''}
                    onChange={(e) => updateCert(idx, 'url', e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-slate-900 border border-white/10 text-white text-[14px] sm:text-[15px] focus:border-amber-500 focus:outline-none transition-all"
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
