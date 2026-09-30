'use client';

import React from 'react';
import { 
  X, 
  Terminal, 
  Trash2, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Camera, 
  Send, 
  Sparkles, 
  ShieldAlert,
  ChevronRight
} from 'lucide-react';

export default function LiveActivityDrawer({ 
  isOpen, 
  onClose, 
  events = [], 
  onClear,
  onReviewMatch
}) {
  if (!isOpen) return null;

  const getEventBadge = (type) => {
    switch (type) {
      case 'APPLICATION_SUBMITTED':
        return {
          icon: <Send className="w-3.5 h-3.5 text-emerald-400" />,
          label: 'SUBMITTED',
          bg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
        };
      case 'DRY_RUN_COMPLETED':
        return {
          icon: <Camera className="w-3.5 h-3.5 text-blue-400" />,
          label: 'DRY RUN PROOF',
          bg: 'bg-blue-500/15 border-blue-500/30 text-blue-300',
        };
      case 'TAILORING_COMPLETED':
        return {
          icon: <Sparkles className="w-3.5 h-3.5 text-purple-400" />,
          label: 'TAILORED',
          bg: 'bg-purple-500/15 border-purple-500/30 text-purple-300',
        };
      case 'AGENT_STATUS':
        return {
          icon: <Clock className="w-3.5 h-3.5 text-amber-400" />,
          label: 'HUMAN JITTER',
          bg: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
        };
      case 'KILL_SWITCH_ACTIVE':
      case 'KILL_SWITCH_UPDATED':
        return {
          icon: <ShieldAlert className="w-3.5 h-3.5 text-red-400" />,
          label: 'KILL SWITCH',
          bg: 'bg-red-500/15 border-red-500/30 text-red-300',
        };
      case 'DAILY_CAP_REACHED':
        return {
          icon: <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />,
          label: 'CAP REACHED',
          bg: 'bg-orange-500/15 border-orange-500/30 text-orange-300',
        };
      default:
        return {
          icon: <Terminal className="w-3.5 h-3.5 text-gray-400" />,
          label: 'EVENT',
          bg: 'bg-white/10 border-white/15 text-gray-300',
        };
    }
  };

  const formatTime = (ts) => {
    if (!ts) return 'Just now';
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return 'Just now';
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-[#0c0f17]/95 backdrop-blur-xl border-l border-white/10 shadow-2xl flex flex-col transition-all duration-300">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              Live Agent Telemetry
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </h3>
            <p className="text-xs text-gray-400">Real-time WebSocket event stream</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {events.length > 0 && (
            <button
              onClick={onClear}
              className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              title="Clear events"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Events Stream Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs">
        {events.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-500">
            <Terminal className="w-10 h-10 mb-3 opacity-30" />
            <p className="font-sans text-sm font-medium text-gray-400">No events yet</p>
            <p className="font-sans text-xs text-gray-500 mt-1 max-w-[240px]">
              Live updates will appear here as automated job discovery, tailoring, and applications occur.
            </p>
          </div>
        ) : (
          events.map((evt, idx) => {
            const badge = getEventBadge(evt.type);
            return (
              <div
                key={evt.id || idx}
                className="p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition-all"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-bold ${badge.bg}`}>
                    {badge.icon}
                    {badge.label}
                  </span>
                  <span className="text-[10px] text-gray-500 font-sans">
                    {formatTime(evt.timestamp)}
                  </span>
                </div>

                <p className="text-gray-200 text-xs font-sans leading-relaxed">
                  {evt.message}
                </p>

                {/* Event Payloads */}
                {evt.payload && Object.keys(evt.payload).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-white/5 text-[11px] text-gray-400 space-y-0.5">
                    {evt.payload.company && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Company:</span>
                        <span className="text-gray-300 font-medium">{evt.payload.company}</span>
                      </div>
                    )}
                    {evt.payload.delay_seconds && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Jitter Delay:</span>
                        <span className="text-amber-400 font-semibold">{evt.payload.delay_seconds}s</span>
                      </div>
                    )}
                    {evt.payload.ats_score && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">ATS Match Score:</span>
                        <span className="text-emerald-400 font-bold">{evt.payload.ats_score}%</span>
                      </div>
                    )}
                    {evt.type === 'DRY_RUN_COMPLETED' && evt.payload.application_id && (
                      <button
                        onClick={() => onReviewMatch && onReviewMatch(evt.payload.application_id)}
                        className="mt-2 w-full py-1.5 px-2 bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 rounded text-blue-300 text-xs font-sans font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        View Proof Screenshot
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-white/10 bg-white/[0.02] text-[11px] text-gray-500 flex items-center justify-between font-sans">
        <span>Channel: /api/v1/events/ws</span>
        <span>Auto-scroll: On</span>
      </div>
    </div>
  );
}
