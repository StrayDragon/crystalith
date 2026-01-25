from __future__ import annotations

from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from pydantic_ai import models
from pydantic_ai.models.test import TestModel
from sqlalchemy.pool import StaticPool

from crystalith.agents import output_graph
from crystalith.api.deps import get_embedding_provider
from crystalith.app import create_app
from crystalith.config import DatabaseSettings, Settings
from crystalith.db import create_all, create_db_manager
from crystalith.outputs import OutputType
from crystalith.tasks import TaskQueue
from crystalith.vector_storage import InMemoryVectorStore

from crystalith.tests_support import create_test_models


class FakeEmbeddingProvider:
    provider = "fake"
    model = "fake"

    async def embed(self, texts: list[str]) -> list[list[float]]:
        if len(texts) == 1 and texts[0] == "__empty__":
            return []
        return [[float(len(text)), 0.0, 1.0] for text in texts]


class FakeChatProvider:
    provider = "fake"
    model = "fake"

    async def chat(self, messages) -> str:
        system_text = messages[0].content
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
        return "{}"


@pytest.fixture(autouse=True)
def _mock_agent_model(monkeypatch) -> None:
    models.ALLOW_MODEL_REQUESTS = False
    test_model = TestModel()
    monkeypatch.setattr(output_graph, "build_chat_model", lambda _settings: test_model)


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
    task_queue = TaskQueue(
        db_manager=manager,
        settings=settings,
        vector_store=vector_store,
        embedder_factory=lambda _settings: FakeEmbeddingProvider(),
        chat_factory=lambda _settings: FakeChatProvider(),
    )
    app = create_app(
        settings,
        db_manager=manager,
        vector_store=vector_store,
        task_queue=task_queue,
    )
    app.dependency_overrides[get_embedding_provider] = lambda: FakeEmbeddingProvider()
    await app.state.task_queue.start_worker()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    await manager.close()


async def _create_notebook_with_source(client: AsyncClient) -> int:
    created = await client.post("/v1/notebooks", json={"name": "Notes"})
    notebook_id = created.json()["id"]
    upload = await client.post(
        f"/v1/notebooks/{notebook_id}/sources",
        files={"file": ("note.md", b"hello world", "text/markdown")},
    )
    assert upload.status_code == 201
    return notebook_id


def _assert_citations(content: dict, output_type: OutputType) -> None:
    if output_type == OutputType.FAQ:
        assert content["items"][0]["citations"][0]["chunk_id"]
    elif output_type == OutputType.GUIDE:
        assert content["modules"][0]["objective"]["citations"][0]["chunk_id"]
        assert content["modules"][0]["key_points"][0]["citations"][0]["chunk_id"]
    elif output_type == OutputType.TIMELINE:
        assert content["events"][0]["citations"][0]["chunk_id"]
    elif output_type == OutputType.MINDMAP:
        assert content["root"]["citations"][0]["chunk_id"]
        assert content["root"]["children"][0]["citations"][0]["chunk_id"]
    elif output_type == OutputType.QUIZ:
        assert content["questions"][0]["citations"][0]["chunk_id"]
    elif output_type == OutputType.BRIEFING:
        assert content["sections"][0]["points"][0]["citations"][0]["chunk_id"]
    elif output_type == OutputType.PARAGRAPH:
        assert content["citations"][0]["chunk_id"]
    elif output_type == OutputType.BULLETS:
        assert content["items"][0]["citations"][0]["chunk_id"]
    elif output_type == OutputType.STRUCTURED:
        assert content["bullets"][0]["citations"][0]["chunk_id"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "output_type",
    [
        OutputType.FAQ,
        OutputType.GUIDE,
        OutputType.TIMELINE,
        OutputType.MINDMAP,
        OutputType.QUIZ,
        OutputType.BRIEFING,
        OutputType.PARAGRAPH,
        OutputType.BULLETS,
        OutputType.STRUCTURED,
    ],
)
async def test_outputs_create_per_type(test_client: AsyncClient, output_type: OutputType) -> None:
    notebook_id = await _create_notebook_with_source(test_client)
    response = await test_client.post(
        f"/v1/notebooks/{notebook_id}/outputs/{output_type.value}",
        json={"prompt": "summarize"},
    )
    assert response.status_code == 201
    payload = response.json()
    assert payload["type"] == output_type.value
    _assert_citations(payload["content"], output_type)


@pytest.mark.asyncio
async def test_outputs_create_multiple(test_client: AsyncClient) -> None:
    notebook_id = await _create_notebook_with_source(test_client)
    faq_response = await test_client.post(
        f"/v1/notebooks/{notebook_id}/outputs/{OutputType.FAQ.value}",
        json={"prompt": "summarize"},
    )
    guide_response = await test_client.post(
        f"/v1/notebooks/{notebook_id}/outputs/{OutputType.GUIDE.value}",
        json={"prompt": "summarize"},
    )
    assert faq_response.status_code == 201
    assert guide_response.status_code == 201
    faq_payload = faq_response.json()
    guide_payload = guide_response.json()
    assert faq_payload["type"] == OutputType.FAQ.value
    assert guide_payload["type"] == OutputType.GUIDE.value
    _assert_citations(faq_payload["content"], OutputType.FAQ)
    _assert_citations(guide_payload["content"], OutputType.GUIDE)


@pytest.mark.asyncio
async def test_outputs_list(test_client: AsyncClient) -> None:
    notebook_id = await _create_notebook_with_source(test_client)
    faq = await test_client.post(
        f"/v1/notebooks/{notebook_id}/outputs/{OutputType.FAQ.value}",
        json={"prompt": "summarize"},
    )
    timeline = await test_client.post(
        f"/v1/notebooks/{notebook_id}/outputs/{OutputType.TIMELINE.value}",
        json={"prompt": "summarize"},
    )
    assert faq.status_code == 201
    assert timeline.status_code == 201

    response = await test_client.get(f"/v1/notebooks/{notebook_id}/outputs")
    assert response.status_code == 200
    payload = response.json()
    returned_types = {item["type"] for item in payload}
    assert {OutputType.FAQ.value, OutputType.TIMELINE.value} <= returned_types


@pytest.mark.asyncio
async def test_output_detail(test_client: AsyncClient) -> None:
    notebook_id = await _create_notebook_with_source(test_client)
    created = await test_client.post(
        f"/v1/notebooks/{notebook_id}/outputs/{OutputType.FAQ.value}",
        json={"prompt": "summarize"},
    )
    assert created.status_code == 201
    output_id = created.json()["id"]

    response = await test_client.get(f"/v1/notebooks/{notebook_id}/outputs/{output_id}")
    assert response.status_code == 200
    payload = response.json()
    assert payload["id"] == output_id
