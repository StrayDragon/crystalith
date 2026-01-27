from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_slides_crud(client):
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Notebook"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    create_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/slides/drafts",
        json={"title": "Deck"},
    )
    assert create_resp.status_code == 201
    slide_id = create_resp.json()["id"]

    latest_resp = await client.get(f"/v1/notebooks/{notebook_id}/slides/drafts/latest")
    assert latest_resp.status_code == 200

    get_resp = await client.get(f"/v1/notebooks/{notebook_id}/slides/drafts/{slide_id}")
    assert get_resp.status_code == 200

    update_resp = await client.patch(
        f"/v1/notebooks/{notebook_id}/slides/drafts/{slide_id}",
        json={"title": "Updated"},
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["title"] == "Updated"
