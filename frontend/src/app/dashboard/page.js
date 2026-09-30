'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/authContext';
import { api } from '@/lib/api';
import ReviewModal from '@/components/pipeline/ReviewModal';
import TailorModal from '@/components/tailor/TailorModal';
import SafetyControls from '@/components/dashboard/SafetyControls';
import LiveActivityDrawer from '@/components/dashboard/LiveActivityDrawer';
import { useSocket } from '@/hooks/useSocket';
import {
  Layers,
  Sparkles,
  Camera,
  CheckCircle2,
  Clock,
  Send,
  AlertCircle,
  Loader2,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  ShieldCheck,
  Building2,
  MapPin,
  FileCheck,
  Terminal,
  PlayCircle,
  Zap
} from 'lucide-react';

const COLUMNS = [
  { id: 'discovered', label: 'Discovered', color: 'border-slate-700/60 bg-slate-900/20' },
  { id: 'queued', label: 'Queued for Tailor', color: 'border-indigo-500/30 bg-indigo-950/10' },
  { id: 'tailored', label: 'AI Tailored', color: 'border-cyan-500/30 bg-cyan-950/10' },
  { id: 'review_ready', label: 'Review Ready (Proof)', color: 'border-amber-500/40 bg-amber-950/15' },
  { id: 'applied', label: 'Applied', color: 'border-emerald-500/30 bg-emerald-950/10' },
  { id: 'interview', label: 'Interview / Offer', color: 'border-violet-500/40 bg-violet-950/20' },
];

export default function DashboardPipelinePage() {
  const { user } = useAuth();
  const [pipeline, setPipeline] = useState({
    discovered: [],
    queued: [],
    tailored: [],
    review_ready: [],
    applied: [],
    interview: [],
    offer: [],
    rejected: [],
  });
  const [safetyStatus, setSafetyStatus] = useState({
    daily_cap: 15,
    applied_today: 0,
    remaining_today: 15,
    kill_switch_active: false,
    apply_mode: 'review_then_apply',
    is_cap_reached: false,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [queueingBatch, setQueueingBatch] = useState(false);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [selectedReviewApp, setSelectedReviewApp] = useState(null);
  const [selectedTailorJob, setSelectedTailorJob] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Live WebSocket stream handler
  const handleLiveEvent = useCallback((event) => {
    // Show brief toast for major milestones
    if (['APPLICATION_SUBMITTED', 'DRY_RUN_COMPLETED', 'DAILY_CAP_REACHED', 'KILL_SWITCH_ACTIVE'].includes(event.type)) {
      setToastMessage(event.message);
      setTimeout(() => setToastMessage(null), 6000);
      // Automatically refresh pipeline board
      fetchPipeline();
      fetchSafetyStatus();
    }
  }, []);

  const { connected, events, agentStatus, clearEvents } = useSocket(handleLiveEvent);

  useEffect(() => {
    fetchPipeline();
    fetchSafetyStatus();
  }, []);

  const fetchPipeline = async () => {
    try {
      const res = await api.get('/apply/pipeline');
      setPipeline(res.data);
    } catch (err) {
      console.error('Failed to load pipeline:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchSafetyStatus = async () => {
    try {
      const res = await api.get('/apply/safety-status');
      setSafetyStatus(res.data);
    } catch (err) {
      console.error('Failed to load safety status:', err);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPipeline();
    fetchSafetyStatus();
  };

  // Dispatch high-matching discovered jobs to background auto-apply queue
  const handleBatchAutoApply = async () => {
    const highMatches = (pipeline.discovered || [])
      .filter((m) => (m.match_score || 0) >= 70)
      .slice(0, 5);

    if (highMatches.length === 0) {
      alert('No discovered jobs with match score >= 70% to queue.');
      return;
    }

    try {
      setQueueingBatch(true);
      const matchIds = highMatches.map((m) => m.match_id);
      const res = await api.post('/apply/queue-auto', {
        match_ids: matchIds,
        is_dry_run: true,
      });
      setToastMessage(`Queued ${highMatches.length} high-match jobs for background dry-run proofing!`);
      setTimeout(() => setToastMessage(null), 5000);
      setIsActivityOpen(true);
      fetchPipeline();
      fetchSafetyStatus();
    } catch (err) {
      console.error('Failed to queue auto apply:', err);
      alert(err.response?.data?.detail || 'Failed to queue automated application tasks.');
    } finally {
      setQueueingBatch(false);
    }
  };

  // Metrics
  const reviewReadyCount = pipeline.review_ready?.length || 0;
  const appliedCount = pipeline.applied?.length || 0;
  const tailoredCount = pipeline.tailored?.length || 0;
  const discoveredCount = pipeline.discovered?.length || 0;

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-1 max-w-[1680px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed top-20 right-6 z-50 max-w-md bg-[#131726]/95 backdrop-blur-xl border border-blue-500/40 rounded-xl p-4 shadow-2xl animate-slideDown flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-blue-400 shrink-0" />
              <p className="text-xs text-white font-medium">{toastMessage}</p>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Phase 5 Safety & Rate Limit Bar */}
        <SafetyControls
          safetyStatus={safetyStatus}
          onStatusUpdated={() => {
            fetchSafetyStatus();
            fetchPipeline();
          }}
          connected={connected}
          agentStatus={agentStatus}
        />

        {/* Header & KPI Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-6 border-b border-white/10 gap-6 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                Phase 5 Worker Fleet
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Live WebSocket Streaming Active
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
              Job Application Pipeline & Fleet
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Autonomous lifecycle with rate limits, randomized human delays, ATS form filling, and emergency kill-switch.
            </p>
          </div>

          {/* Action Buttons & Quick Metrics */}
          <div className="flex items-center gap-3 overflow-x-auto pb-2 lg:pb-0">
            {/* Batch Auto Apply Button */}
            <button
              type="button"
              onClick={handleBatchAutoApply}
              disabled={queueingBatch || safetyStatus.kill_switch_active || discoveredCount === 0}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer ${
                safetyStatus.kill_switch_active
                  ? 'bg-gray-800 text-gray-500 border border-white/5 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/20'
              }`}
              title="Queue high-matching discovered jobs for automated background processing"
            >
              {queueingBatch ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4 text-amber-300" />
              )}
              Auto-Queue Top Matches
            </button>

            {/* Live Stream Telemetry Toggle Button */}
            <button
              type="button"
              onClick={() => setIsActivityOpen(true)}
              className="px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 hover:border-blue-500/40 text-slate-300 hover:text-white transition-all shadow-md flex items-center gap-2 text-xs font-semibold cursor-pointer relative"
              title="Open Live Agent Activity Drawer"
            >
              <Terminal className="w-4 h-4 text-blue-400" />
              <span>Live Stream</span>
              {events.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-blue-500 text-[10px] text-white font-bold">
                  {events.length}
                </span>
              )}
            </button>

            {/* Quick Metrics */}
            <div className="glass-panel px-3.5 py-2 rounded-xl border-amber-500/20 text-left min-w-[105px]">
              <span className="text-[10px] uppercase font-bold text-amber-400 block">Needs Approval</span>
              <div className="text-lg font-black text-white">{reviewReadyCount}</div>
            </div>
            <div className="glass-panel px-3.5 py-2 rounded-xl border-cyan-500/20 text-left min-w-[95px]">
              <span className="text-[10px] uppercase font-bold text-cyan-400 block">AI Tailored</span>
              <div className="text-lg font-black text-white">{tailoredCount}</div>
            </div>
            <div className="glass-panel px-3.5 py-2 rounded-xl border-emerald-500/20 text-left min-w-[95px]">
              <span className="text-[10px] uppercase font-bold text-emerald-400 block">Applied Total</span>
              <div className="text-lg font-black text-white">{appliedCount}</div>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2.5 rounded-xl bg-slate-900 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white transition-all shadow-md cursor-pointer"
              title="Refresh Pipeline"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Kanban Board Columns */}
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
            <p className="text-xs text-slate-400 mt-2">Loading pipeline stages...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-start">
            {COLUMNS.map((col) => {
              const items = pipeline[col.id] || [];
              return (
                <div
                  key={col.id}
                  className={`rounded-2xl border p-3 flex flex-col min-h-[600px] ${col.color} backdrop-blur-sm shadow-md`}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      {col.label}
                    </span>
                    <span className="h-5 px-2 rounded-full bg-slate-900/80 border border-white/10 text-[10px] font-bold text-slate-300 flex items-center justify-center">
                      {items.length}
                    </span>
                  </div>

                  {/* Cards List */}
                  <div className="space-y-3 flex-1 overflow-y-auto">
                    {items.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500 italic">
                        No applications in this stage
                      </div>
                    ) : (
                      items.map((item, idx) => {
                        const hasProof = item.has_proof;
                        const isReviewReady = item.status === 'review_ready';

                        return (
                          <div
                            key={idx}
                            className={`glass-panel p-3.5 rounded-xl border transition-all hover:scale-[1.02] cursor-pointer space-y-2.5 shadow-sm ${
                              isReviewReady
                                ? 'border-amber-500/50 hover:border-amber-400 shadow-amber-500/10'
                                : 'border-white/10 hover:border-indigo-500/40'
                            }`}
                            onClick={() => {
                              if (item.application_id) {
                                setSelectedReviewApp(item);
                              } else {
                                setSelectedTailorJob({
                                  id: item.match_id,
                                  job: {
                                    id: item.job_id,
                                    title: item.title,
                                    company_name: item.company_name,
                                    apply_url: item.apply_url,
                                  },
                                });
                              }
                            }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-xs font-bold text-indigo-400 truncate">
                                {item.company_name}
                              </span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 font-mono uppercase">
                                {item.ats_type}
                              </span>
                            </div>

                            <h4 className="text-xs font-bold text-white line-clamp-2 leading-snug">
                              {item.title}
                            </h4>

                            <div className="text-[11px] text-slate-400 flex items-center gap-1 truncate">
                              <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                              <span>{item.location}</span>
                            </div>

                            {/* Proof Screenshot Badge */}
                            {hasProof && (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-semibold">
                                <Camera className="w-3 h-3" />
                                <span>Dry-Run Proof Captured</span>
                              </div>
                            )}

                            {/* Card Footer */}
                            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px]">
                              {item.match_score ? (
                                <span className="font-bold text-emerald-400">
                                  {Math.round(item.match_score)}% Fit
                                </span>
                              ) : (
                                <span className="text-slate-500">
                                  {item.applied_at ? 'Applied' : 'Staged'}
                                </span>
                              )}

                              <span className="text-cyan-400 font-semibold flex items-center gap-0.5 hover:underline">
                                <span>{isReviewReady ? 'Review Now' : 'Details'}</span>
                                <ChevronRight className="w-3 h-3" />
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal: Review Ready & Dry-Run Proof */}
        <ReviewModal
          isOpen={!!selectedReviewApp}
          application={selectedReviewApp}
          onClose={() => setSelectedReviewApp(null)}
          onStatusUpdate={() => {
            fetchPipeline();
            fetchSafetyStatus();
          }}
        />

        {/* Modal: Tailoring */}
        <TailorModal
          isOpen={!!selectedTailorJob}
          jobMatch={selectedTailorJob}
          onClose={() => setSelectedTailorJob(null)}
          onTailorComplete={() => {
            fetchPipeline();
            fetchSafetyStatus();
          }}
        />

        {/* Live Activity Drawer */}
        <LiveActivityDrawer
          isOpen={isActivityOpen}
          onClose={() => setIsActivityOpen(false)}
          events={events}
          onClear={clearEvents}
          onReviewMatch={(appId) => {
            const found = pipeline.review_ready?.find((a) => a.application_id === appId);
            if (found) {
              setSelectedReviewApp(found);
              setIsActivityOpen(false);
            }
          }}
        />
      </main>
    </div>
  );
}
