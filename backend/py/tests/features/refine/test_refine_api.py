from __future__ import annotations

import asyncio

import pytest

from crystalith.shared.db import Chunk, Source
from crystalith.shared.deps import get_chat_provider
from crystalith.shared.types import SourceStatus


class _BatchChatSpy:
    provider = "test"
    model = "batch-spy"

    def __init__(self) -> None:
        self.current = 0
        self.max_seen = 0

    async def chat(self, messages):  # noqa: ANN001
        self.current += 1
        self.max_seen = max(self.max_seen, self.current)
        await asyncio.sleep(0.01)
        self.current -= 1
        return "Test answer"

    async def chat_stream(self, messages):  # noqa: ANN001
        if False:
            yield ""


@pytest.mark.asyncio
async def test_refine_not_found(client):
    resp = await client.post(
        "/v1/notebooks/9999/refine",
        json={"prompt": "test"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_refine_batch_generates_all_formats_with_parallel_calls(client, db_session, app):
    create_resp = await client.post("/v1/notebooks", json={"name": "Refine Notebook"})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()["id"]

    source = Source(
        notebook_id=notebook_id,
        filename="Refine Doc.md",
        status=SourceStatus.READY,
    )
    db_session.add(source)
    await db_session.flush()
    chunk = Chunk(source_id=source.id, chunk_index=1, text="Refine chunk")
    db_session.add(chunk)
    await db_session.commit()

    await app.state.vector_store.add(
        notebook_id=notebook_id,
        source_id=source.id,
        chunk_ids=[chunk.id],
        vectors=[[1.0, 0.0, 0.0]],
    )

    chatter = _BatchChatSpy()
    app.dependency_overrides[get_chat_provider] = lambda: chatter

    try:
        resp = await client.post(
            f"/v1/notebooks/{notebook_id}/refine/batch",
            json={
                "prompt": "Summarize",
                "formats": ["paragraph", "bullets", "structured"],
                "source_ids": [source.id],
            },
        )
    finally:
        app.dependency_overrides.pop(get_chat_provider, None)

    assert resp.status_code == 200
    payload = resp.json()

    assert payload["evidence"] is True
    assert payload["citations"]
    assert set(payload["outputs"].keys()) == {"paragraph", "bullets", "structured"}
    assert payload["outputs"]["paragraph"]["paragraph"]
    assert payload["outputs"]["bullets"]["bullets"]
    assert payload["outputs"]["structured"]["structured"]["title"]

    assert chatter.max_seen > 1
    assert chatter.max_seen <= 3
