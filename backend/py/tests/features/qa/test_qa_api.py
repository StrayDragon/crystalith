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
async def test_qa_with_source_ids_uses_explicit_context(client, db_session, app):
    create_resp = await client.post("/v1/notebooks", json={"name": "QA Notebook"})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()["id"]

    source_a = Source(
        notebook_id=notebook_id,
        filename="Doc-A.md",
        status=SourceStatus.READY,
    )
    source_b = Source(
        notebook_id=notebook_id,
        filename="Doc-B.md",
        status=SourceStatus.READY,
    )
    db_session.add_all([source_a, source_b])
    await db_session.flush()
    chunk_a = Chunk(source_id=source_a.id, chunk_index=1, text="QA chunk A.")
    chunk_b = Chunk(source_id=source_b.id, chunk_index=1, text="QA chunk B.")
    db_session.add_all([chunk_a, chunk_b])
    await db_session.commit()

    await app.state.vector_store.add(
        notebook_id=notebook_id,
        source_id=source_a.id,
        chunk_ids=[chunk_a.id],
        vectors=[[1.0, 0.0, 0.0]],
    )
    await app.state.vector_store.add(
        notebook_id=notebook_id,
        source_id=source_b.id,
        chunk_ids=[chunk_b.id],
        vectors=[[1.0, 0.0, 0.0]],
    )

    resp = await client.post(
        f"/v1/notebooks/{notebook_id}/qa",
        json={"question": "测试", "source_ids": [source_a.id]},
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["answer"].startswith("Test answer")
    assert payload["evidence"] is True
    assert payload["citations"]
    assert all(citation["source_id"] == source_a.id for citation in payload["citations"])


@pytest.mark.asyncio
async def test_qa_source_ids_invalid_returns_400(client):
    create_resp = await client.post("/v1/notebooks", json={"name": "QA Notebook"})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()["id"]

    resp = await client.post(
        f"/v1/notebooks/{notebook_id}/qa",
        json={"question": "测试", "source_ids": [9999]},
    )
    assert resp.status_code == 400
