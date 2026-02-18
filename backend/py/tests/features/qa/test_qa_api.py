from __future__ import annotations

import json

import pytest
from starlette.requests import Request

from crystalith.shared.db import Chunk, Source
from crystalith.shared.types import SourceStatus


async def _read_sse_events_until(response, *, stop_event: str) -> list[tuple[str, dict]]:
    events: list[tuple[str, dict]] = []
    current_event: str | None = None
    async for line in response.aiter_lines():
        if not line:
            continue
        if line.startswith("event: "):
            current_event = line.removeprefix("event: ").strip()
            continue
        if current_event and line.startswith("data: "):
            data = json.loads(line.removeprefix("data: ").strip() or "{}")
            events.append((current_event, data))
            if current_event == stop_event:
                break
            current_event = None
    return events


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
async def test_qa_rejects_missing_notebook_and_invalid_source_ids(client) -> None:
    missing = await client.post(
        "/v1/notebooks/999999/qa",
        json={"question": "x", "source_ids": [1]},
    )
    assert missing.status_code == 404

    notebook_resp = await client.post("/v1/notebooks", json={"name": "QA Errors"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    bad = await client.post(
        f"/v1/notebooks/{notebook_id}/qa",
        json={"question": "x", "source_ids": [0]},
    )
    assert bad.status_code == 400


@pytest.mark.asyncio
async def test_qa_with_sources_but_no_vectors_returns_no_evidence(client, db_session) -> None:
    create_resp = await client.post("/v1/notebooks", json={"name": "QA No Vectors"})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()["id"]

    source = Source(
        notebook_id=notebook_id,
        filename="Doc.md",
        status=SourceStatus.READY,
    )
    db_session.add(source)
    await db_session.flush()
    db_session.add(Chunk(source_id=source.id, chunk_index=0, text="No vectors chunk"))
    await db_session.commit()

    resp = await client.post(
        f"/v1/notebooks/{notebook_id}/qa",
        json={"question": "x", "source_ids": [source.id]},
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["answer"] == "来源中未找到相关证据"
    assert payload["evidence"] is False


@pytest.mark.asyncio
async def test_qa_filters_out_blank_chunks_returns_no_evidence(client, db_session, app) -> None:
    create_resp = await client.post("/v1/notebooks", json={"name": "QA Blank Chunks"})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()["id"]

    source = Source(
        notebook_id=notebook_id,
        filename="Doc.md",
        status=SourceStatus.READY,
    )
    db_session.add(source)
    await db_session.flush()
    chunk = Chunk(source_id=source.id, chunk_index=0, text="   ")
    db_session.add(chunk)
    await db_session.commit()

    await app.state.vector_store.add(
        notebook_id=notebook_id,
        source_id=source.id,
        chunk_ids=[chunk.id],
        vectors=[[1.0, 0.0, 0.0]],
    )

    resp = await client.post(
        f"/v1/notebooks/{notebook_id}/qa",
        json={"question": "x", "source_ids": [source.id], "min_score": 0.0},
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["answer"] == "来源中未找到相关证据"
    assert payload["evidence"] is False


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
async def test_qa_similarity_below_threshold_returns_no_evidence(client, db_session, app) -> None:
    create_resp = await client.post("/v1/notebooks", json={"name": "QA Threshold Notebook"})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()["id"]

    source = Source(
        notebook_id=notebook_id,
        filename="Doc.md",
        status=SourceStatus.READY,
    )
    db_session.add(source)
    await db_session.flush()
    chunk = Chunk(source_id=source.id, chunk_index=0, text="Low similarity chunk")
    db_session.add(chunk)
    await db_session.commit()

    await app.state.vector_store.add(
        notebook_id=notebook_id,
        source_id=source.id,
        chunk_ids=[chunk.id],
        vectors=[[0.0, 1.0, 0.0]],
    )

    resp = await client.post(
        f"/v1/notebooks/{notebook_id}/qa",
        json={
            "question": "测试阈值",
            "source_ids": [source.id],
            "min_score": 0.0,
        },
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["answer"] == "来源中未找到相关证据"
    assert payload["evidence"] is False
    assert payload["citations"] == []


@pytest.mark.asyncio
async def test_qa_stream_success_persists_messages(client, db_session, app) -> None:
    notebook_resp = await client.post("/v1/notebooks", json={"name": "QA Stream Success"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    source = Source(
        notebook_id=notebook_id,
        filename="Doc-Stream.md",
        status=SourceStatus.READY,
    )
    db_session.add(source)
    await db_session.flush()
    chunk = Chunk(source_id=source.id, chunk_index=0, text="Stream QA chunk")
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
        json={"title": "qa-stream-session"},
    )
    assert session_resp.status_code == 201
    session_id = session_resp.json()["id"]

    async with client.stream(
        "POST",
        f"/v1/notebooks/{notebook_id}/qa/stream",
        json={
            "question": "测试 stream success",
            "source_ids": [source.id],
            "session_id": session_id,
        },
    ) as response:
        assert response.status_code == 200
        events = await _read_sse_events_until(response, stop_event="done")

    chunks = [data["text"] for event, data in events if event == "chunk"]
    assert chunks

    done_payload = next(data for event, data in events if event == "done")
    assert done_payload["evidence"] is True
    assert done_payload["citations"]

    messages_resp = await client.get(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/messages",
    )
    assert messages_resp.status_code == 200
    messages = messages_resp.json()
    assert len(messages) == 2
    assert messages[0]["role"] == "user"
    assert messages[1]["role"] == "assistant"
    assert messages[1]["content"].endswith("[1]")


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
