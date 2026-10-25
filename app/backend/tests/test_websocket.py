from __future__ import annotations

import threading


def test_websocket_receives_broadcast_message(client):
    with client.websocket_connect("/ws/alice/bob") as ws:
        client.post("/api/channels/alice/bob/messages", json={"sender": "alice", "text": "hi"})
        received = ws.receive_json()

    assert received["text"] == "hi"
    assert received["sender"] == "alice"


def test_websocket_does_not_receive_other_channels_messages(client):
    with client.websocket_connect("/ws/alice/bob") as ws:
        client.post("/api/channels/alice/carol/messages", json={"sender": "alice", "text": "not for bob"})
        client.post("/api/channels/alice/bob/messages", json={"sender": "alice", "text": "for bob"})
        received = ws.receive_json()

    assert received["text"] == "for bob"


def test_multiple_sockets_on_same_channel_both_receive_broadcast(client):
    with client.websocket_connect("/ws/alice/bob") as ws_a, client.websocket_connect("/ws/alice/bob") as ws_b:
        client.post("/api/channels/alice/bob/messages", json={"sender": "alice", "text": "hi both"})
        received_a = ws_a.receive_json()
        received_b = ws_b.receive_json()

    assert received_a["text"] == "hi both"
    assert received_b["text"] == "hi both"


def test_websocket_disconnect_is_handled_without_error(client):
    barrier = threading.Event()

    with client.websocket_connect("/ws/alice/bob"):
        barrier.set()

    # Connection is closed on exiting the context manager; the server's
    # disconnect handling must not raise or hang. A follow-up send should
    # still work (channel state outlives any one socket).
    res = client.post("/api/channels/alice/bob/messages", json={"sender": "alice", "text": "after close"})
    assert res.status_code == 200
