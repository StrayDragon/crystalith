from __future__ import annotations

from collections.abc import AsyncGenerator, Sequence

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.pool import StaticPool

from crystalith.analysis import cluster_topics, detect_contradictions, detect_relations
from crystalith.analysis.types import Relation
from crystalith.api.deps import get_chat_provider
from crystalith.app import create_app
from crystalith.config import DatabaseSettings, Settings
from crystalith.db import Chunk, Notebook, Source, SourceStatus, create_all, create_db_manager
from crystalith.vector_storage import VectorEntry


class DummyChatProvider:
    provider = "openai"
    model = "dummy"

    def __init__(self, response: str) -> None:
        self._response = response

    async def chat(self, messages: Sequence) -> str:
        return self._response


class DummyVectorStore:
    def __init__(self, entries: list[VectorEntry]) -> None:
        self._entries = entries

    async def add(self, **kwargs) -> None:  # pragma: no cover - not used in tests
        raise NotImplementedError

    async def search(self, **kwargs):  # pragma: no cover - not used in tests
        raise NotImplementedError

    async def remove_source(self, source_id: int) -> None:  # pragma: no cover - not used
        return None

    async def remove_notebook(self, notebook_id: int) -> None:  # pragma: no cover - not used
        return None

    async def entries(self) -> list[VectorEntry]:
        return list(self._entries)


@pytest.mark.asyncio
async def test_detect_contradictions_llm() -> None:
    relations = [
        Relation(
            source_chunk_id=1,
            target_chunk_id=2,
            relation_type="similar",
            score=0.9,
        )
    ]
    chunk_texts = {1: "The policy allows access.", 2: "The policy forbids access."}
    contradictions = await detect_contradictions(
        relations,
        chunk_texts,
        DummyChatProvider("yes"),
        max_checks=1,
    )
    assert len(contradictions) == 1
    assert contradictions[0].relation_type == "contradicts"


def test_detect_relations_cosine_similarity() -> None:
    entries = [
        VectorEntry(notebook_id=1, source_id=1, chunk_id=1, vector=[1.0, 0.0]),
        VectorEntry(notebook_id=1, source_id=2, chunk_id=2, vector=[0.9, 0.1]),
        VectorEntry(notebook_id=1, source_id=1, chunk_id=3, vector=[0.0, 1.0]),
    ]
    relations = detect_relations(entries, min_score=0.8, max_relations=5)
    assert len(relations) == 1
    relation = relations[0]
    assert {relation.source_chunk_id, relation.target_chunk_id} == {1, 2}
    assert relation.relation_type == "similar"
    assert relation.score == pytest.approx(0.993, rel=1e-3)


def test_cluster_topics_groups_similar_vectors() -> None:
    entries = [
        VectorEntry(notebook_id=1, source_id=1, chunk_id=1, vector=[1.0, 0.0]),
        VectorEntry(notebook_id=1, source_id=2, chunk_id=2, vector=[0.95, 0.05]),
        VectorEntry(notebook_id=1, source_id=3, chunk_id=3, vector=[0.0, 1.0]),
        VectorEntry(notebook_id=1, source_id=4, chunk_id=4, vector=[0.05, 0.95]),
    ]
    chunk_texts = {
        1: "Cats are small mammals.",
        2: "Cats often hunt at night.",
        3: "Solar energy comes from the sun.",
        4: "Sunlight powers solar panels.",
    }
    topics = cluster_topics(entries, chunk_texts, min_similarity=0.8, max_topics=5)
    grouped = [set(topic.chunk_ids) for topic in topics]
    assert len(topics) == 2
    assert {1, 2} in grouped
    assert {3, 4} in grouped


@pytest_asyncio.fixture
async def analysis_client() -> AsyncGenerator[tuple[AsyncClient, int], None]:
    settings = Settings(database=DatabaseSettings(url="sqlite+aiosqlite:///:memory:"))
    manager = create_db_manager(
        settings.database.url,
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    await create_all(manager.async_engine)

    async with manager.got_manual_session() as session:
        notebook = Notebook(name="Notes")
        session.add(notebook)
        await session.commit()
        await session.refresh(notebook)

        source_a = Source(
            notebook_id=notebook.id,
            filename="doc-a.txt",
            mime_type=None,
            parser_type="text",
            status=SourceStatus.READY,
        )
        source_b = Source(
            notebook_id=notebook.id,
            filename="doc-b.txt",
            mime_type=None,
            parser_type="text",
            status=SourceStatus.READY,
        )
        session.add_all([source_a, source_b])
        await session.commit()
        await session.refresh(source_a)
        await session.refresh(source_b)

        chunk_a = Chunk(
            source_id=source_a.id,
            chunk_index=0,
            text="Access is granted by default.",
            start_offset=0,
            end_offset=30,
            metadata_=None,
        )
        chunk_b = Chunk(
            source_id=source_b.id,
            chunk_index=0,
            text="Access is denied by default.",
            start_offset=0,
            end_offset=29,
            metadata_=None,
        )
        session.add_all([chunk_a, chunk_b])
        await session.flush()
        await session.commit()

        entries = [
            VectorEntry(
                notebook_id=notebook.id,
                source_id=source_a.id,
                chunk_id=chunk_a.id,
                vector=[1.0, 0.0],
            ),
            VectorEntry(
                notebook_id=notebook.id,
                source_id=source_b.id,
                chunk_id=chunk_b.id,
                vector=[0.95, 0.05],
            ),
        ]

    vector_store = DummyVectorStore(entries)
    app = create_app(settings, db_manager=manager, vector_store=vector_store)
    app.dependency_overrides[get_chat_provider] = lambda: DummyChatProvider("yes")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client, notebook.id

    await manager.close()


@pytest.mark.asyncio
async def test_analysis_api_returns_results(analysis_client: tuple[AsyncClient, int]) -> None:
    client, notebook_id = analysis_client
    response = await client.get(f"/v1/notebooks/{notebook_id}/analysis")
    assert response.status_code == 200

    payload = response.json()
    assert payload["relations"]
    assert payload["topics"]
    assert payload["contradictions"]
    assert payload["contradictions"][0]["relation_type"] == "contradicts"
