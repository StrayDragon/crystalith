from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_research_crud(client):
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Notebook"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    create_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/research",
        json={"topic": "AI"},
    )
    assert create_resp.status_code == 201
    research_id = create_resp.json()["id"]

    list_resp = await client.get(f"/v1/notebooks/{notebook_id}/research")
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1

    get_resp = await client.get(
        f"/v1/notebooks/{notebook_id}/research/{research_id}"
    )
    assert get_resp.status_code == 200

    delete_resp = await client.delete(
        f"/v1/notebooks/{notebook_id}/research/{research_id}"
    )
    assert delete_resp.status_code == 204

    missing_resp = await client.get(
        f"/v1/notebooks/{notebook_id}/research/{research_id}"
    )
    assert missing_resp.status_code == 404
