from __future__ import annotations

import pytest

from crystalith.shared.db import Chunk, Source
from crystalith.shared.types import SourceStatus


@pytest.mark.asyncio
async def test_qa_response_can_embed_envelope_and_export_strips_it(db_session, client, app):
    app.state.settings.app.features.chat_ui_envelope_enabled = True

    create_resp = await client.post("/v1/notebooks", json={"name": "Envelope Export"})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()["id"]

    session_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/sessions",
        json={"title": "Envelope Session"},
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

    chunk = Chunk(source_id=source.id, chunk_index=0, text="Test chunk for envelope export.")
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
        json={"question": "hello", "source_ids": [source.id], "session_id": session_id},
    )
    assert qa_resp.status_code == 200
    assert "[[crystalith-ui:v1]]" in qa_resp.json()["answer"]

    messages_resp = await client.get(f"/v1/notebooks/{notebook_id}/sessions/{session_id}/messages")
    assert messages_resp.status_code == 200
    messages = messages_resp.json()
    assistant = next((msg for msg in reversed(messages) if msg.get("role") == "assistant"), None)
    assert assistant is not None
    assistant_id = assistant["id"]

    export_resp = await client.get(
        f"/v1/notebooks/{notebook_id}/qa/export",
        params={"session_id": session_id, "message_id": assistant_id, "format": "json"},
    )
    assert export_resp.status_code == 200
    exported = export_resp.json()
    assert "[[crystalith-ui:v1]]" not in exported["answer"]

