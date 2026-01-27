from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_notebook_crud(client):
    create_resp = await client.post("/v1/notebooks", json={"name": "My Notebook"})
    assert create_resp.status_code == 201
    payload = create_resp.json()
    notebook_id = payload["id"]
    assert payload["name"] == "My Notebook"

    list_resp = await client.get("/v1/notebooks")
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1

    get_resp = await client.get(f"/v1/notebooks/{notebook_id}")
    assert get_resp.status_code == 200

    update_resp = await client.patch(
        f"/v1/notebooks/{notebook_id}", json={"name": "Updated"}
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["name"] == "Updated"

    delete_resp = await client.delete(f"/v1/notebooks/{notebook_id}")
    assert delete_resp.status_code == 204

    missing_resp = await client.get(f"/v1/notebooks/{notebook_id}")
    assert missing_resp.status_code == 404
