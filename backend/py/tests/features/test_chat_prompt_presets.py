from __future__ import annotations

import pytest

from crystalith.shared.db import Chunk, Source
from crystalith.shared.types import SourceStatus


@pytest.mark.asyncio
async def test_prompt_directive_returns_400_when_presets_disabled(client):
    create_resp = await client.post("/v1/notebooks", json={"name": "Preset Disabled"})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()["id"]

    qa_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/qa",
        json={"question": "/prompt:stats hello"},
    )
    assert qa_resp.status_code == 400
    assert qa_resp.json()["message"] == "Prompt presets are disabled"


@pytest.mark.asyncio
async def test_prompt_directive_empty_query_returns_usage(client, app):
    app.state.settings.app.features.chat_prompt_presets_enabled = True

    create_resp = await client.post("/v1/notebooks", json={"name": "Preset Empty Query"})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()["id"]

    qa_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/qa",
        json={"question": "/prompt:stats"},
    )
    assert qa_resp.status_code == 400
    assert "Usage: /prompt:<preset> <query>" in qa_resp.json()["message"]


@pytest.mark.asyncio
async def test_prompt_directive_unknown_preset_returns_400(client, app):
    app.state.settings.app.features.chat_prompt_presets_enabled = True

    create_resp = await client.post("/v1/notebooks", json={"name": "Preset Unknown"})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()["id"]

    qa_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/qa",
        json={"question": "/prompt:unknown hello"},
    )
    assert qa_resp.status_code == 400
    assert "Unknown preset: unknown" in qa_resp.json()["message"]


@pytest.mark.asyncio
async def test_stats_preset_can_embed_ui_envelope_when_enabled(db_session, client, app):
    app.state.settings.app.features.chat_prompt_presets_enabled = True
    app.state.settings.app.features.chat_ui_envelope_enabled = True

    create_resp = await client.post("/v1/notebooks", json={"name": "Preset Stats Envelope"})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()["id"]

    source = Source(
        notebook_id=notebook_id,
        filename="Doc.csv",
        status=SourceStatus.READY,
    )
    db_session.add(source)
    await db_session.flush()

    chunk = Chunk(source_id=source.id, chunk_index=0, text="Test chunk for stats preset.")
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
        json={"question": "/prompt:stats show chart", "source_ids": [source.id]},
    )
    assert qa_resp.status_code == 200
    payload = qa_resp.json()
    assert "[[crystalith-ui:v1]]" in payload["answer"]
    assert payload["answer"].startswith("Test stats answer")
    assert payload["citations"], "Expected citations in stats preset response when evidence exists"


@pytest.mark.asyncio
async def test_stats_preset_invalid_output_falls_back_to_text_qa(db_session, client, app):
    app.state.settings.app.features.chat_prompt_presets_enabled = True
    app.state.settings.app.features.chat_ui_envelope_enabled = False

    create_resp = await client.post("/v1/notebooks", json={"name": "Preset Stats Fallback"})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()["id"]

    source = Source(
        notebook_id=notebook_id,
        filename="Doc.md",
        status=SourceStatus.READY,
    )
    db_session.add(source)
    await db_session.flush()

    chunk = Chunk(source_id=source.id, chunk_index=0, text="Test chunk for fallback.")
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
        json={"question": "/prompt:stats invalid_json", "source_ids": [source.id]},
    )
    assert qa_resp.status_code == 200
    payload = qa_resp.json()
    assert payload["answer"] == "Test answer [1]"


@pytest.mark.asyncio
async def test_stream_prompt_errors_use_error_event(client):
    create_resp = await client.post("/v1/notebooks", json={"name": "Preset Stream Errors"})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()["id"]

    resp = await client.post(
        f"/v1/notebooks/{notebook_id}/qa/stream",
        json={"question": "/prompt:stats hello"},
        headers={"Accept": "text/event-stream"},
    )
    assert resp.status_code == 200
    body = (await resp.aread()).decode("utf-8")
    assert "event: error" in body
    assert "Prompt presets are disabled" in body


@pytest.mark.asyncio
async def test_stats_preset_stream_persists_envelope_and_emits_chunk_and_done(db_session, client, app):
    app.state.settings.app.features.chat_prompt_presets_enabled = True
    app.state.settings.app.features.chat_ui_envelope_enabled = True

    create_resp = await client.post("/v1/notebooks", json={"name": "Preset Stats Stream"})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()["id"]

    session_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/sessions",
        json={"title": "Stream Session"},
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

    chunk = Chunk(source_id=source.id, chunk_index=0, text="Test chunk for stream stats.")
    db_session.add(chunk)
    await db_session.commit()

    await app.state.vector_store.add(
        notebook_id=notebook_id,
        source_id=source.id,
        chunk_ids=[chunk.id],
        vectors=[[1.0, 0.0, 0.0]],
    )

    resp = await client.post(
        f"/v1/notebooks/{notebook_id}/qa/stream",
        json={"question": "/prompt:stats stream please", "source_ids": [source.id], "session_id": session_id},
        headers={"Accept": "text/event-stream"},
    )
    assert resp.status_code == 200
    body = (await resp.aread()).decode("utf-8")
    assert "event: chunk" in body
    assert "Test stats answer" in body
    assert "event: done" in body

    messages_resp = await client.get(f"/v1/notebooks/{notebook_id}/sessions/{session_id}/messages")
    assert messages_resp.status_code == 200
    messages = messages_resp.json()
    assistant = next((msg for msg in reversed(messages) if msg.get("role") == "assistant"), None)
    assert assistant is not None
    assert "[[crystalith-ui:v1]]" in (assistant.get("content") or "")
