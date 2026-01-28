from __future__ import annotations

from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from pydantic_ai import models
from pydantic_ai.models.test import TestModel
from sqlalchemy.pool import StaticPool

from crystalith.agents import search_graph
from crystalith.api.deps import get_embedding_provider
from crystalith.app import create_app
from crystalith.config import DatabaseSettings, Settings
from crystalith.db import create_all, create_db_manager
from crystalith.search import SearchResult
from crystalith.vector_storage import InMemoryVectorStore

from crystalith.tests_support import create_test_models


class FakeEmbeddingProvider:
    provider = "fake"
    model = "fake"

    async def embed(self, texts: list[str]) -> list[list[float]]:
        return [[float(len(text)), 0.0, 1.0] for text in texts]


@pytest.fixture(autouse=True)
def _mock_agent_model(monkeypatch) -> None:
    models.ALLOW_MODEL_REQUESTS = False
    test_model = TestModel()
    monkeypatch.setattr(search_graph, "build_chat_model", lambda _settings: test_model)


@pytest.fixture(autouse=True)
def _mock_searxng_searcher(monkeypatch) -> None:
    """Mock the SearXNGSearcher to return fake search results."""
    async def mock_search(self, query: str, *, mode: str = "Web"):
        return [
            SearchResult(
                title=f"{query} - Result 1",
                url=f"https://example.com/search/{query}",
                snippet=f"This is a search result for {query}",
                engine="mock",
            ),
            SearchResult(
                title=f"{query} - Result 2",
                url=f"https://example.com/articles/{query}",
                snippet=f"Another result for {query}",
                engine="mock",
            ),
        ]

    monkeypatch.setattr(
        "crystalith.agents.search_graph.SearXNGSearcher.search",
        mock_search,
    )


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

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    await manager.close()


@pytest.mark.asyncio
async def test_source_search_returns_stubbed_results(test_client: AsyncClient) -> None:
    created = await test_client.post("/v1/notebooks", json={"name": "Notes"})
    notebook_id = created.json()["id"]

    response = await test_client.post(
        f"/v1/notebooks/{notebook_id}/sources/search",
        json={"query": "langgraph", "engine": "Web", "mode": "Fast Research"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["results"]
    assert "TODO" not in payload["message"]
