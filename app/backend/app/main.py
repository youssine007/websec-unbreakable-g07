from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .db import init_db
from .models import Message, SendMessageRequest, channel_id_for
from .store import store


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="SecureChat (dev, no auth)", lifespan=lifespan)

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


@app.get("/api/channels/{user_a}/{user_b}")
def get_or_create_channel(user_a: str, user_b: str) -> dict:
    channel = store.get_or_create_channel(user_a, user_b)
    return channel.model_dump()


@app.get("/api/channels/{user_a}/{user_b}/messages")
def list_messages(user_a: str, user_b: str) -> list[Message]:
    channel_id = channel_id_for(user_a, user_b)
    return store.list_messages(channel_id)


@app.post("/api/channels/{user_a}/{user_b}/messages")
async def send_message(user_a: str, user_b: str, body: SendMessageRequest) -> Message:
    channel = store.get_or_create_channel(user_a, user_b)
    message = store.add_message(channel.id, body.sender, body.text,body.line,body.mac)
    await _broadcast(channel.id, message)
    return message


@app.websocket("/ws/{user_a}/{user_b}")
async def channel_socket(websocket: WebSocket, user_a: str, user_b: str) -> None:
    channel = store.get_or_create_channel(user_a, user_b)
    await websocket.accept()
    store.connect(channel.id, websocket)
    try:
        while True:
            # Clients send over REST; this socket is receive-only for now, but
            # we still need to await something to detect disconnects.
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
