from __future__ import annotations

import json
from collections.abc import AsyncGenerator, AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.pool import StaticPool

from crystalith.api.deps import get_chat_provider, get_embedding_provider
from crystalith.app import create_app
from crystalith.config import DatabaseSettings, Settings
from crystalith.db import create_all, create_db_manager
from crystalith.vector_storage import InMemoryVectorStore


class FakeEmbeddingProvider:
    provider = "fake"
    model = "fake"

    async def embed(self, texts: list[str]) -> list[list[float]]:
        if len(texts) == 1 and texts[0] == "__empty__":
            return []
        return [[float(len(text)), 0.0, 1.0] for text in texts]


class FakeStreamingChatProvider:
    provider = "fake"
    model = "fake"

    async def chat(self, messages) -> str:
        assert messages, "messages must not be empty"
        return "mocked answer"

    async def chat_stream(self, messages) -> AsyncIterator[str]:
        assert messages, "messages must not be empty"
        chunks = ["Hello", " ", "world", "!"]
        for chunk in chunks:
            yield chunk


@pytest_asyncio.fixture
async def test_client() -> AsyncGenerator[AsyncClient, None]:
    settings = Settings(database=DatabaseSettings(url="sqlite+aiosqlite:///:memory:"))
    manager = create_db_manager(
        settings.database.url,
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    await create_all(manager.async_engine)

    vector_store = InMemoryVectorStore()
    app = create_app(settings, db_manager=manager, vector_store=vector_store)
    app.dependency_overrides[get_embedding_provider] = lambda: FakeEmbeddingProvider()
    app.dependency_overrides[get_chat_provider] = lambda: FakeStreamingChatProvider()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    await manager.close()


def parse_sse_events(content: str) -> list[tuple[str, dict]]:
    """Parse SSE events from response content."""
    events = []
    for block in content.strip().split("\n\n"):
        if not block:
            continue
        lines = block.split("\n")
        event_type = None
        data = None
        for line in lines:
            if line.startswith("event: "):
                event_type = line[7:]
            elif line.startswith("data: "):
                data = json.loads(line[6:])
        if event_type and data is not None:
            events.append((event_type, data))
    return events


@pytest.mark.asyncio
async def test_qa_stream_with_citations(test_client: AsyncClient) -> None:
    """Test streaming QA with valid sources returns chunks and done event."""
    created = await test_client.post("/v1/notebooks", json={"name": "Notes"})
    notebook_id = created.json()["id"]

    upload = await test_client.post(
        f"/v1/notebooks/{notebook_id}/sources",
        files={"file": ("note.md", b"hello world", "text/markdown")},
    )
    assert upload.status_code == 201

    response = await test_client.post(
        f"/v1/notebooks/{notebook_id}/qa/stream",
        json={"question": "hello?"},
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/event-stream; charset=utf-8"

    events = parse_sse_events(response.text)
    assert len(events) >= 2

    # Check chunk events
    chunk_events = [e for e in events if e[0] == "chunk"]
    assert len(chunk_events) >= 1
    combined_text = "".join(e[1]["text"] for e in chunk_events)
    assert combined_text  # Should have some text

    # Check done event
    done_events = [e for e in events if e[0] == "done"]
    assert len(done_events) == 1
    done_data = done_events[0][1]
    assert done_data["evidence"] is True
    assert 0.0 <= done_data["confidence"] <= 1.0
    assert done_data["citations"]
    assert done_data["citations"][0]["source_name"] == "note.md"


@pytest.mark.asyncio
async def test_qa_stream_no_evidence(test_client: AsyncClient) -> None:
    """Test streaming QA with no sources returns no evidence."""
    created = await test_client.post("/v1/notebooks", json={"name": "Empty"})
    notebook_id = created.json()["id"]

    response = await test_client.post(
        f"/v1/notebooks/{notebook_id}/qa/stream",
        json={"question": "unknown"},
    )
    assert response.status_code == 200

    events = parse_sse_events(response.text)

    # Should have chunk with no evidence message and done event
    chunk_events = [e for e in events if e[0] == "chunk"]
    assert len(chunk_events) >= 1

    done_events = [e for e in events if e[0] == "done"]
    assert len(done_events) == 1
    done_data = done_events[0][1]
    assert done_data["evidence"] is False
    assert done_data["confidence"] == 0.0
    assert done_data["citations"] == []


@pytest.mark.asyncio
async def test_qa_stream_empty_embedding(test_client: AsyncClient) -> None:
    """Test streaming QA with empty embedding returns no evidence."""
    created = await test_client.post("/v1/notebooks", json={"name": "Notes"})
    notebook_id = created.json()["id"]

    upload = await test_client.post(
        f"/v1/notebooks/{notebook_id}/sources",
        files={"file": ("note.md", b"hello world", "text/markdown")},
    )
    assert upload.status_code == 201

    response = await test_client.post(
        f"/v1/notebooks/{notebook_id}/qa/stream",
        json={"question": "__empty__"},
    )
    assert response.status_code == 200

    events = parse_sse_events(response.text)
    done_events = [e for e in events if e[0] == "done"]
    assert len(done_events) == 1
    assert done_events[0][1]["evidence"] is False


@pytest.mark.asyncio
async def test_qa_stream_notebook_not_found(test_client: AsyncClient) -> None:
    """Test streaming QA with non-existent notebook returns 404."""
    response = await test_client.post(
        "/v1/notebooks/99999/qa/stream",
        json={"question": "hello?"},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_qa_stream_session_not_found(test_client: AsyncClient) -> None:
    """Test streaming QA with non-existent session returns 404."""
    created = await test_client.post("/v1/notebooks", json={"name": "Notes"})
    notebook_id = created.json()["id"]

    response = await test_client.post(
        f"/v1/notebooks/{notebook_id}/qa/stream",
        json={"question": "hello?", "session_id": 99999},
    )
    assert response.status_code == 404
