from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db import Base, engine, init_db
from app.main import app
from app.store import store


@pytest.fixture(autouse=True)
def clean_database():
    """Each test starts from empty tables, not a fresh schema: dropping and
    recreating per test is slow and unnecessary since the schema never
    changes between tests."""
    init_db()
    with engine.begin() as connection:
        for table in reversed(Base.metadata.sorted_tables):
            connection.execute(text(f'DELETE FROM "{table.name}"'))
    store._connections.clear()
    yield


@pytest.fixture
def client():
    return TestClient(app)
