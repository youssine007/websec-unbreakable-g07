from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from pydantic import BaseModel, Field
from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def channel_id_for(user_a: str, user_b: str) -> str:
    """Derive a stable 1:1 channel id from two usernames, order independent."""
    first, second = sorted((user_a, user_b))
    return f"{first}__{second}"


class ChannelRow(Base):
    __tablename__ = "channels"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    member_a: Mapped[str] = mapped_column(String, nullable=False)
    member_b: Mapped[str] = mapped_column(String, nullable=False)

    messages: Mapped[list["MessageRow"]] = relationship(
        back_populates="channel", order_by="MessageRow.created_at"
    )

    @property
    def members(self) -> list[str]:
        return sorted((self.member_a, self.member_b))


class MessageRow(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    channel_id: Mapped[str] = mapped_column(ForeignKey("channels.id"), nullable=False, index=True)
    sender: Mapped[str] = mapped_column(String, nullable=False)
    text: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    channel: Mapped[ChannelRow] = relationship(back_populates="messages")


class Message(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    channel_id: str
    sender: str
    text: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = {"from_attributes": True}


class SendMessageRequest(BaseModel):
    sender: str
    text: str


class Channel(BaseModel):
    id: str
    members: list[str]

    model_config = {"from_attributes": True}
