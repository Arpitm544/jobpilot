'use client';

import React from 'react';
import { User, Mail, Phone, MapPin, Linkedin, Github, Globe, Code2, AlertCircle } from 'lucide-react';

export default function ContactSection({
  contactInfo = {},
  onChange,
  getFieldBadge,
}) {
  const updateField = (field, value) => {
    onChange({
      ...contactInfo,
      [field]: value,
    });
  };

  const phoneValue = contactInfo.phone || '';
  const isPhoneMissing = !phoneValue.trim();

  return (
    <div id="section-contact" className="glass-panel p-6 sm:p-7 rounded-2xl space-y-5 border border-white/10 scroll-mt-24">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <h3 className="text-lg font-bold text-white flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <User className="w-4 h-4" />
          </div>
          <span>Contact & Identification</span>
        </h3>
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Primary Identity
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5">
        {/* Full Name */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="contact-full-name" className="text-[13px] font-medium text-slate-300">
              Full Name <span className="text-rose-400">*</span>
            </label>
            {getFieldBadge?.('contact_info.full_name')}
          </div>
          <div className="relative">
            <input
              id="contact-full-name"
              type="text"
              placeholder="e.g. John Doe"
              value={contactInfo.full_name || ''}
              onChange={(e) => updateField('full_name', e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl bg-slate-900/90 border border-white/10 text-white text-[14px] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all placeholder:text-slate-500"
              required
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="contact-email" className="text-[13px] font-medium text-slate-300">
              Email Address <span className="text-rose-400">*</span>
            </label>
            {getFieldBadge?.('contact_info.email')}
          </div>
          <div className="relative">
            <input
              id="contact-email"
              type="email"
              placeholder="e.g. alex@example.com"
              value={contactInfo.email || ''}
              onChange={(e) => updateField('email', e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl bg-slate-900/90 border border-white/10 text-white text-[14px] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all placeholder:text-slate-500"
              required
            />
          </div>
        </div>

        {/* Phone */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="contact-phone" className="text-[13px] font-medium text-slate-300 flex items-center gap-1.5">
              <span>Phone</span>
            </label>
            {isPhoneMissing ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                <AlertCircle className="w-3 h-3 text-amber-400" />
                Missing
              </span>
            ) : (
              getFieldBadge?.('contact_info.phone')
            )}
          </div>
          <input
            id="contact-phone"
            type="tel"
            placeholder="e.g. +91 98765 43210"
            value={phoneValue}
            onChange={(e) => updateField('phone', e.target.value)}
            className="w-full h-10 px-3.5 rounded-xl bg-slate-900/90 border border-white/10 text-white text-[14px] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all placeholder:text-slate-500"
          />
        </div>

        {/* Location */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="contact-location" className="text-[13px] font-medium text-slate-300">
              Location
            </label>
            {getFieldBadge?.('contact_info.location')}
          </div>
          <input
            id="contact-location"
            type="text"
            placeholder="e.g. San Francisco, CA or Bengaluru, India"
            value={contactInfo.location || ''}
            onChange={(e) => updateField('location', e.target.value)}
            className="w-full h-10 px-3.5 rounded-xl bg-slate-900/90 border border-white/10 text-white text-[14px] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all placeholder:text-slate-500"
          />
        </div>

        {/* LinkedIn */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="contact-linkedin" className="text-[13px] font-medium text-slate-300 flex items-center gap-1.5">
              <Linkedin className="w-3.5 h-3.5 text-blue-400" />
              <span>LinkedIn URL</span>
            </label>
            {getFieldBadge?.('contact_info.linkedin')}
          </div>
          <input
            id="contact-linkedin"
            type="url"
            placeholder="https://linkedin.com/in/username"
            value={contactInfo.linkedin || ''}
            onChange={(e) => updateField('linkedin', e.target.value)}
            className="w-full h-10 px-3.5 rounded-xl bg-slate-900/90 border border-white/10 text-white text-[14px] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all placeholder:text-slate-500"
          />
        </div>

        {/* GitHub */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="contact-github" className="text-[13px] font-medium text-slate-300 flex items-center gap-1.5">
              <Github className="w-3.5 h-3.5 text-slate-300" />
              <span>GitHub URL</span>
            </label>
            {getFieldBadge?.('contact_info.github')}
          </div>
          <input
            id="contact-github"
            type="url"
            placeholder="https://github.com/username"
            value={contactInfo.github || ''}
            onChange={(e) => updateField('github', e.target.value)}
            className="w-full h-10 px-3.5 rounded-xl bg-slate-900/90 border border-white/10 text-white text-[14px] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all placeholder:text-slate-500"
          />
        </div>

        {/* Portfolio */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="contact-portfolio" className="text-[13px] font-medium text-slate-300 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>Portfolio / Website</span>
            </label>
            {getFieldBadge?.('contact_info.portfolio')}
          </div>
          <input
            id="contact-portfolio"
            type="url"
            placeholder="https://myportfolio.dev"
            value={contactInfo.portfolio || ''}
            onChange={(e) => updateField('portfolio', e.target.value)}
            className="w-full h-10 px-3.5 rounded-xl bg-slate-900/90 border border-white/10 text-white text-[14px] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all placeholder:text-slate-500"
          />
        </div>

        {/* LeetCode */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="contact-leetcode" className="text-[13px] font-medium text-slate-300 flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5 text-amber-400" />
              <span>LeetCode Profile</span>
            </label>
          </div>
          <input
            id="contact-leetcode"
            type="url"
            placeholder="https://leetcode.com/u/username"
            value={contactInfo.leetcode || ''}
            onChange={(e) => updateField('leetcode', e.target.value)}
            className="w-full h-10 px-3.5 rounded-xl bg-slate-900/90 border border-white/10 text-white text-[14px] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all placeholder:text-slate-500"
          />
        </div>

        {/* Codeforces */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="contact-codeforces" className="text-[13px] font-medium text-slate-300 flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Codeforces / Competitive</span>
            </label>
          </div>
          <input
            id="contact-codeforces"
            type="url"
            placeholder="https://codeforces.com/profile/handle"
            value={contactInfo.codeforces || ''}
            onChange={(e) => updateField('codeforces', e.target.value)}
            className="w-full h-10 px-3.5 rounded-xl bg-slate-900/90 border border-white/10 text-white text-[14px] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all placeholder:text-slate-500"
          />
        </div>
      </div>
    </div>
  );
}
