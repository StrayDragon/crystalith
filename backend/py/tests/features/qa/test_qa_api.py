from __future__ import annotations

import pytest

from crystalith.shared.db import Chunk, Source
from crystalith.shared.types import SourceStatus


@pytest.mark.asyncio
async def test_qa_no_sources(client):
    create_resp = await client.post("/v1/notebooks", json={"name": "QA Notebook"})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()["id"]

    resp = await client.post(
        f"/v1/notebooks/{notebook_id}/qa",
        json={"question": "什么是测试？"},
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["answer"] == "来源中未找到相关证据"
    assert payload["evidence"] is False


@pytest.mark.asyncio
async def test_qa_with_chunk_ids_uses_explicit_context(client, db_session):
    create_resp = await client.post("/v1/notebooks", json={"name": "QA Notebook"})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()["id"]

    source = Source(
        notebook_id=notebook_id,
        filename="Doc.md",
        status=SourceStatus.READY,
    )
    db_session.add(source)
    await db_session.flush()
    chunk = Chunk(source_id=source.id, chunk_index=1, text="QA chunk content.")
    db_session.add(chunk)
    await db_session.commit()

    resp = await client.post(
        f"/v1/notebooks/{notebook_id}/qa",
        json={"question": "测试", "chunk_ids": [chunk.id]},
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["answer"].startswith("Test answer")
    assert payload["evidence"] is True
    assert payload["citations"][0]["chunk_id"] == chunk.id
    assert payload["citations"][0]["source_name"] == "Doc.md"


@pytest.mark.asyncio
async def test_qa_chunk_ids_invalid_returns_400(client):
    create_resp = await client.post("/v1/notebooks", json={"name": "QA Notebook"})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()["id"]

    resp = await client.post(
        f"/v1/notebooks/{notebook_id}/qa",
        json={"question": "测试", "chunk_ids": [9999]},
    )
    assert resp.status_code == 400
