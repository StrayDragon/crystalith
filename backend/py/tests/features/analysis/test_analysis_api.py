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


@pytest.mark.asyncio
async def test_analysis_entries_are_scoped_to_notebook(client, app):
    create_resp = await client.post("/v1/notebooks", json={"name": "Analysis Scope"})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()["id"]

    class _RecordingVectorStore:
        def __init__(self) -> None:
            self.called_with: tuple[int | None, list[int] | None] | None = None

        async def entries(self, *, notebook_id: int | None = None, source_ids=None):  # noqa: ANN001
            self.called_with = (notebook_id, list(source_ids) if source_ids else None)
            return []

    recorder = _RecordingVectorStore()
    app.state.vector_store = recorder

    resp = await client.get(f"/v1/notebooks/{notebook_id}/analysis")
    assert resp.status_code == 200
    assert recorder.called_with == (notebook_id, None)
