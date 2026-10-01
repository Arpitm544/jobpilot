import asyncio
import json
import logging
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse

from app.config import settings
from app.services.event_stream import event_stream
from app.services.auth_service import decode_token
from app.api.deps import get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/events", tags=["Real-time Streaming & WebSockets"])


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None)
):
    """
    WebSocket endpoint for real-time agent updates.
    Accepts JWT token in query param or access_token cookie.
    """
    if not token:
        token = websocket.cookies.get(settings.COOKIE_NAME)

    user_id = None
    if token:
        payload = decode_token(token)
        if payload and "sub" in payload:
            user_id = payload["sub"]

    # Fallback to anonymous or client session if token not provided
    if not user_id:
        user_id = "anonymous"

    try:
        await event_stream.connect_ws(websocket, user_id)
        while True:
            # Keep socket alive and accept ping/pong or client commands
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "PING":
                    await websocket.send_json({"type": "PONG"})
            except Exception:
                pass
    except WebSocketDisconnect:
        event_stream.disconnect_ws(websocket, user_id)
    except Exception as e:
        if "ClientDisconnected" in type(e).__name__ or "ConnectionClosed" in type(e).__name__:
            logger.info(f"WebSocket connection closed cleanly by client for user {user_id}")
        else:
            logger.warning(f"WebSocket error for user {user_id}: {e}")
        event_stream.disconnect_ws(websocket, user_id)


@router.get("/stream")
async def sse_event_stream(
    request: Request,
    token: Optional[str] = Query(None)
):
    """
    Server-Sent Events (SSE) fallback stream.
    Connect via browser EventSource with cookie or query token.
    """
    if not token:
        token = request.cookies.get(settings.COOKIE_NAME)

    user_id = "anonymous"
    if token:
        payload = decode_token(token)
        if payload and "sub" in payload:
            user_id = payload["sub"]

    q = event_stream.register_sse(user_id)

    async def event_generator():
        try:
            # Initial ping
            yield f"data: {json.dumps({'type': 'CONNECTED', 'message': 'SSE Stream Active'})}\n\n"
            while True:
                event = await q.get()
                yield f"data: {json.dumps(event)}\n\n"
        except asyncio.CancelledError:
            event_stream.unregister_sse(user_id, q)
        except Exception as e:
            logger.warning(f"SSE generator error: {e}")
            event_stream.unregister_sse(user_id, q)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.get("/recent")
async def get_recent_activity(
    current_user: User = Depends(get_current_user)
):
    """Returns recent stream events for candidate's session"""
    return event_stream.get_recent_events(str(current_user.id))
