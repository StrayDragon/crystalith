from __future__ import annotations

import pytest

from crystalith.shared.db import Chunk, Source
from crystalith.shared.types import OutputType, SourceStatus


@pytest.mark.asyncio
async def test_convert_session_to_source_and_output(client, db_session) -> None:
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Convert Notebook"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    session_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/sessions",
        json={"title": "Session One"},
    )
    assert session_resp.status_code == 201
    session_id = session_resp.json()["id"]

    source = Source(notebook_id=notebook_id, filename="Doc.md", status=SourceStatus.READY)
    db_session.add(source)
    await db_session.flush()
    chunk = Chunk(source_id=source.id, chunk_index=0, text="Evidence text")
    db_session.add(chunk)
    await db_session.commit()

    user_msg = await client.post(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/messages",
        json={"role": "user", "content": "Hello"},
    )
    assert user_msg.status_code == 201
    assistant_msg = await client.post(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/messages",
        json={
            "role": "assistant",
            "content": "Hi [1]",
            "citations": [
                {
                    "source_id": source.id,
                    "source_name": source.filename,
                    "chunk_id": chunk.id,
                    "chunk_index": chunk.chunk_index,
                    "snippet": "Evidence",
                }
            ],
        },
    )
    assert assistant_msg.status_code == 201

    convert_source = await client.post(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/convert-to-source",
        json={},
    )
    assert convert_source.status_code == 201
    payload = convert_source.json()
    assert payload["source_id"] > 0
    assert payload["chunk_count"] >= 1
    assert payload["filename"].endswith(".md")

    convert_output = await client.post(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/convert-to-output",
        json={"output_type": "BULLETS"},
    )
    assert convert_output.status_code == 201
    out_payload = convert_output.json()
    assert out_payload["output_id"] > 0
    assert out_payload["output_type"] == "BULLETS"
    assert "要点笔记" in out_payload["title"]


@pytest.mark.asyncio
async def test_convert_session_to_source_validates_message_ids(client) -> None:
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Convert Notebook 2"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    session_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/sessions",
        json={"title": "Session Two"},
    )
    assert session_resp.status_code == 201
    session_id = session_resp.json()["id"]

    no_messages = await client.post(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/convert-to-source",
        json={},
    )
    assert no_messages.status_code == 400

    add_msg = await client.post(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/messages",
        json={"role": "user", "content": "Hello"},
    )
    assert add_msg.status_code == 201
    message_id = add_msg.json()["id"]

    missing_all = await client.post(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/convert-to-source",
        json={"message_ids": [999999]},
    )
    assert missing_all.status_code == 400

    missing_some = await client.post(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/convert-to-source",
        json={"message_ids": [message_id, 999999]},
    )
    assert missing_some.status_code == 404


@pytest.mark.asyncio
async def test_convert_session_to_output_rejects_unsupported_types(client) -> None:
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Convert Notebook 3"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    session_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/sessions",
        json={"title": "Session Three"},
    )
    assert session_resp.status_code == 201
    session_id = session_resp.json()["id"]

    bad = await client.post(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/convert-to-output",
        json={"output_type": "FAQ"},
    )
    assert bad.status_code == 400


@pytest.mark.asyncio
async def test_convert_session_to_output_structured_and_paragraph_variants(client, db_session) -> None:
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Convert Output Variants"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    session_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/sessions",
        json={"title": "Session Variants"},
    )
    assert session_resp.status_code == 201
    session_id = session_resp.json()["id"]

    source = Source(notebook_id=notebook_id, filename="Doc.md", status=SourceStatus.READY)
    db_session.add(source)
    await db_session.flush()
    chunk = Chunk(source_id=source.id, chunk_index=0, text="Evidence text")
    db_session.add(chunk)
    await db_session.commit()

    user_msg = await client.post(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/messages",
        json={"role": "user", "content": "Hello"},
    )
    assert user_msg.status_code == 201
    user_msg_id = user_msg.json()["id"]

    assistant_msg = await client.post(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/messages",
        json={
            "role": "assistant",
            "content": "Hi [1]",
            "citations": [
                {
                    "source_id": source.id,
                    "source_name": source.filename,
                    "chunk_id": chunk.id,
                    "chunk_index": chunk.chunk_index,
                    "snippet": "Evidence",
                }
            ],
        },
    )
    assert assistant_msg.status_code == 201

    structured_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/convert-to-output",
        json={"output_type": OutputType.STRUCTURED.value},
    )
    assert structured_resp.status_code == 201
    structured_id = structured_resp.json()["output_id"]

    structured_get = await client.get(
        f"/v1/notebooks/{notebook_id}/outputs/{structured_id}"
    )
    assert structured_get.status_code == 200
    structured_payload = structured_get.json()
    assert structured_payload["type"] == OutputType.STRUCTURED.value
    assert structured_payload["chunk_ids"] == [chunk.id]
    assert structured_payload["content"]["sections"][0]["content"].startswith("Hello")

    paragraph_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/convert-to-output",
        json={"output_type": OutputType.PARAGRAPH.value},
    )
    assert paragraph_resp.status_code == 201
    paragraph_id = paragraph_resp.json()["output_id"]

    paragraph_get = await client.get(
        f"/v1/notebooks/{notebook_id}/outputs/{paragraph_id}"
    )
    assert paragraph_get.status_code == 200
    paragraph_payload = paragraph_get.json()
    assert paragraph_payload["type"] == OutputType.PARAGRAPH.value
    assert paragraph_payload["chunk_ids"] == [chunk.id]
    assert "Hello" in paragraph_payload["content"]["text"]

    missing_all = await client.post(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/convert-to-output",
        json={"output_type": OutputType.BULLETS.value, "message_ids": [999999]},
    )
    assert missing_all.status_code == 400

    missing_some = await client.post(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/convert-to-output",
        json={"output_type": OutputType.BULLETS.value, "message_ids": [user_msg_id, 999999]},
    )
    assert missing_some.status_code == 404

    empty_session_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/sessions",
        json={"title": "Empty"},
    )
    assert empty_session_resp.status_code == 201
    empty_session_id = empty_session_resp.json()["id"]

    no_messages = await client.post(
        f"/v1/notebooks/{notebook_id}/sessions/{empty_session_id}/convert-to-output",
        json={"output_type": OutputType.BULLETS.value},
    )
    assert no_messages.status_code == 400
