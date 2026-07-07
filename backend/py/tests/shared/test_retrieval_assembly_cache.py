from __future__ import annotations

import pytest

from crystalith.shared.agents.deps import StudioDeps
from crystalith.shared.ai.test_provider import TestEmbeddingProvider
from crystalith.shared.cache import InMemoryCache
from crystalith.shared.db import Chunk, Notebook, Source
from crystalith.shared.retrieval import retrieve_context
from crystalith.shared.types import OutputType, SourceStatus
from tests.helpers.vector_store import InMemoryVectorStore


@pytest.mark.asyncio
async def test_retrieve_context_assembly_cache_hits(db_session, test_settings, monkeypatch) -> None:
    # Mock reason: env flags are the public switch for assembly cache behavior in retrieval.
    monkeypatch.setenv("CRYSTALITH_RETRIEVAL_ASSEMBLY_CACHE", "1")
    monkeypatch.setenv("CRYSTALITH_RETRIEVAL_ASSEMBLY_CACHE_TTL_S", "1")

    notebook = Notebook(name="cache-hit")
    db_session.add(notebook)
    await db_session.commit()
    await db_session.refresh(notebook)

    source = Source(notebook_id=notebook.id, filename="a.md", status=SourceStatus.READY)
    db_session.add(source)
    await db_session.flush()

    chunk = Chunk(source_id=source.id, chunk_index=0, text="A0")
    db_session.add(chunk)
    await db_session.commit()
    await db_session.refresh(chunk)

    vector_store = InMemoryVectorStore()
    await vector_store.add(
        notebook_id=notebook.id,
        source_id=source.id,
        chunk_ids=[chunk.id],
        vectors=[[1.0, 0.0, 0.0]],
    )

    deps = StudioDeps(
        settings=test_settings,
        session=db_session,
        vector_store=vector_store,
        embedder=TestEmbeddingProvider("test-embed"),
        cache=InMemoryCache(ttl=60),
    )

    first = await retrieve_context(
        deps,
        notebook_id=notebook.id,
        seed="seed",
        source_ids=[source.id],
        output_type=OutputType.PARAGRAPH,
        preference="speed",
        top_k=5,
        min_score=0.0,
        token_budget_tokens=10_000,
    )
    assert first.stats.cache_hit is False
    assert first.stats.reused_chunk_ids is False

    second = await retrieve_context(
        deps,
        notebook_id=notebook.id,
        seed="seed",
        source_ids=[source.id],
        output_type=OutputType.PARAGRAPH,
        preference="speed",
        top_k=5,
        min_score=0.0,
        token_budget_tokens=10_000,
    )
    assert second.stats.cache_hit is True
    assert second.stats.reused_chunk_ids is True
    assert second.resolved_chunk_ids == first.resolved_chunk_ids
    assert second.stats.query_count == first.stats.query_count


@pytest.mark.asyncio
async def test_retrieve_context_assembly_cache_ttl_expires(db_session, test_settings, monkeypatch) -> None:
    # Mock reason: env flags are the public switch for assembly cache behavior in retrieval.
    monkeypatch.setenv("CRYSTALITH_RETRIEVAL_ASSEMBLY_CACHE", "1")
    monkeypatch.setenv("CRYSTALITH_RETRIEVAL_ASSEMBLY_CACHE_TTL_S", "0.01")

    now = 0.0

    def _monotonic() -> float:
        return now

    # Mock reason: deterministic monotonic clock control for TTL expiry assertions.
    monkeypatch.setattr("crystalith.shared.cache.in_memory.time.monotonic", _monotonic)

    notebook = Notebook(name="cache-ttl")
    db_session.add(notebook)
    await db_session.commit()
    await db_session.refresh(notebook)

    source = Source(notebook_id=notebook.id, filename="a.md", status=SourceStatus.READY)
    db_session.add(source)
    await db_session.flush()

    chunk = Chunk(source_id=source.id, chunk_index=0, text="A0")
    db_session.add(chunk)
    await db_session.commit()
    await db_session.refresh(chunk)

    vector_store = InMemoryVectorStore()
    await vector_store.add(
        notebook_id=notebook.id,
        source_id=source.id,
        chunk_ids=[chunk.id],
        vectors=[[1.0, 0.0, 0.0]],
    )

    deps = StudioDeps(
        settings=test_settings,
        session=db_session,
        vector_store=vector_store,
        embedder=TestEmbeddingProvider("test-embed"),
        cache=InMemoryCache(ttl=60),
    )

    await retrieve_context(
        deps,
        notebook_id=notebook.id,
        seed="seed",
        source_ids=[source.id],
        output_type=OutputType.PARAGRAPH,
        preference="speed",
        top_k=5,
        min_score=0.0,
        token_budget_tokens=10_000,
    )

    now = 0.02

    retrieved = await retrieve_context(
        deps,
        notebook_id=notebook.id,
        seed="seed",
        source_ids=[source.id],
        output_type=OutputType.PARAGRAPH,
        preference="speed",
        top_k=5,
        min_score=0.0,
        token_budget_tokens=10_000,
    )
    assert retrieved.stats.cache_hit is False
