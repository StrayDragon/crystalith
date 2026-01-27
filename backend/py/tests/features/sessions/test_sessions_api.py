from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_session_crud(client):
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Notebook"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    create_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/sessions",
        json={"title": "Session One"},
    )
    assert create_resp.status_code == 201
    payload = create_resp.json()
    session_id = payload["id"]
    assert payload["title"] == "Session One"

    list_resp = await client.get(f"/v1/notebooks/{notebook_id}/sessions")
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1

    get_resp = await client.get(f"/v1/notebooks/{notebook_id}/sessions/{session_id}")
    assert get_resp.status_code == 200

    update_resp = await client.patch(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}",
        json={"title": "Updated"},
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["title"] == "Updated"

    delete_resp = await client.delete(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}"
    )
    assert delete_resp.status_code == 204

    missing_resp = await client.get(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}"
    )
    assert missing_resp.status_code == 404
