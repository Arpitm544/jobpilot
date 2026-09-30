import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Set, Any, Optional
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class EventStreamManager:
    def __init__(self):
        # Maps user_id -> Set of active WebSockets
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # Maps user_id -> List of asyncio.Queue for SSE streams
        self.sse_queues: Dict[str, List[asyncio.Queue]] = {}
        # In-memory recent events buffer per user (for initial connection replay, max 20)
        self.recent_events: Dict[str, List[Dict[str, Any]]] = {}

    async def connect_ws(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
        logger.info(f"WebSocket connected for user {user_id}. Active: {len(self.active_connections[user_id])}")

        # Send greeting & recent events
        recent = self.recent_events.get(user_id, [])
        await websocket.send_json({
            "type": "CONNECTION_ESTABLISHED",
            "message": "Connected to JobPilot real-time event stream",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "recent_events": recent[-10:] if recent else []
        })

    def disconnect_ws(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        logger.info(f"WebSocket disconnected for user {user_id}")

    def register_sse(self, user_id: str) -> asyncio.Queue:
        q = asyncio.Queue(maxsize=100)
        if user_id not in self.sse_queues:
            self.sse_queues[user_id] = []
        self.sse_queues[user_id].append(q)
        return q

    def unregister_sse(self, user_id: str, q: asyncio.Queue):
        if user_id in self.sse_queues:
            if q in self.sse_queues[user_id]:
                self.sse_queues[user_id].remove(q)
            if not self.sse_queues[user_id]:
                del self.sse_queues[user_id]

    async def emit_event(
        self,
        user_id: str,
        event_type: str,
        message: str,
        payload: Optional[Dict[str, Any]] = None
    ):
        event = {
            "id": str(uuid.uuid4()),
            "type": event_type,
            "message": message,
            "payload": payload or {},
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        # Store in recent events buffer (keep last 30)
        if user_id not in self.recent_events:
            self.recent_events[user_id] = []
        self.recent_events[user_id].append(event)
        if len(self.recent_events[user_id]) > 30:
            self.recent_events[user_id].pop(0)

        # 1. Send to all active WebSockets for this user
        if user_id in self.active_connections:
            dead_sockets = set()
            for ws in self.active_connections[user_id]:
                try:
                    await ws.send_json(event)
                except Exception as e:
                    logger.warning(f"Error sending to WebSocket for user {user_id}: {e}")
                    dead_sockets.add(ws)
            for dead in dead_sockets:
                self.active_connections[user_id].discard(dead)

        # 2. Push to all SSE queues for this user
        if user_id in self.sse_queues:
            dead_queues = []
            for q in self.sse_queues[user_id]:
                try:
                    q.put_nowait(event)
                except asyncio.QueueFull:
                    dead_queues.append(q)
            for dq in dead_queues:
                if dq in self.sse_queues[user_id]:
                    self.sse_queues[user_id].remove(dq)

    def get_recent_events(self, user_id: str) -> List[Dict[str, Any]]:
        return self.recent_events.get(user_id, [])


event_stream = EventStreamManager()
