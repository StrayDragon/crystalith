from __future__ import annotations

import pytest

from crystalith.shared.db import Chunk, Source
from crystalith.shared.types import SourceStatus


@pytest.mark.asyncio
async def test_citation_context_endpoint_returns_window_and_1_based_indices(db_session, client):
    create_resp = await client.post("/v1/notebooks", json={"name": "Citations Context Notebook"})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()["id"]

    source = Source(
        notebook_id=notebook_id,
        filename="Doc.md",
        status=SourceStatus.READY,
    )
    db_session.add(source)
    await db_session.flush()

    chunks = [
        Chunk(source_id=source.id, chunk_index=0, text="Chunk 0"),
        Chunk(source_id=source.id, chunk_index=1, text="Chunk 1"),
        Chunk(source_id=source.id, chunk_index=2, text="Chunk 2"),
    ]
    db_session.add_all(chunks)
    await db_session.commit()

    middle = chunks[1]

    resp = await client.get(
        f"/v1/notebooks/{notebook_id}/citations/context",
        params={"chunk_id": middle.id, "before": 1, "after": 1},
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["citation"]["chunk_id"] == middle.id
    assert payload["citation"]["chunk_index"] == 2
    assert payload["chunk"]["chunk_id"] == middle.id
    assert payload["chunk"]["chunk_index"] == 2
    assert [item["chunk_index"] for item in payload["before"]] == [1]
    assert [item["chunk_index"] for item in payload["after"]] == [3]

    resp2 = await client.get(
        f"/v1/notebooks/{notebook_id}/citations/context",
        params={"source_id": source.id, "chunk_index": 2, "before": 1, "after": 1},
    )
    assert resp2.status_code == 200
    payload2 = resp2.json()
    assert payload2["citation"]["chunk_id"] == middle.id
    assert payload2["citation"]["chunk_index"] == 2


@pytest.mark.asyncio
async def test_citation_context_endpoint_validates_locators(db_session, client):
    create_resp = await client.post("/v1/notebooks", json={"name": "Citations Context Validation"})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()["id"]

    resp = await client.get(f"/v1/notebooks/{notebook_id}/citations/context")
    assert resp.status_code == 400

    resp = await client.get(
        f"/v1/notebooks/{notebook_id}/citations/context",
        params={"chunk_id": 1, "source_id": 1, "chunk_index": 1},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_qa_export_endpoint_supports_markdown_and_json(db_session, client, app):
    create_resp = await client.post("/v1/notebooks", json={"name": "QA Export Notebook"})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()["id"]

    session_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/sessions",
        json={"title": "Export Session"},
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

    chunk = Chunk(source_id=source.id, chunk_index=0, text="Test chunk for QA export.")
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

    export_json_resp = await client.get(
        f"/v1/notebooks/{notebook_id}/qa/export",
        params={"session_id": session_id, "format": "json"},
    )
    assert export_json_resp.status_code == 200
    export_json = export_json_resp.json()
    assert export_json["session_id"] == session_id
    assert isinstance(export_json.get("answer"), str) and export_json["answer"]
    assert isinstance(export_json.get("citations"), list)
    assert export_json["citations"][0]["chunk_id"] == chunk.id
    assert export_json["citations"][0]["chunk_index"] == 1
    assert isinstance(export_json.get("sources"), list)

    export_md_resp = await client.get(
        f"/v1/notebooks/{notebook_id}/qa/export",
        params={"session_id": session_id, "format": "markdown"},
    )
    assert export_md_resp.status_code == 200
    assert export_md_resp.headers.get("content-type", "").startswith("text/markdown")
    assert "attachment" in (export_md_resp.headers.get("content-disposition", "") or "").lower()
    assert "# QA Export" in export_md_resp.text


@pytest.mark.asyncio
async def test_output_export_endpoint_supports_markdown_and_json(db_session, client, app):
    create_resp = await client.post("/v1/notebooks", json={"name": "Output Export Notebook"})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()["id"]

    source = Source(
        notebook_id=notebook_id,
        filename="Doc.md",
        status=SourceStatus.READY,
    )
    db_session.add(source)
    await db_session.flush()

    chunk = Chunk(source_id=source.id, chunk_index=0, text="Test chunk for output export.")
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
    output_id = output_resp.json()["id"]

    export_json_resp = await client.get(
        f"/v1/notebooks/{notebook_id}/outputs/{output_id}/export",
        params={"format": "json"},
    )
    assert export_json_resp.status_code == 200
    export_json = export_json_resp.json()
    assert export_json["output_id"] == output_id
    assert isinstance(export_json.get("citations"), list)
    assert export_json["citations"], "Expected at least one citation in export"
    assert export_json["citations"][0]["chunk_id"] == chunk.id
    assert export_json["citations"][0]["chunk_index"] == 1

    export_md_resp = await client.get(
        f"/v1/notebooks/{notebook_id}/outputs/{output_id}/export",
        params={"format": "markdown"},
    )
    assert export_md_resp.status_code == 200
    assert export_md_resp.headers.get("content-type", "").startswith("text/markdown")
    assert "# Output Export" in export_md_resp.text
