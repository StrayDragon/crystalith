from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_sources_crud(client):
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Notebook"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    files = {"file": ("note.txt", b"Hello world", "text/plain")}
    create_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/sources",
        files=files,
    )
    assert create_resp.status_code == 201
    payload = create_resp.json()
    source_id = payload["id"]
    assert payload["chunk_count"] >= 1

    list_resp = await client.get(f"/v1/notebooks/{notebook_id}/sources")
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1

    chunks_resp = await client.get(
        f"/v1/notebooks/{notebook_id}/sources/{source_id}/chunks"
    )
    assert chunks_resp.status_code == 200
    assert len(chunks_resp.json()) >= 1

    delete_resp = await client.delete(
        f"/v1/notebooks/{notebook_id}/sources/{source_id}"
    )
    assert delete_resp.status_code == 204

    after_resp = await client.get(f"/v1/notebooks/{notebook_id}/sources")
    assert after_resp.status_code == 200
    assert after_resp.json() == []
