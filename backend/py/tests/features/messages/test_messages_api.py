from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_message_create_and_list(client):
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Notebook"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    session_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/sessions",
        json={"title": "Session"},
    )
    assert session_resp.status_code == 201
    session_id = session_resp.json()["id"]

    create_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/messages",
        json={"role": "user", "content": "Hello"},
    )
    assert create_resp.status_code == 201
    message_id = create_resp.json()["id"]
    assert create_resp.json()["content"] == "Hello"

    list_resp = await client.get(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/messages"
    )
    assert list_resp.status_code == 200
    messages = list_resp.json()
    assert len(messages) == 1
    assert messages[0]["id"] == message_id
