'use client';

import React, { useState } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  Power, 
  Clock, 
  Activity, 
  CheckCircle2, 
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { api } from '@/lib/api';

export default function SafetyControls({ 
  safetyStatus, 
  onStatusUpdated, 
  connected, 
  agentStatus 
}) {
  const [loading, setLoading] = useState(false);

  const toggleKillSwitch = async () => {
    try {
      setLoading(true);
      const res = await api.post('/apply/kill-switch', {
        kill_switch: !safetyStatus?.kill_switch_active,
      });
      if (onStatusUpdated) {
        onStatusUpdated(res.data.kill_switch_active);
      }
    } catch (err) {
      console.error('Failed to toggle kill switch:', err);
    } finally {
      setLoading(false);
    }
  };

  const isKillActive = safetyStatus?.kill_switch_active;
  const dailyCap = safetyStatus?.daily_cap || 15;
  const appliedToday = safetyStatus?.applied_today || 0;
  const percentUsed = Math.min(100, Math.round((appliedToday / dailyCap) * 100));

  return (
    <div className="space-y-3 mb-6">
      {/* Kill Switch Banner if Active */}
      {isKillActive && (
        <div className="bg-red-500/15 border-2 border-red-500/60 rounded-xl p-4 flex items-center justify-between animate-pulse shadow-lg shadow-red-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center text-red-400">
              <ShieldAlert className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <h4 className="text-red-300 font-bold text-base flex items-center gap-2">
                EMERGENCY KILL SWITCH ENGAGED
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/30 text-red-200 border border-red-500/40">
                  ALL AGENTS HALTED
                </span>
              </h4>
              <p className="text-xs text-red-200/80">
                All background job discovery, tailoring, and automated applying tasks are paused immediately.
              </p>
            </div>
          </div>
          <button
            onClick={toggleKillSwitch}
            disabled={loading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg transition-all shadow-md flex items-center gap-2 shrink-0 cursor-pointer"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
            Resume Agents
          </button>
        </div>
      )}

      {/* Safety & Real-Time Monitoring Bar */}
      <div className="bg-[#121624]/80 backdrop-blur-md border border-white/10 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        {/* Left: Quota & Live Agent Status */}
        <div className="flex items-center flex-wrap gap-6">
          {/* Daily Quota Meter */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <div className="flex items-center justify-between gap-3 text-xs mb-1">
                <span className="text-gray-400 font-medium flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-400" /> Daily Cap Quota
                </span>
                <span className="font-bold text-white">
                  {appliedToday} <span className="text-gray-400 font-normal">/ {dailyCap}</span>
                </span>
              </div>
              <div className="w-36 h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    percentUsed >= 100
                      ? 'bg-red-500'
                      : percentUsed >= 70
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${percentUsed}%` }}
                />
              </div>
            </div>
          </div>

          <div className="h-8 w-px bg-white/10 hidden sm:block" />

          {/* Real-time Agent Telemetry / Activity Pill */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span className="text-gray-300 font-medium">
                {connected ? 'Live Agent Fleet' : 'Connecting Stream...'}
              </span>
            </div>

            {agentStatus && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-xs text-blue-300 animate-fadeIn">
                <Activity className="w-3.5 h-3.5 animate-spin" />
                <span className="truncate max-w-[280px]">{agentStatus}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Guardrails Pill & Kill Switch Button */}
        <div className="flex items-center gap-3 ml-auto">
          <div className="hidden lg:flex items-center gap-2 text-xs text-gray-400 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Human Jitter (5-12s)</span>
            <span className="text-white/20">•</span>
            <span>Zero Fabrication</span>
          </div>

          {!isKillActive ? (
            <button
              onClick={toggleKillSwitch}
              disabled={loading}
              className="px-3.5 py-1.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 hover:border-red-500/80 text-red-300 font-semibold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Stop all automated agents immediately"
            >
              <Power className="w-3.5 h-3.5 text-red-400" />
              {loading ? 'Halting...' : 'Kill Switch'}
            </button>
          ) : (
            <button
              onClick={toggleKillSwitch}
              disabled={loading}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Power className="w-3.5 h-3.5" />
              {loading ? 'Resuming...' : 'Resume Fleet'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
