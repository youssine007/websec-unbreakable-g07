from __future__ import annotations

import asyncio
import json
import os
from contextlib import asynccontextmanager

from fastapi import (
    Depends,
    FastAPI,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from fastapi.middleware.cors import CORSMiddleware

from .auth import current_user, verify_token
from .db import init_db
from .models import Message, SendMessageRequest, channel_id_for
from .store import store


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="SecureChat", lifespan=lifespan)

allowed_origins = [
    origin.strip()
    for origin in os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# peer is de channel waarmee je praat dit bevat dus de 2 gebruikers 
@app.get("/api/channels/{peer}")
def get_or_create_channel(peer: str, me: str = Depends(current_user)) -> dict:
    # me is de manier hoe we de current_user uit auth.py ophalen uit de token. Hierdoor bepaal de client zelf nooit meer wie HIJ is want dit word vanaf nu uit de token gehaald
    channel = store.get_or_create_channel(me, peer)
    return channel.model_dump()


@app.get("/api/channels/{peer}/messages")
def list_messages(peer: str, me: str = Depends(current_user)) -> list[Message]:
    channel_id = channel_id_for(me, peer)
    return store.list_messages(channel_id)


@app.post("/api/channels/{peer}/messages")
async def send_message(
    peer: str, body: SendMessageRequest, me: str = Depends(current_user)
) -> Message:
    channel = store.get_or_create_channel(me, peer)
    # De afzender is de ingelogde gebruiker, niet wat de client in de body zet.
    message = store.add_message(channel.id, me, body.text, body.line, body.mac)
    await _broadcast(channel.id, message)
    return message


# Browsers kunnen geen Authorization-header meesturen bij een WebSocket.
# Token in de URL zou in de WAF-logs belanden, dus de client stuurt het
# als eerste bericht: {"type": "auth", "token": "<access token>"}.
@app.websocket("/ws/{peer}")
async def channel_socket(websocket: WebSocket, peer: str) -> None:
    await websocket.accept()
    try:
        raw = await asyncio.wait_for(websocket.receive_text(), timeout=5)
        msg = json.loads(raw)
        if msg.get("type") != "auth":
            raise ValueError("first message must be auth")
        me = verify_token(msg.get("token", ""))
    except (asyncio.TimeoutError, ValueError, json.JSONDecodeError, HTTPException):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    channel = store.get_or_create_channel(me, peer)
    store.connect(channel.id, websocket)
    try:
        while True:
            # Clients versturen via REST; deze socket ontvangt enkel, maar we
            # moeten iets awaiten om een disconnect te detecteren.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        store.disconnect(channel.id, websocket)


async def _broadcast(channel_id: str, message: Message) -> None:
    for websocket in list(store.connections_for(channel_id)):
        try:
            await websocket.send_json(message.model_dump(mode="json"))
        except Exception:
            store.disconnect(channel_id, websocket)
