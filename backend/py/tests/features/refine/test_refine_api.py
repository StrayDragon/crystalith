from __future__ import annotations

import asyncio

import pytest
from httpx import ASGITransport, AsyncClient

from crystalith.shared.db import Chunk, Source
from crystalith.shared.deps import get_ai_provider
from crystalith.shared.types import SourceStatus


class _BatchChatSpy:
    provider = "test"
    model = "batch-spy"

    def __init__(self) -> None:
        self.current = 0
        self.max_seen = 0

    async def chat(self, messages):
        self.current += 1
        self.max_seen = max(self.max_seen, self.current)
        await asyncio.sleep(0.01)
        self.current -= 1
        return "Test answer"

    async def chat_stream(self, messages):
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
    app.dependency_overrides[get_ai_provider] = lambda: chatter

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
        app.dependency_overrides.pop(get_ai_provider, None)

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


@pytest.mark.asyncio
async def test_refine_task_queue_runs_and_formats_response(app) -> None:
    transport = ASGITransport(app=app)
    async with app.router.lifespan_context(app), AsyncClient(transport=transport, base_url="http://test") as client:
        notebook_resp = await client.post("/v1/notebooks", json={"name": "Refine Queue Notebook"})
        assert notebook_resp.status_code == 201
        notebook_id = notebook_resp.json()["id"]

        async with app.state.db.got_manual_session() as session:
            source = Source(
                notebook_id=notebook_id,
                filename="Refine Queue Doc.md",
                status=SourceStatus.READY,
            )
            session.add(source)
            await session.flush()
            chunk = Chunk(source_id=source.id, chunk_index=1, text="Refine queue chunk")
            session.add(chunk)
            await session.commit()

        await app.state.vector_store.add(
            notebook_id=notebook_id,
            source_id=source.id,
            chunk_ids=[chunk.id],
            vectors=[[1.0, 0.0, 0.0]],
        )

        for format_name in ["paragraph", "bullets", "structured"]:
            resp = await client.post(
                f"/v1/notebooks/{notebook_id}/refine",
                json={
                    "prompt": "Summarize",
                    "format": format_name,
                    "source_ids": [source.id],
                },
            )
            assert resp.status_code == 200
            payload = resp.json()

            assert payload["format"] == format_name
            assert payload["evidence"] is True
            assert payload["citations"]
            assert payload["created_at"]

            assert all(citation["source_id"] == source.id for citation in payload["citations"])

            if format_name == "paragraph":
                assert payload["paragraph"] == "Test answer"
            elif format_name == "bullets":
                assert payload["bullets"] == ["Test bullet 1", "Test bullet 2", "Test bullet 3"]
            else:
                assert payload["structured"]["title"] == "Test title"
                assert payload["structured"]["bullets"] == ["Test bullet 1", "Test bullet 2"]
                assert payload["structured"]["terms"] == ["Test term"]
