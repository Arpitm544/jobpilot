'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export function useSocket(onEventReceived) {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState([]);
  const [agentStatus, setAgentStatus] = useState(null);

  const wsRef = useRef(null);
  const sseRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const callbackRef = useRef(onEventReceived);
  const isMountedRef = useRef(true);
  const retryDelayRef = useRef(2000); // Exponential backoff starts at 2s

  useEffect(() => {
    callbackRef.current = onEventReceived;
  }, [onEventReceived]);

  const handleMessage = useCallback((eventData) => {
    if (!eventData || !isMountedRef.current) return;

    // Update recent events log (keep max 50)
    setEvents((prev) => [eventData, ...prev.slice(0, 49)]);

    // Update status if agent telemetry
    if (eventData.type === 'AGENT_STATUS') {
      setAgentStatus(eventData.message);
    } else if (['DRY_RUN_COMPLETED', 'APPLICATION_SUBMITTED', 'KILL_SWITCH_ACTIVE'].includes(eventData.type)) {
      setAgentStatus(null);
    }

    if (callbackRef.current) {
      callbackRef.current(eventData);
    }
  }, []);

  const connect = useCallback(() => {
    if (typeof window === 'undefined' || !isMountedRef.current) return;

    // Guard: Prevent duplicate parallel connection attempts
    if (wsRef.current) {
      if (
        wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING
      ) {
        return;
      }
    }

    const token = localStorage.getItem('jobpilot_access_token');

    // Normalize localhost to 127.0.0.1 to avoid Windows IPv6 (::1) TCP handshake failure
    let baseWs = process.env.NEXT_PUBLIC_WS_URL || 'ws://127.0.0.1:8000/api/v1/events/ws';
    if (baseWs.includes('://localhost:')) {
      baseWs = baseWs.replace('://localhost:', '://127.0.0.1:');
    }

    let baseSse = process.env.NEXT_PUBLIC_API_URL 
      ? `${process.env.NEXT_PUBLIC_API_URL}/events/stream`
      : 'http://127.0.0.1:8000/api/v1/events/stream';
    if (baseSse.includes('://localhost:')) {
      baseSse = baseSse.replace('://localhost:', '://127.0.0.1:');
    }

    const fullWsUrl = token ? `${baseWs}?token=${encodeURIComponent(token)}` : baseWs;
    const fullSseUrl = token ? `${baseSse}?token=${encodeURIComponent(token)}` : baseSse;

    try {
      const ws = new WebSocket(fullWsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) {
          try { ws.close(1000, 'Normal Closure'); } catch (e) {}
          return;
        }
        setConnected(true);
        retryDelayRef.current = 2000; // Reset backoff on success

        // Periodic heartbeat ping every 20s
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'PING' }));
          }
        }, 20000);
        ws._pingInterval = pingInterval;
      };

      ws.onmessage = (e) => {
        if (!isMountedRef.current) return;
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'CONNECTION_ESTABLISHED' && data.recent_events) {
            setEvents(data.recent_events.reverse());
          } else if (data.type !== 'PONG') {
            handleMessage(data);
          }
        } catch (err) {
          console.error('Error parsing WS message:', err);
        }
      };

      ws.onclose = () => {
        if (ws._pingInterval) clearInterval(ws._pingInterval);
        wsRef.current = null;

        if (!isMountedRef.current) return;
        setConnected(false);

        // Schedule reconnect with exponential backoff (max 15s)
        const delay = retryDelayRef.current;
        retryDelayRef.current = Math.min(15000, delay * 1.5);

        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            connect();
          }
        }, delay);
      };

      ws.onerror = () => {
        // Browser triggers onclose automatically; onclose handles backoff
      };
    } catch (wsErr) {
      // Direct WebSocket initialization failure: fallback to SSE
      if (!isMountedRef.current) return;
      try {
        const sse = new EventSource(fullSseUrl);
        sseRef.current = sse;

        sse.onopen = () => {
          if (isMountedRef.current) setConnected(true);
        };
        sse.onmessage = (e) => {
          if (!isMountedRef.current) return;
          try {
            const data = JSON.parse(e.data);
            handleMessage(data);
          } catch (err) {
            console.error('Error parsing SSE message:', err);
          }
        };
        sse.onerror = () => {
          if (sseRef.current) {
            sseRef.current.close();
            sseRef.current = null;
          }
          if (!isMountedRef.current) return;
          setConnected(false);
          const delay = retryDelayRef.current;
          retryDelayRef.current = Math.min(15000, delay * 1.5);
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        };
      } catch (sseErr) {
        console.warn('Neither WS nor SSE could be initialized:', sseErr);
      }
    }
  }, [handleMessage]);

  useEffect(() => {
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (wsRef.current) {
        const ws = wsRef.current;
        wsRef.current = null;
        if (ws._pingInterval) clearInterval(ws._pingInterval);

        // Detach listeners before closing to prevent unmount from triggering reconnects
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;

        if (ws.readyState === WebSocket.OPEN) {
          try { ws.close(1000, 'Normal Closure'); } catch (e) {}
        } else if (ws.readyState === WebSocket.CONNECTING) {
          // In React Strict Mode, wait for open then close cleanly without browser error
          ws.onopen = () => {
            try { ws.close(1000, 'Normal Closure'); } catch (e) {}
          };
        }
      }

      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
    };
  }, [connect]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return {
    connected,
    events,
    agentStatus,
    clearEvents,
  };
}
