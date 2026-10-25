from __future__ import annotations

from fastapi import WebSocket

from .db import get_session
from .models import Channel, ChannelRow, Message, MessageRow, channel_id_for


class ChatStore:
    """Chat state backed by PostgreSQL (D-08). WebSocket connections stay
    in-memory: they're process-local and have no meaning across a restart."""

    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = {}

    def get_or_create_channel(self, user_a: str, user_b: str) -> Channel:
        channel_id = channel_id_for(user_a, user_b)
        with get_session() as session:
            row = session.get(ChannelRow, channel_id)
            if row is None:
                first, second = sorted((user_a, user_b))
                row = ChannelRow(id=channel_id, member_a=first, member_b=second)
                session.add(row)
                session.commit()
                session.refresh(row)
            return Channel(id=row.id, members=row.members)

    def get_channel(self, channel_id: str) -> Channel | None:
        with get_session() as session:
            row = session.get(ChannelRow, channel_id)
            return Channel(id=row.id, members=row.members) if row else None

    def list_messages(self, channel_id: str) -> list[Message]:
        with get_session() as session:
            row = session.get(ChannelRow, channel_id)
            if row is None:
                return []
            return [Message.model_validate(m) for m in row.messages]

    def add_message(self, channel_id: str, sender: str, text: str) -> Message:
        with get_session() as session:
            row = MessageRow(channel_id=channel_id, sender=sender, text=text)
            session.add(row)
            session.commit()
            session.refresh(row)
            return Message.model_validate(row)

    def connect(self, channel_id: str, websocket: WebSocket) -> None:
        self._connections.setdefault(channel_id, set()).add(websocket)

    def disconnect(self, channel_id: str, websocket: WebSocket) -> None:
        self._connections.get(channel_id, set()).discard(websocket)

    def connections_for(self, channel_id: str) -> set[WebSocket]:
        return self._connections.get(channel_id, set())


store = ChatStore()
