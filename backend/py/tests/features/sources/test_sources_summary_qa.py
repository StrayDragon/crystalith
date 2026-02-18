from __future__ import annotations

import pytest

from crystalith.shared.db import Chunk, Source
from crystalith.shared.types import SourceStatus


@pytest.mark.asyncio
async def test_source_summary_endpoint_parses_or_falls_back(client, db_session) -> None:
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Summary Notebook"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    source = Source(notebook_id=notebook_id, filename="Doc.md", status=SourceStatus.READY)
    db_session.add(source)
    await db_session.flush()
    db_session.add_all(
        [
            Chunk(source_id=source.id, chunk_index=0, text="Alpha beta gamma"),
            Chunk(source_id=source.id, chunk_index=1, text="Delta epsilon"),
        ]
    )
    await db_session.commit()

    resp = await client.get(f"/v1/notebooks/{notebook_id}/sources/{source.id}/summary")
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["source_id"] == source.id
    assert payload["summary"]
    assert len(payload["key_points"]) == 4
    assert len(payload["topics"]) == 3
    assert payload["word_count"] >= 1
    assert payload["generated_at"]


@pytest.mark.asyncio
async def test_source_summary_rejects_not_ready_and_empty_content(client, db_session) -> None:
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Summary Notebook 2"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    processing = Source(notebook_id=notebook_id, filename="Doc.md", status=SourceStatus.PROCESSING)
    db_session.add(processing)
    await db_session.commit()

    not_ready = await client.get(f"/v1/notebooks/{notebook_id}/sources/{processing.id}/summary")
    assert not_ready.status_code == 400

    ready_no_chunks = Source(notebook_id=notebook_id, filename="Empty.md", status=SourceStatus.READY)
    db_session.add(ready_no_chunks)
    await db_session.commit()

    empty = await client.get(f"/v1/notebooks/{notebook_id}/sources/{ready_no_chunks.id}/summary")
    assert empty.status_code == 400


@pytest.mark.asyncio
async def test_source_qa_uses_vector_results_and_fallback_paths(client, app, db_session) -> None:
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Source QA Notebook"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    # Source with vector entries (results path)
    source = Source(notebook_id=notebook_id, filename="Doc.md", status=SourceStatus.READY)
    db_session.add(source)
    await db_session.flush()
    chunk = Chunk(source_id=source.id, chunk_index=0, text="Hello world.")
    db_session.add(chunk)
    await db_session.commit()

    await app.state.vector_store.add(
        notebook_id=notebook_id,
        source_id=source.id,
        chunk_ids=[chunk.id],
        vectors=[[1.0, 0.0, 0.0]],
    )

    resp = await client.post(
        f"/v1/notebooks/{notebook_id}/sources/{source.id}/qa",
        json={"question": "测试"},
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["source_id"] == source.id
    assert payload["answer"] == "Test answer"

    # Source without vector entries but has chunks (fallback DB chunks path)
    source2 = Source(notebook_id=notebook_id, filename="Doc2.md", status=SourceStatus.READY)
    db_session.add(source2)
    await db_session.flush()
    db_session.add(Chunk(source_id=source2.id, chunk_index=0, text="Fallback chunk"))
    await db_session.commit()

    resp2 = await client.post(
        f"/v1/notebooks/{notebook_id}/sources/{source2.id}/qa",
        json={"question": "测试"},
    )
    assert resp2.status_code == 200
    assert resp2.json()["answer"] == "Test answer"

    # Source with no chunks and no results
    source3 = Source(notebook_id=notebook_id, filename="Empty.md", status=SourceStatus.READY)
    db_session.add(source3)
    await db_session.commit()

    resp3 = await client.post(
        f"/v1/notebooks/{notebook_id}/sources/{source3.id}/qa",
        json={"question": "测试"},
    )
    assert resp3.status_code == 200
    assert resp3.json()["answer"] == "文档中未找到相关信息。"


@pytest.mark.asyncio
async def test_convert_source_qa_to_source_creates_new_source_and_vectors(client, app, db_session) -> None:
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Source QA Convert Notebook"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    original = Source(notebook_id=notebook_id, filename="Doc.md", status=SourceStatus.READY)
    db_session.add(original)
    await db_session.commit()
    await db_session.refresh(original)

    before = tuple(await app.state.vector_store.entries())

    resp = await client.post(
        f"/v1/notebooks/{notebook_id}/sources/{original.id}/qa/convert-to-source",
        json={
            "messages": [
                {"role": "user", "content": "Q1"},
                {"role": "assistant", "content": "A1"},
            ]
        },
    )
    assert resp.status_code == 201
    payload = resp.json()
    assert payload["source_id"] > 0
    assert payload["filename"].endswith(".md")

    after = tuple(await app.state.vector_store.entries())
    assert len(after) > len(before)
    assert any(entry.source_id == payload["source_id"] for entry in after)

    async with app.state.db.got_manual_session() as session:
        created = await session.get(Source, payload["source_id"])
        assert created is not None
        assert created.status == SourceStatus.READY


@pytest.mark.asyncio
async def test_convert_source_qa_to_source_rejects_missing_source(client) -> None:
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Source QA Convert Notebook 2"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    resp = await client.post(
        f"/v1/notebooks/{notebook_id}/sources/999999/qa/convert-to-source",
        json={"messages": [{"role": "user", "content": "Q"}]},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_source_qa_rejects_missing_or_not_ready_sources(client, db_session) -> None:
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Source QA Errors"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    missing = await client.post(
        f"/v1/notebooks/{notebook_id}/sources/999999/qa",
        json={"question": "x"},
    )
    assert missing.status_code == 404

    processing = Source(notebook_id=notebook_id, filename="Doc.md", status=SourceStatus.PROCESSING)
    db_session.add(processing)
    await db_session.commit()
    await db_session.refresh(processing)

    not_ready = await client.post(
        f"/v1/notebooks/{notebook_id}/sources/{processing.id}/qa",
        json={"question": "x"},
    )
    assert not_ready.status_code == 400
