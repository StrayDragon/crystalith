from __future__ import annotations

import pytest
from starlette.requests import Request

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


@pytest.mark.asyncio
async def test_qa_with_session_id_keeps_answer_and_citations_consistent(client, db_session, app):
    create_resp = await client.post("/v1/notebooks", json={"name": "QA Session Notebook"})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()["id"]

    source = Source(
        notebook_id=notebook_id,
        filename="Doc-Session.md",
        status=SourceStatus.READY,
    )
    db_session.add(source)
    await db_session.flush()
    chunk = Chunk(source_id=source.id, chunk_index=1, text="Session QA chunk")
    db_session.add(chunk)
    await db_session.commit()

    await app.state.vector_store.add(
        notebook_id=notebook_id,
        source_id=source.id,
        chunk_ids=[chunk.id],
        vectors=[[1.0, 0.0, 0.0]],
    )

    session_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/sessions",
        json={"title": "session"},
    )
    assert session_resp.status_code == 201
    session_id = session_resp.json()["id"]

    payload = {"question": "测试 session", "source_ids": [source.id]}
    base_resp = await client.post(f"/v1/notebooks/{notebook_id}/qa", json=payload)
    assert base_resp.status_code == 200

    session_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/qa",
        json={**payload, "session_id": session_id},
    )
    assert session_resp.status_code == 200

    base_body = base_resp.json()
    session_body = session_resp.json()

    assert session_body["answer"] == base_body["answer"]
    assert session_body["evidence"] == base_body["evidence"]
    assert session_body["citations"] == base_body["citations"]


@pytest.mark.asyncio
async def test_qa_stream_disconnect_skips_persistence(client, db_session, app, monkeypatch):
    create_resp = await client.post("/v1/notebooks", json={"name": "QA Stream Notebook"})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()["id"]

    source = Source(
        notebook_id=notebook_id,
        filename="Doc-Stream.md",
        status=SourceStatus.READY,
    )
    db_session.add(source)
    await db_session.flush()
    chunk = Chunk(source_id=source.id, chunk_index=1, text="Stream QA chunk")
    db_session.add(chunk)
    await db_session.commit()

    await app.state.vector_store.add(
        notebook_id=notebook_id,
        source_id=source.id,
        chunk_ids=[chunk.id],
        vectors=[[1.0, 0.0, 0.0]],
    )

    session_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/sessions",
        json={"title": "stream-session"},
    )
    assert session_resp.status_code == 201
    session_id = session_resp.json()["id"]

    async def always_disconnected(_self: Request) -> bool:
        return True

    monkeypatch.setattr(Request, "is_disconnected", always_disconnected)

    async with client.stream(
        "POST",
        f"/v1/notebooks/{notebook_id}/qa/stream",
        json={
            "question": "测试 stream",
            "source_ids": [source.id],
            "session_id": session_id,
        },
    ) as response:
        assert response.status_code == 200
        async for _line in response.aiter_lines():
            pass

    messages_resp = await client.get(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/messages",
    )
    assert messages_resp.status_code == 200
    assert messages_resp.json() == []
