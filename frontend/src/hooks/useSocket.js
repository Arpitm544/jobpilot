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

  useEffect(() => {
    callbackRef.current = onEventReceived;
  }, [onEventReceived]);

  const handleMessage = useCallback((eventData) => {
    if (!eventData) return;

    // Update recent events log
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
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('jobpilot_access_token');
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/api/v1/events/ws';
    const sseUrl = process.env.NEXT_PUBLIC_API_URL 
      ? `${process.env.NEXT_PUBLIC_API_URL}/events/stream`
      : 'http://localhost:8000/api/v1/events/stream';

    // Try WebSocket first
    try {
      const fullWsUrl = token ? `${wsUrl}?token=${token}` : wsUrl;
      const ws = new WebSocket(fullWsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        // Start heartbeat ping
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'PING' }));
          }
        }, 20000);
        ws._pingInterval = pingInterval;
      };

      ws.onmessage = (e) => {
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
        setConnected(false);
        if (ws._pingInterval) clearInterval(ws._pingInterval);
        // Reconnect after 4s
        reconnectTimeoutRef.current = setTimeout(connect, 4000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (wsErr) {
      // Fallback to SSE
      try {
        const fullSseUrl = token ? `${sseUrl}?token=${token}` : sseUrl;
        const sse = new EventSource(fullSseUrl);
        sseRef.current = sse;

        sse.onopen = () => setConnected(true);
        sse.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            handleMessage(data);
          } catch (err) {
            console.error('Error parsing SSE message:', err);
          }
        };
        sse.onerror = () => {
          setConnected(false);
          sse.close();
          reconnectTimeoutRef.current = setTimeout(connect, 5000);
        };
      } catch (sseErr) {
        console.warn('Neither WS nor SSE could be established:', sseErr);
      }
    }
  }, [handleMessage]);

  useEffect(() => {
    connect();

    return () => {
      if (wsRef.current) {
        if (wsRef.current._pingInterval) clearInterval(wsRef.current._pingInterval);
        wsRef.current.close();
      }
      if (sseRef.current) {
        sseRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
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
