from __future__ import annotations

import os
import time

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


class Base(DeclarativeBase):
    pass


DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql+psycopg://chat:chat@localhost:5432/chat"
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def wait_for_db(attempts: int = 30, delay_seconds: float = 2.0) -> None:
    """The database container can start a little after the app does."""
    for attempt in range(1, attempts + 1):
        try:
            with engine.connect():
                return
        except Exception:
            if attempt == attempts:
                raise
            time.sleep(delay_seconds)


def init_db() -> None:
    wait_for_db()
    Base.metadata.create_all(engine)


def get_session() -> Session:
    return SessionLocal()
