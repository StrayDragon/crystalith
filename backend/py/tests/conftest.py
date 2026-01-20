"""Common test fixtures and utilities for Crystalith tests."""

from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Any

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from pydantic_ai import models
from pydantic_ai.models.test import TestModel
from sqlalchemy.pool import StaticPool

from crystalith.api.deps import get_chat_provider, get_embedding_provider
from crystalith.app import create_app
from crystalith.config import DatabaseSettings, Settings
from crystalith.db import create_all, create_db_manager
from crystalith.tasks import TaskQueue
from crystalith.vector_storage import InMemoryVectorStore


class FakeEmbeddingProvider:
    """Fake embedding provider for testing."""

    provider = "fake"
    model = "fake"

    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Generate fake embeddings based on text length."""
        if len(texts) == 1 and texts[0] == "__empty__":
            return []
        if len(texts) == 1 and texts[0] == "__low__":
            return [[0.0, 1.0, 0.0]]
        return [[float(len(text)), 0.0, 1.0] for text in texts]


class FakeChatProvider:
    """Fake chat provider for testing."""

    provider = "fake"
    model = "fake"

    async def chat(self, messages: list[Any]) -> str:
        """Return mock responses based on system prompt content."""
        if not messages:
            return "mocked answer"

        system_text = messages[0].content if messages else ""

        # Output type specific responses
        if "Output type: FAQ" in system_text:
            return '{"items":[{"question":"Q1","answer":"A1","citations":[1]}]}'
        if "Output type: GUIDE" in system_text:
            return (
                '{"modules":[{"title":"Module 1","objective":{"text":"Obj","citations":[1]},'
                '"key_points":[{"text":"K1","citations":[1]}],'
                '"examples":[{"text":"Ex1","citations":[1]}],'
                '"exercises":[{"text":"Ex1","citations":[1]}]}]}'
            )
        if "Output type: TIMELINE" in system_text:
            return '{"events":[{"date":"2020","event":"Event","description":"Desc","citations":[1]}]}'
        if "Output type: MINDMAP" in system_text:
            return (
                '{"root":{"label":"Root","citations":[1],"children":'
                '[{"label":"Child","citations":[1],"children":[]} ]}}'
            )
        if "Output type: QUIZ" in system_text:
            return (
                '{"questions":[{"type":"multiple_choice","question":"Q","options":["A","B"],'
                '"answer":"A","explanation":"Because","citations":[1]}]}'
            )
        if "Output type: BRIEFING" in system_text:
            return '{"sections":[{"heading":"Background","points":[{"text":"P1","citations":[1]}]}]}'
        if "Output type: PARAGRAPH" in system_text:
            return '{"text":"Summary","citations":[1]}'
        if "Output type: BULLETS" in system_text:
            return '{"items":[{"text":"B1","citations":[1]}]}'
        if "Output type: STRUCTURED" in system_text:
            return '{"title":"Summary","bullets":[{"text":"B1","citations":[1]}],"terms":["T1"]}'

        # Refine format responses
        if "bullet points" in system_text.lower():
            return "- Point 1\n- Point 2\n- Point 3"
        if "json" in system_text.lower() and "title" in system_text.lower():
            return '{"title": "Test Title", "bullets": ["Point 1", "Point 2"], "terms": ["Term 1"]}'

        return "mocked answer"


@pytest.fixture
def test_settings() -> Settings:
    """Create test settings with in-memory database."""
    return Settings(database=DatabaseSettings(url="sqlite+aiosqlite:///:memory:"))


@pytest.fixture
def fake_embedding_provider() -> FakeEmbeddingProvider:
    """Create a fake embedding provider."""
    return FakeEmbeddingProvider()


@pytest.fixture
def fake_chat_provider() -> FakeChatProvider:
    """Create a fake chat provider."""
    return FakeChatProvider()


@pytest_asyncio.fixture
async def test_client(
    test_settings: Settings,
    fake_embedding_provider: FakeEmbeddingProvider,
    fake_chat_provider: FakeChatProvider,
) -> AsyncGenerator[AsyncClient, None]:
    """Create a test client with mocked providers."""
    manager = create_db_manager(
        test_settings.database.url,
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    await create_all(manager.async_engine)

    vector_store = InMemoryVectorStore()
    task_queue = TaskQueue(
        db_manager=manager,
        settings=test_settings,
        vector_store=vector_store,
        embedder_factory=lambda _settings: fake_embedding_provider,
        chat_factory=lambda _settings: fake_chat_provider,
    )
    app = create_app(
        test_settings,
        db_manager=manager,
        vector_store=vector_store,
        task_queue=task_queue,
    )
    app.dependency_overrides[get_embedding_provider] = lambda: fake_embedding_provider
    app.dependency_overrides[get_chat_provider] = lambda: fake_chat_provider
    await app.state.task_queue.start_worker()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    await manager.close()


@pytest_asyncio.fixture
async def test_client_simple(
    test_settings: Settings,
    fake_embedding_provider: FakeEmbeddingProvider,
    fake_chat_provider: FakeChatProvider,
) -> AsyncGenerator[AsyncClient, None]:
    """Create a simple test client without task queue."""
    manager = create_db_manager(
        test_settings.database.url,
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    await create_all(manager.async_engine)

    vector_store = InMemoryVectorStore()
    app = create_app(test_settings, db_manager=manager, vector_store=vector_store)
    app.dependency_overrides[get_embedding_provider] = lambda: fake_embedding_provider
    app.dependency_overrides[get_chat_provider] = lambda: fake_chat_provider

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    await manager.close()


async def create_notebook(client: AsyncClient, name: str = "Test Notebook") -> int:
    """Helper to create a notebook and return its ID."""
    response = await client.post("/v1/notebooks", json={"name": name})
    assert response.status_code == 201
    return response.json()["id"]


async def create_notebook_with_source(
    client: AsyncClient,
    name: str = "Test Notebook",
    source_content: bytes = b"hello world test content",
    source_filename: str = "test.md",
) -> int:
    """Helper to create a notebook with a source and return the notebook ID."""
    notebook_id = await create_notebook(client, name)
    upload = await client.post(
        f"/v1/notebooks/{notebook_id}/sources",
        files={"file": (source_filename, source_content, "text/markdown")},
    )
    assert upload.status_code == 201
    return notebook_id


async def create_session(client: AsyncClient, notebook_id: int, title: str | None = None) -> int:
    """Helper to create a session and return its ID."""
    response = await client.post(
        f"/v1/notebooks/{notebook_id}/sessions",
        json={"title": title} if title else {},
    )
    assert response.status_code == 201
    return response.json()["id"]
