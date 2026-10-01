'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Globe,
  MapPin,
  Shield,
  Plane,
  Building,
  Check,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { api } from '@/lib/api';

export default function LocationSettingsModal({ isOpen, onClose, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [countries, setCountries] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    home_country: 'IN',
    home_city: '',
    preferred_cities: [],
    citizenship: 'IN',
    work_authorization_countries: ['IN'],
    needs_visa_sponsorship: false,
    willing_to_relocate: false,
    open_to_international: false,
  });

  const [preferredCityInput, setPreferredCityInput] = useState('');
  const [authCountryInput, setAuthCountryInput] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    async function loadData() {
      setLoading(true);
      setError('');
      try {
        const [cRes, sRes] = await Promise.all([
          api.get('/countries'),
          api.get('/settings/location')
        ]);
        if (Array.isArray(cRes.data)) setCountries(cRes.data);
        if (sRes.data) {
          setForm({
            home_country: sRes.data.home_country || 'IN',
            home_city: sRes.data.home_city || '',
            preferred_cities: sRes.data.preferred_cities || [],
            citizenship: sRes.data.citizenship || 'IN',
            work_authorization_countries: sRes.data.work_authorization_countries || ['IN'],
            needs_visa_sponsorship: Boolean(sRes.data.needs_visa_sponsorship),
            willing_to_relocate: Boolean(sRes.data.willing_to_relocate),
            open_to_international: Boolean(sRes.data.open_to_international),
          });
        }
      } catch (err) {
        console.error('Error loading location settings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddPreferredCity = () => {
    if (preferredCityInput.trim() && !form.preferred_cities.includes(preferredCityInput.trim())) {
      setForm({
        ...form,
        preferred_cities: [...form.preferred_cities, preferredCityInput.trim()]
      });
      setPreferredCityInput('');
    }
  };

  const handleRemovePreferredCity = (city) => {
    setForm({
      ...form,
      preferred_cities: form.preferred_cities.filter((c) => c !== city)
    });
  };

  const handleAddAuthCountry = (code) => {
    const clean = code.trim().toUpperCase();
    if (clean && !form.work_authorization_countries.includes(clean)) {
      setForm({
        ...form,
        work_authorization_countries: [...form.work_authorization_countries, clean]
      });
    }
  };

  const handleRemoveAuthCountry = (code) => {
    setForm({
      ...form,
      work_authorization_countries: form.work_authorization_countries.filter((c) => c !== code)
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.put('/settings/location', form);
      setSuccess('Location and remote work settings updated!');
      if (onSaved) onSaved(res.data);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update location settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-panel w-full max-w-xl max-h-[90vh] rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden bg-slate-900/95">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Country & Remote Work Settings</h2>
              <p className="text-xs text-slate-400">
                Drives your country-first ranking, local currency, and remote eligibility checks.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
            <span className="text-xs text-slate-400">Loading location profile...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Home Country */}
              <div>
                <label className="text-xs font-semibold text-slate-300">Home Country</label>
                <select
                  value={form.home_country}
                  onChange={(e) => setForm({ ...form, home_country: e.target.value })}
                  className="w-full mt-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white"
                >
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Citizenship */}
              <div>
                <label className="text-xs font-semibold text-slate-300">Citizenship / Passport</label>
                <select
                  value={form.citizenship}
                  onChange={(e) => setForm({ ...form, citizenship: e.target.value })}
                  className="w-full mt-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white"
                >
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Home City */}
              <div>
                <label className="text-xs font-semibold text-slate-300">Home City</label>
                <input
                  type="text"
                  placeholder="e.g. Bengaluru, Berlin, London..."
                  value={form.home_city || ''}
                  onChange={(e) => setForm({ ...form, home_city: e.target.value })}
                  className="w-full mt-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white placeholder:text-slate-500"
                />
              </div>

              {/* Work Authorization Multi-select */}
              <div>
                <label className="text-xs font-semibold text-slate-300">Work Authorization</label>
                <div className="flex gap-2 mt-1.5">
                  <select
                    value={authCountryInput}
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddAuthCountry(e.target.value);
                        setAuthCountryInput('');
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white"
                  >
                    <option value="">+ Add Authorized Country</option>
                    {countries.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.work_authorization_countries.map((code) => (
                    <span
                      key={code}
                      className="px-2 py-0.5 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[11px] font-mono flex items-center gap-1"
                    >
                      {code}
                      <button
                        type="button"
                        onClick={() => handleRemoveAuthCountry(code)}
                        className="hover:text-rose-400"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Preferred Cities */}
            <div>
              <label className="text-xs font-semibold text-slate-300">Preferred Cities (Tier 1 Ranking)</label>
              <div className="flex gap-2 mt-1.5">
                <input
                  type="text"
                  placeholder="Type city and press Add (e.g. Pune, Gurgaon)..."
                  value={preferredCityInput}
                  onChange={(e) => setPreferredCityInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddPreferredCity();
                    }
                  }}
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={handleAddPreferredCity}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.preferred_cities.map((city) => (
                  <span
                    key={city}
                    className="px-2 py-0.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-[11px] flex items-center gap-1"
                  >
                    {city}
                    <button
                      type="button"
                      onClick={() => handleRemovePreferredCity(city)}
                      className="hover:text-rose-400"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Checkboxes */}
            <div className="space-y-3 pt-2 border-t border-white/5">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={form.needs_visa_sponsorship}
                  onChange={(e) => setForm({ ...form, needs_visa_sponsorship: e.target.checked })}
                  className="w-4 h-4 rounded bg-slate-900 border-white/20 text-indigo-500"
                />
                <span>I require visa sponsorship for international positions</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={form.willing_to_relocate}
                  onChange={(e) => setForm({ ...form, willing_to_relocate: e.target.checked })}
                  className="w-4 h-4 rounded bg-slate-900 border-white/20 text-indigo-500"
                />
                <span>Willing to relocate for the right opportunity</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={form.open_to_international}
                  onChange={(e) => setForm({ ...form, open_to_international: e.target.checked })}
                  className="w-4 h-4 rounded bg-slate-900 border-white/20 text-indigo-500"
                />
                <span>Open to international roles (shows Tier 4 international jobs in feed)</span>
              </label>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/25 active:scale-95 transition-all disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Settings...</span>
                  </>
                ) : (
                  <span>Save Location Preferences</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
