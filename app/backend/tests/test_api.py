from __future__ import annotations


def test_health(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_get_or_create_channel_is_order_independent(client):
    first = client.get("/api/channels/alice/bob").json()
    second = client.get("/api/channels/bob/alice").json()
    assert first["id"] == second["id"]
    assert sorted(first["members"]) == ["alice", "bob"]


def test_send_message_returns_stored_message(client):
    res = client.post(
        "/api/channels/alice/bob/messages",
        json={"sender": "alice", "text": "hello bob"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["sender"] == "alice"
    assert body["text"] == "hello bob"
    assert body["channel_id"] == "alice__bob"
    assert "id" in body and "created_at" in body


def test_list_messages_returns_sent_messages_in_order(client):
    client.post("/api/channels/alice/bob/messages", json={"sender": "alice", "text": "first"})
    client.post("/api/channels/alice/bob/messages", json={"sender": "bob", "text": "second"})

    res = client.get("/api/channels/alice/bob/messages")
    assert res.status_code == 200
    texts = [m["text"] for m in res.json()]
    assert texts == ["first", "second"]


def test_list_messages_empty_channel_returns_empty_list(client):
    res = client.get("/api/channels/nobody/elsenobody/messages")
    assert res.status_code == 200
    assert res.json() == []


def test_messages_are_scoped_to_their_channel(client):
    client.post("/api/channels/alice/bob/messages", json={"sender": "alice", "text": "for bob"})
    client.post("/api/channels/alice/carol/messages", json={"sender": "alice", "text": "for carol"})

    bob_channel = client.get("/api/channels/alice/bob/messages").json()
    carol_channel = client.get("/api/channels/alice/carol/messages").json()

    assert [m["text"] for m in bob_channel] == ["for bob"]
    assert [m["text"] for m in carol_channel] == ["for carol"]
