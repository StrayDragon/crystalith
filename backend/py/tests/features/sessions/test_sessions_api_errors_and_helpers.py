from __future__ import annotations

import pytest

from crystalith.features.sessions.api import _extract_messages_text, _split_text_to_chunks
from crystalith.shared.db import Message


def test_session_text_helpers_cover_branches() -> None:
    assert _extract_messages_text([]) == ""

    messages = [
        Message(session_id=1, role="user", content="hi", citations=None),
        Message(session_id=1, role="assistant", content="ok", citations=None),
    ]
    markdown = _extract_messages_text(messages, text_format="markdown")
    assert "**用户**" in markdown
    assert "**助手**" in markdown

    raw = _extract_messages_text(messages, text_format="raw")
    assert raw.startswith("hi")
    assert "ok" in raw

    assert _split_text_to_chunks("") == []
    chunks = _split_text_to_chunks("a" * 1200, chunk_size=300, overlap=50)
    assert chunks
    assert all(len(chunk) <= 300 for chunk in chunks)


@pytest.mark.asyncio
async def test_sessions_endpoints_return_404_for_missing_notebook_and_session(client) -> None:
    missing = await client.post(
        "/v1/notebooks/999999/sessions",
        json={"title": "x"},
    )
    assert missing.status_code == 404

    missing_list = await client.get("/v1/notebooks/999999/sessions")
    assert missing_list.status_code == 404

    notebook_resp = await client.post("/v1/notebooks", json={"name": "Sessions 404"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    get_missing = await client.get(f"/v1/notebooks/{notebook_id}/sessions/999999")
    assert get_missing.status_code == 404

    patch_missing = await client.patch(
        f"/v1/notebooks/{notebook_id}/sessions/999999",
        json={"title": "y"},
    )
    assert patch_missing.status_code == 404

    delete_missing = await client.delete(f"/v1/notebooks/{notebook_id}/sessions/999999")
    assert delete_missing.status_code == 404

    convert_source_missing = await client.post(
        f"/v1/notebooks/{notebook_id}/sessions/999999/convert-to-source",
        json={},
    )
    assert convert_source_missing.status_code == 404

    convert_output_missing = await client.post(
        f"/v1/notebooks/{notebook_id}/sessions/999999/convert-to-output",
        json={"output_type": "BULLETS"},
    )
    assert convert_output_missing.status_code == 404
