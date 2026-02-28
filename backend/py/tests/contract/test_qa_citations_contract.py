from __future__ import annotations

import pytest

from crystalith.shared.db import Chunk, Source
from crystalith.shared.types import SourceStatus


@pytest.mark.asyncio
async def test_qa_response_citations_are_mapped_and_1_based(db_session, client, app):
    create_resp = await client.post("/v1/notebooks", json={"name": "Contract QA Notebook"})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()["id"]

    source = Source(
        notebook_id=notebook_id,
        filename="Doc.md",
        status=SourceStatus.READY,
    )
    db_session.add(source)
    await db_session.flush()

    chunk = Chunk(source_id=source.id, chunk_index=0, text="Test chunk content for citations contract.")
    db_session.add(chunk)
    await db_session.commit()

    await app.state.vector_store.add(
        notebook_id=notebook_id,
        source_id=source.id,
        chunk_ids=[chunk.id],
        vectors=[[1.0, 0.0, 0.0]],
    )

    qa_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/qa",
        json={"question": "What is this?", "source_ids": [source.id]},
    )
    assert qa_resp.status_code == 200
    payload = qa_resp.json()
    assert isinstance(payload.get("citations"), list)
    assert payload["citations"], "Expected at least one citation when evidence is available"

    citation = payload["citations"][0]
    assert citation["source_id"] == source.id
    assert citation["chunk_id"] == chunk.id
    assert citation["chunk_index"] == 1
    assert isinstance(citation["source_name"], str) and citation["source_name"]
    assert isinstance(citation["snippet"], str) and citation["snippet"]


def _collect_citation_objects(value: object) -> list[dict]:
    citations: list[dict] = []
    seen = set()

    def _push(item: object) -> None:
        if not isinstance(item, dict):
            return
        chunk_id = item.get("chunk_id")
        if not isinstance(chunk_id, int):
            return
        if chunk_id in seen:
            return
        seen.add(chunk_id)
        citations.append(item)

    def _walk(node: object) -> None:
        if node is None:
            return
        if isinstance(node, list):
            for child in node:
                _walk(child)
            return
        if not isinstance(node, dict):
            return
        if isinstance(node.get("citations"), list):
            for item in node["citations"]:
                _push(item)
        for child in node.values():
            _walk(child)

    _walk(value)
    return citations


@pytest.mark.asyncio
async def test_message_citations_match_contract_fields(db_session, client, app):
    create_resp = await client.post("/v1/notebooks", json={"name": "Contract Message Notebook"})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()["id"]

    session_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/sessions",
        json={"title": "Contract Session"},
    )
    assert session_resp.status_code == 201
    session_id = session_resp.json()["id"]

    source = Source(
        notebook_id=notebook_id,
        filename="Doc.md",
        status=SourceStatus.READY,
    )
    db_session.add(source)
    await db_session.flush()

    chunk = Chunk(source_id=source.id, chunk_index=0, text="Test chunk content for message citations contract.")
    db_session.add(chunk)
    await db_session.commit()

    await app.state.vector_store.add(
        notebook_id=notebook_id,
        source_id=source.id,
        chunk_ids=[chunk.id],
        vectors=[[1.0, 0.0, 0.0]],
    )

    qa_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/qa",
        json={"question": "What is this?", "source_ids": [source.id], "session_id": session_id},
    )
    assert qa_resp.status_code == 200

    messages_resp = await client.get(f"/v1/notebooks/{notebook_id}/sessions/{session_id}/messages")
    assert messages_resp.status_code == 200
    messages = messages_resp.json()
    assert isinstance(messages, list)
    assistant = next((msg for msg in reversed(messages) if msg.get("role") == "assistant"), None)
    assert assistant is not None

    citations = assistant.get("citations")
    assert isinstance(citations, list)
    assert citations
    citation = citations[0]
    assert citation["source_id"] == source.id
    assert citation["chunk_id"] == chunk.id
    assert citation["chunk_index"] == 1
    assert isinstance(citation["source_name"], str) and citation["source_name"]
    assert isinstance(citation["snippet"], str) and citation["snippet"]


@pytest.mark.asyncio
async def test_output_citations_match_contract_fields(db_session, client, app):
    create_resp = await client.post("/v1/notebooks", json={"name": "Contract Output Notebook"})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()["id"]

    source = Source(
        notebook_id=notebook_id,
        filename="Doc.md",
        status=SourceStatus.READY,
    )
    db_session.add(source)
    await db_session.flush()

    chunk = Chunk(source_id=source.id, chunk_index=0, text="Test chunk content for output citations contract.")
    db_session.add(chunk)
    await db_session.commit()

    await app.state.vector_store.add(
        notebook_id=notebook_id,
        source_id=source.id,
        chunk_ids=[chunk.id],
        vectors=[[1.0, 0.0, 0.0]],
    )

    output_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/outputs/STRUCTURED",
        json={"prompt": "Summarize", "source_ids": [source.id]},
    )
    assert output_resp.status_code == 201
    payload = output_resp.json()
    assert isinstance(payload.get("content"), dict)

    citations = _collect_citation_objects(payload["content"])
    assert citations, "Expected output content to contain at least one mapped citation"
    citation = citations[0]
    assert citation["source_id"] == source.id
    assert citation["chunk_id"] == chunk.id
    assert citation["chunk_index"] == 1
    assert isinstance(citation["source_name"], str) and citation["source_name"]
    assert isinstance(citation["snippet"], str) and citation["snippet"]
