from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_analysis_empty_results(client):
    create_resp = await client.post("/v1/notebooks", json={"name": "Analysis Notebook"})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()["id"]

    resp = await client.get(f"/v1/notebooks/{notebook_id}/analysis")
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["topics"] == []
    assert payload["relations"] == []
    assert payload["contradictions"] == []


@pytest.mark.asyncio
async def test_analysis_not_found(client):
    resp = await client.get("/v1/notebooks/9999/analysis")
    assert resp.status_code == 404
