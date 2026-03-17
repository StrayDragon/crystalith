from __future__ import annotations

import pytest
from sqlalchemy import select

from crystalith.shared.db import Chunk, Output, Source
from crystalith.shared.plugins import PluginRegistry
from crystalith.shared.types import OutputType, SourceStatus


@pytest.mark.asyncio
async def test_outputs_crud(client, app, db_session):
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Notebook"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    source = Source(
        notebook_id=notebook_id,
        filename="Doc.md",
        status=SourceStatus.READY,
    )
    db_session.add(source)
    await db_session.commit()
    await db_session.refresh(source)

    chunk = Chunk(
        source_id=source.id,
        chunk_index=0,
        text="Hello world.",
    )
    db_session.add(chunk)
    await db_session.commit()
    await db_session.refresh(chunk)

    await app.state.vector_store.add(
        notebook_id=notebook_id,
        source_id=source.id,
        chunk_ids=[chunk.id],
        vectors=[[1.0, 0.0, 0.0]],
    )

    create_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/outputs/BULLETS",
        json={"prompt": "Summarize", "source_ids": [source.id]},
    )
    assert create_resp.status_code == 201
    created = create_resp.json()
    output_id = created["id"]
    assert created["chunk_ids"] == [chunk.id]
    assert created["content"]["items"]
    assert created["content"]["items"][0]["citations"]
    assert created["content"]["items"][0]["citations"][0]["source_id"] == source.id
    assert created["content"]["items"][0]["citations"][0]["chunk_id"] == chunk.id

    list_resp = await client.get(f"/v1/notebooks/{notebook_id}/outputs")
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1

    get_resp = await client.get(
        f"/v1/notebooks/{notebook_id}/outputs/{output_id}"
    )
    assert get_resp.status_code == 200

    delete_resp = await client.delete(
        f"/v1/notebooks/{notebook_id}/outputs/{output_id}"
    )
    assert delete_resp.status_code == 204

    missing_resp = await client.get(
        f"/v1/notebooks/{notebook_id}/outputs/{output_id}"
    )
    assert missing_resp.status_code == 404


@pytest.mark.asyncio
async def test_outputs_convert_to_source(client, app, db_session):
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Notebook"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    source = Source(
        notebook_id=notebook_id,
        filename="Doc.md",
        status=SourceStatus.READY,
    )
    db_session.add(source)
    await db_session.commit()
    await db_session.refresh(source)

    chunk = Chunk(
        source_id=source.id,
        chunk_index=0,
        text="Hello world.",
    )
    db_session.add(chunk)
    await db_session.commit()
    await db_session.refresh(chunk)

    await app.state.vector_store.add(
        notebook_id=notebook_id,
        source_id=source.id,
        chunk_ids=[chunk.id],
        vectors=[[1.0, 0.0, 0.0]],
    )

    create_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/outputs/BULLETS",
        json={"prompt": "Summarize", "source_ids": [source.id]},
    )
    assert create_resp.status_code == 201
    output_id = create_resp.json()["id"]

    entries_before = tuple(await app.state.vector_store.entries())

    convert_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/outputs/{output_id}/convert-to-source"
    )
    assert convert_resp.status_code == 201
    payload = convert_resp.json()
    assert payload["source_id"] > 0
    assert payload["chunk_count"] >= 1
    assert payload["filename"].endswith(".md")

    new_entries = tuple(await app.state.vector_store.entries())
    assert len(new_entries) >= len(entries_before) + payload["chunk_count"]
    assert any(entry.source_id == payload["source_id"] for entry in new_entries)

    async with app.state.db.got_manual_session() as session:
        db_source = await session.get(Source, payload["source_id"])
        assert db_source is not None
        assert db_source.notebook_id == notebook_id
        assert db_source.status == SourceStatus.READY
        assert db_source.metadata_ is not None
        assert db_source.metadata_.get("converted_from_output") == output_id
        assert db_source.metadata_.get("output_type") == "BULLETS"

        rows = await session.execute(
            select(Chunk.text).where(Chunk.source_id == payload["source_id"])
        )
        chunk_texts = [row[0] for row in rows.all()]
        assert len(chunk_texts) == payload["chunk_count"]
        assert any("- a" in text for text in chunk_texts)


@pytest.mark.asyncio
async def test_outputs_error_responses(client, db_session):
    missing = await client.post(
        "/v1/notebooks/999999/outputs/BULLETS",
        json={"prompt": "x", "source_ids": [1]},
    )
    assert missing.status_code == 404

    notebook_resp = await client.post("/v1/notebooks", json={"name": "Outputs Errors"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    bad_type = await client.post(
        f"/v1/notebooks/{notebook_id}/outputs/SLIDES",
        json={"prompt": "x", "source_ids": [1]},
    )
    assert bad_type.status_code == 400

    empty_sources = await client.post(
        f"/v1/notebooks/{notebook_id}/outputs/BULLETS",
        json={"prompt": "x", "source_ids": []},
    )
    assert empty_sources.status_code == 400

    list_missing = await client.get("/v1/notebooks/999999/outputs")
    assert list_missing.status_code == 404

    delete_missing = await client.delete(f"/v1/notebooks/{notebook_id}/outputs/999999")
    assert delete_missing.status_code == 404

    convert_missing = await client.post(
        f"/v1/notebooks/{notebook_id}/outputs/999999/convert-to-source"
    )
    assert convert_missing.status_code == 404

    empty_output = Output(
        notebook_id=notebook_id,
        type=OutputType.PARAGRAPH,
        prompt=None,
        content={},
        chunk_ids=None,
    )
    db_session.add(empty_output)
    await db_session.commit()
    await db_session.refresh(empty_output)

    convert_empty = await client.post(
        f"/v1/notebooks/{notebook_id}/outputs/{empty_output.id}/convert-to-source"
    )
    assert convert_empty.status_code == 400


@pytest.mark.asyncio
async def test_outputs_tool_output_requires_plugin(client, app) -> None:
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Tool Outputs Plugin Gate"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    original_plugins = app.state.plugins
    app.state.plugins = PluginRegistry()
    try:
        resp = await client.post(
            f"/v1/notebooks/{notebook_id}/outputs/QUIZ",
            json={},
        )
    finally:
        app.state.plugins = original_plugins

    assert resp.status_code == 409
    payload = resp.json()
    assert payload["error_code"] == "OUTPUT_TYPE_PLUGIN_REQUIRED"
    assert payload["details"]["output_type"] == "QUIZ"
    assert payload["details"]["required_plugin_id"] == "output-quiz"
    assert isinstance(payload["details"]["recovery_hint"], str)
    assert payload["details"]["recovery_hint"]


@pytest.mark.asyncio
async def test_outputs_create_without_prompt_normalizes_to_none(client, app, db_session) -> None:
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Outputs Prompt"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    source = Source(
        notebook_id=notebook_id,
        filename="Doc.md",
        status=SourceStatus.READY,
    )
    db_session.add(source)
    await db_session.commit()
    await db_session.refresh(source)

    chunk = Chunk(
        source_id=source.id,
        chunk_index=0,
        text="Hello world.",
    )
    db_session.add(chunk)
    await db_session.commit()
    await db_session.refresh(chunk)

    await app.state.vector_store.add(
        notebook_id=notebook_id,
        source_id=source.id,
        chunk_ids=[chunk.id],
        vectors=[[1.0, 0.0, 0.0]],
    )

    create_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/outputs/BULLETS",
        json={"source_ids": [source.id]},
    )
    assert create_resp.status_code == 201
