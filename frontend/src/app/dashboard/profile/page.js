'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/authContext';
import { api } from '@/lib/api';
import {
  User,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Code,
  Eye,
  Briefcase,
  GraduationCap,
  Save,
  Compass,
  Layers,
  ShieldCheck,
  Plus,
  Trash2
} from 'lucide-react';

export default function MasterProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [viewJson, setViewJson] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await api.get('/profile/master');
      setProfile(res.data);
    } catch (err) {
      setError('No Master Profile found yet. Upload your resume in Onboarding.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setMsg('');
    try {
      const res = await api.put('/profile/master', profile);
      setProfile(res.data);
      setMsg('Master Profile successfully synchronized and saved!');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
            <p className="text-sm text-slate-400">Loading Master Profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 max-w-4xl mx-auto px-4 py-16 text-center">
          <div className="glass-panel p-10 rounded-2xl">
            <User className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">No Master Profile Found</h2>
            <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
              To begin discovering and auto-applying to jobs, please upload and parse your resume.
            </p>
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/25"
            >
              <span>Go to Resume Onboarding</span>
              <Compass className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-white/10 gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                Candidate Core
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold">
                Single Source of Truth
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
              Master Profile Editor
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              All tailored resumes and application forms are synthesized exclusively from this verified profile.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setViewJson(!viewJson)}
              className="px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1.5"
            >
              {viewJson ? <Eye className="w-3.5 h-3.5" /> : <Code className="w-3.5 h-3.5" />}
              <span>{viewJson ? 'Visual Editor' : 'JSON Schema'}</span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition-all"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Save Changes</span>
            </button>
          </div>
        </div>

        {/* Alerts */}
        {msg && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{msg}</span>
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {viewJson ? (
          <div className="glass-panel p-6 rounded-2xl">
            <pre className="text-xs text-indigo-300 bg-slate-950 p-4 rounded-xl overflow-x-auto max-h-[600px] leading-relaxed">
              {JSON.stringify(profile, null, 2)}
            </pre>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Contact Info */}
            <div className="glass-panel p-6 rounded-2xl space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-400" />
                Contact Information
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-medium text-slate-400">Full Name</label>
                  <input
                    type="text"
                    value={profile.contact_info?.full_name || ''}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        contact_info: { ...profile.contact_info, full_name: e.target.value },
                      })
                    }
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-400">Email Address</label>
                  <input
                    type="email"
                    value={profile.contact_info?.email || ''}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        contact_info: { ...profile.contact_info, email: e.target.value },
                      })
                    }
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-400">Phone</label>
                  <input
                    type="text"
                    value={profile.contact_info?.phone || ''}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        contact_info: { ...profile.contact_info, phone: e.target.value },
                      })
                    }
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-400">Location</label>
                  <input
                    type="text"
                    value={profile.contact_info?.location || ''}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        contact_info: { ...profile.contact_info, location: e.target.value },
                      })
                    }
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-400">LinkedIn</label>
                  <input
                    type="text"
                    value={profile.contact_info?.linkedin || ''}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        contact_info: { ...profile.contact_info, linkedin: e.target.value },
                      })
                    }
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-400">GitHub</label>
                  <input
                    type="text"
                    value={profile.contact_info?.github || ''}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        contact_info: { ...profile.contact_info, github: e.target.value },
                      })
                    }
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="glass-panel p-6 rounded-2xl space-y-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                Professional Summary
              </h2>
              <textarea
                rows={3}
                value={profile.summary || ''}
                onChange={(e) => setProfile({ ...profile, summary: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs leading-relaxed"
              />
            </div>

            {/* Skills */}
            <div className="glass-panel p-6 rounded-2xl space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                Technical Skills Inventory
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(profile.skills || {}).map(([cat, list]) => (
                  <div key={cat} className="glass-card p-4 rounded-xl space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      {cat.replace('_', ' ')}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(list || []).map((skill) => (
                        <span
                          key={skill}
                          className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Experience */}
            <div className="glass-panel p-6 rounded-2xl space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-cyan-400" />
                Experience History
              </h2>
              <div className="space-y-4">
                {(profile.experience || []).map((exp, idx) => (
                  <div key={idx} className="glass-card p-4 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">{exp.role}</span>
                      <span className="text-xs text-slate-400">
                        {exp.start_date} - {exp.end_date}
                      </span>
                    </div>
                    <div className="text-xs text-indigo-400 font-medium">
                      {exp.company} • {exp.location || 'Remote'}
                    </div>
                    <ul className="list-disc list-inside text-xs text-slate-300 space-y-1 mt-2">
                      {(exp.bullets || []).map((b, bIdx) => (
                        <li key={bIdx}>{b}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
