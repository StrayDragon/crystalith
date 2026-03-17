from __future__ import annotations

import pytest

from crystalith.shared.agents.deps import StudioDeps
from crystalith.shared.ai.test_provider import TestEmbeddingProvider
from crystalith.shared.cache import InMemoryCache
from crystalith.shared.db import Chunk, Notebook, Source
from crystalith.shared.retrieval import retrieve_context
from crystalith.shared.types import OutputType, SourceStatus
from crystalith.shared.vector_storage import InMemoryVectorStore


class _SeedAwareEmbedder(TestEmbeddingProvider):
    async def embed_batch(self, texts, *, batch_size: int = 100):
        vectors: list[list[float]] = []
        for text in texts:
            if "Output type:" in text:
                vectors.append([0.0, 1.0, 0.0])
            else:
                vectors.append([1.0, 0.0, 0.0])
        return vectors


@pytest.mark.asyncio
async def test_retrieve_context_applies_diversity_cap(db_session, test_settings) -> None:
    notebook = Notebook(name="N")
    db_session.add(notebook)
    await db_session.commit()
    await db_session.refresh(notebook)

    source1 = Source(notebook_id=notebook.id, filename="a.md", status=SourceStatus.READY)
    source2 = Source(notebook_id=notebook.id, filename="b.md", status=SourceStatus.READY)
    db_session.add_all([source1, source2])
    await db_session.flush()

    chunks: list[Chunk] = []
    chunks.append(Chunk(source_id=source1.id, chunk_index=0, text="A0"))
    chunks.append(Chunk(source_id=source1.id, chunk_index=1, text="A1"))
    chunks.append(Chunk(source_id=source1.id, chunk_index=2, text="A2"))
    chunks.append(Chunk(source_id=source2.id, chunk_index=0, text="B0"))
    db_session.add_all(chunks)
    await db_session.commit()
    for chunk in chunks:
        await db_session.refresh(chunk)

    vector_store = InMemoryVectorStore()
    await vector_store.add(
        notebook_id=notebook.id,
        source_id=source1.id,
        chunk_ids=[chunks[0].id, chunks[1].id, chunks[2].id],
        vectors=[[1.0, 0.0, 0.0]] * 3,
    )
    await vector_store.add(
        notebook_id=notebook.id,
        source_id=source2.id,
        chunk_ids=[chunks[3].id],
        vectors=[[1.0, 0.0, 0.0]],
    )

    deps = StudioDeps(
        settings=test_settings,
        session=db_session,
        vector_store=vector_store,
        embedder=TestEmbeddingProvider("test-embed"),
        cache=InMemoryCache(ttl=60),
    )

    retrieved = await retrieve_context(
        deps,
        notebook_id=notebook.id,
        seed="seed",
        source_ids=[source1.id, source2.id],
        output_type=OutputType.PARAGRAPH,
        top_k=10,
        min_score=0.0,
        max_chunks_per_source=1,
        token_budget_tokens=10_000,
    )

    assert retrieved.stats.unique_sources == 2
    assert retrieved.stats.max_chunks_per_source == 1
    assert retrieved.stats.budget_tokens == 10_000
    assert len(retrieved.resolved_chunk_ids) == 2
    assert {chunk.source.id for chunk in retrieved.chunks} == {source1.id, source2.id}


@pytest.mark.asyncio
async def test_retrieve_context_dedups_near_duplicate_text(db_session, test_settings) -> None:
    notebook = Notebook(name="N2")
    db_session.add(notebook)
    await db_session.commit()
    await db_session.refresh(notebook)

    source = Source(notebook_id=notebook.id, filename="a.md", status=SourceStatus.READY)
    db_session.add(source)
    await db_session.flush()

    chunk1 = Chunk(source_id=source.id, chunk_index=0, text="Same text.")
    chunk2 = Chunk(source_id=source.id, chunk_index=1, text="Same   text!")
    db_session.add_all([chunk1, chunk2])
    await db_session.commit()
    await db_session.refresh(chunk1)
    await db_session.refresh(chunk2)

    vector_store = InMemoryVectorStore()
    await vector_store.add(
        notebook_id=notebook.id,
        source_id=source.id,
        chunk_ids=[chunk1.id, chunk2.id],
        vectors=[[1.0, 0.0, 0.0], [1.0, 0.0, 0.0]],
    )

    deps = StudioDeps(
        settings=test_settings,
        session=db_session,
        vector_store=vector_store,
        embedder=TestEmbeddingProvider("test-embed"),
        cache=InMemoryCache(ttl=60),
    )

    retrieved = await retrieve_context(
        deps,
        notebook_id=notebook.id,
        seed="seed",
        source_ids=[source.id],
        output_type=OutputType.PARAGRAPH,
        top_k=10,
        min_score=0.0,
        max_chunks_per_source=10,
        token_budget_tokens=10_000,
    )

    assert retrieved.stats.results == 1
    assert retrieved.stats.max_chunks_per_source == 10
    assert retrieved.stats.budget_tokens == 10_000
    assert len(retrieved.resolved_chunk_ids) == 1


@pytest.mark.asyncio
async def test_retrieve_context_truncates_to_budget(db_session, test_settings) -> None:
    notebook = Notebook(name="N3")
    db_session.add(notebook)
    await db_session.commit()
    await db_session.refresh(notebook)

    source = Source(notebook_id=notebook.id, filename="a.md", status=SourceStatus.READY)
    db_session.add(source)
    await db_session.flush()

    chunk = Chunk(source_id=source.id, chunk_index=0, text="word " * 500)
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

    retrieved = await retrieve_context(
        deps,
        notebook_id=notebook.id,
        seed="seed",
        source_ids=[source.id],
        output_type=OutputType.PARAGRAPH,
        top_k=5,
        min_score=0.0,
        token_budget_tokens=10,
    )

    assert retrieved.context_text
    assert retrieved.stats.truncated is True
    assert retrieved.stats.budget_tokens == 10


@pytest.mark.asyncio
async def test_retrieve_context_multi_query_quality_merges_results(db_session, test_settings, monkeypatch) -> None:
    # Mock reason: explicit env control is required to exercise the multi-query quality branch.
    monkeypatch.setenv("CRYSTALITH_RETRIEVAL_MULTI_QUERY", "1")

    notebook = Notebook(name="N4")
    db_session.add(notebook)
    await db_session.commit()
    await db_session.refresh(notebook)

    source = Source(notebook_id=notebook.id, filename="a.md", status=SourceStatus.READY)
    db_session.add(source)
    await db_session.flush()

    chunk1 = Chunk(source_id=source.id, chunk_index=0, text="A0")
    chunk2 = Chunk(source_id=source.id, chunk_index=1, text="B0")
    db_session.add_all([chunk1, chunk2])
    await db_session.commit()
    await db_session.refresh(chunk1)
    await db_session.refresh(chunk2)

    vector_store = InMemoryVectorStore()
    await vector_store.add(
        notebook_id=notebook.id,
        source_id=source.id,
        chunk_ids=[chunk1.id, chunk2.id],
        vectors=[[1.0, 0.0, 0.0], [0.0, 1.0, 0.0]],
    )

    deps = StudioDeps(
        settings=test_settings,
        session=db_session,
        vector_store=vector_store,
        embedder=_SeedAwareEmbedder("test-embed"),
        cache=InMemoryCache(ttl=60),
    )

    retrieved = await retrieve_context(
        deps,
        notebook_id=notebook.id,
        seed="seed",
        source_ids=[source.id],
        output_type=OutputType.PARAGRAPH,
        preference="quality",
        top_k=5,
        min_score=0.0,
        token_budget_tokens=10_000,
    )

    assert retrieved.stats.multi_query_enabled is True
    assert retrieved.stats.seed_cap == 2
    assert retrieved.stats.query_count >= 2
    assert len(retrieved.resolved_chunk_ids) == 2


@pytest.mark.asyncio
async def test_retrieve_context_multi_query_quality_defaults_on(db_session, test_settings) -> None:
    notebook = Notebook(name="N5")
    db_session.add(notebook)
    await db_session.commit()
    await db_session.refresh(notebook)

    source = Source(notebook_id=notebook.id, filename="a.md", status=SourceStatus.READY)
    db_session.add(source)
    await db_session.flush()

    chunk1 = Chunk(source_id=source.id, chunk_index=0, text="A0")
    chunk2 = Chunk(source_id=source.id, chunk_index=1, text="B0")
    db_session.add_all([chunk1, chunk2])
    await db_session.commit()
    await db_session.refresh(chunk1)
    await db_session.refresh(chunk2)

    vector_store = InMemoryVectorStore()
    await vector_store.add(
        notebook_id=notebook.id,
        source_id=source.id,
        chunk_ids=[chunk1.id, chunk2.id],
        vectors=[[1.0, 0.0, 0.0], [0.0, 1.0, 0.0]],
    )

    deps = StudioDeps(
        settings=test_settings,
        session=db_session,
        vector_store=vector_store,
        embedder=_SeedAwareEmbedder("test-embed"),
        cache=InMemoryCache(ttl=60),
    )

    retrieved = await retrieve_context(
        deps,
        notebook_id=notebook.id,
        seed="seed",
        source_ids=[source.id],
        output_type=OutputType.PARAGRAPH,
        preference="quality",
        top_k=5,
        min_score=0.0,
        token_budget_tokens=10_000,
    )

    assert retrieved.stats.multi_query_enabled is True
    assert retrieved.stats.seed_cap == 2
    assert retrieved.stats.query_count >= 2
    assert len(retrieved.resolved_chunk_ids) == 2


@pytest.mark.asyncio
async def test_retrieve_context_multi_query_speed_defaults_off(db_session, test_settings) -> None:
    notebook = Notebook(name="N6")
    db_session.add(notebook)
    await db_session.commit()
    await db_session.refresh(notebook)

    source = Source(notebook_id=notebook.id, filename="a.md", status=SourceStatus.READY)
    db_session.add(source)
    await db_session.flush()

    chunk1 = Chunk(source_id=source.id, chunk_index=0, text="A0")
    chunk2 = Chunk(source_id=source.id, chunk_index=1, text="B0")
    db_session.add_all([chunk1, chunk2])
    await db_session.commit()
    await db_session.refresh(chunk1)
    await db_session.refresh(chunk2)

    vector_store = InMemoryVectorStore()
    await vector_store.add(
        notebook_id=notebook.id,
        source_id=source.id,
        chunk_ids=[chunk1.id, chunk2.id],
        vectors=[[1.0, 0.0, 0.0], [0.0, 1.0, 0.0]],
    )

    deps = StudioDeps(
        settings=test_settings,
        session=db_session,
        vector_store=vector_store,
        embedder=_SeedAwareEmbedder("test-embed"),
        cache=InMemoryCache(ttl=60),
    )

    retrieved = await retrieve_context(
        deps,
        notebook_id=notebook.id,
        seed="seed",
        source_ids=[source.id],
        output_type=OutputType.PARAGRAPH,
        preference="speed",
        top_k=5,
        min_score=0.1,
        token_budget_tokens=10_000,
    )

    assert retrieved.stats.multi_query_enabled is False
    assert retrieved.stats.seed_cap == 2
    assert retrieved.stats.query_count == 1
    assert len(retrieved.resolved_chunk_ids) == 1


@pytest.mark.asyncio
async def test_retrieve_context_multi_query_speed_respects_env_flag(db_session, test_settings, monkeypatch) -> None:
    # Mock reason: explicit env control is required to exercise the multi-query speed override branch.
    monkeypatch.setenv("CRYSTALITH_RETRIEVAL_MULTI_QUERY", "1")

    notebook = Notebook(name="N7")
    db_session.add(notebook)
    await db_session.commit()
    await db_session.refresh(notebook)

    source = Source(notebook_id=notebook.id, filename="a.md", status=SourceStatus.READY)
    db_session.add(source)
    await db_session.flush()

    chunk1 = Chunk(source_id=source.id, chunk_index=0, text="A0")
    chunk2 = Chunk(source_id=source.id, chunk_index=1, text="B0")
    db_session.add_all([chunk1, chunk2])
    await db_session.commit()
    await db_session.refresh(chunk1)
    await db_session.refresh(chunk2)

    vector_store = InMemoryVectorStore()
    await vector_store.add(
        notebook_id=notebook.id,
        source_id=source.id,
        chunk_ids=[chunk1.id, chunk2.id],
        vectors=[[1.0, 0.0, 0.0], [0.0, 1.0, 0.0]],
    )

    deps = StudioDeps(
        settings=test_settings,
        session=db_session,
        vector_store=vector_store,
        embedder=_SeedAwareEmbedder("test-embed"),
        cache=InMemoryCache(ttl=60),
    )

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

    assert retrieved.stats.multi_query_enabled is True
    assert retrieved.stats.seed_cap == 2
    assert retrieved.stats.query_count >= 2
    assert len(retrieved.resolved_chunk_ids) == 2


@pytest.mark.asyncio
async def test_retrieve_context_multi_query_quality_can_be_disabled(db_session, test_settings, monkeypatch) -> None:
    # Mock reason: explicit env control is required to verify the quality-path disable flag.
    monkeypatch.setenv("CRYSTALITH_RETRIEVAL_MULTI_QUERY", "0")

    notebook = Notebook(name="N8")
    db_session.add(notebook)
    await db_session.commit()
    await db_session.refresh(notebook)

    source = Source(notebook_id=notebook.id, filename="a.md", status=SourceStatus.READY)
    db_session.add(source)
    await db_session.flush()

    chunk1 = Chunk(source_id=source.id, chunk_index=0, text="A0")
    chunk2 = Chunk(source_id=source.id, chunk_index=1, text="B0")
    db_session.add_all([chunk1, chunk2])
    await db_session.commit()
    await db_session.refresh(chunk1)
    await db_session.refresh(chunk2)

    vector_store = InMemoryVectorStore()
    await vector_store.add(
        notebook_id=notebook.id,
        source_id=source.id,
        chunk_ids=[chunk1.id, chunk2.id],
        vectors=[[1.0, 0.0, 0.0], [0.0, 1.0, 0.0]],
    )

    deps = StudioDeps(
        settings=test_settings,
        session=db_session,
        vector_store=vector_store,
        embedder=_SeedAwareEmbedder("test-embed"),
        cache=InMemoryCache(ttl=60),
    )

    retrieved = await retrieve_context(
        deps,
        notebook_id=notebook.id,
        seed="seed",
        source_ids=[source.id],
        output_type=OutputType.PARAGRAPH,
        preference="quality",
        top_k=5,
        min_score=0.1,
        token_budget_tokens=10_000,
    )

    assert retrieved.stats.multi_query_enabled is False
    assert retrieved.stats.seed_cap == 2
    assert retrieved.stats.query_count == 1
    assert len(retrieved.resolved_chunk_ids) == 1


@pytest.mark.asyncio
async def test_retrieve_context_tuning_drives_budget_caps_and_query_count(db_session, test_settings) -> None:
    notebook = Notebook(name="N9")
    db_session.add(notebook)
    await db_session.commit()
    await db_session.refresh(notebook)

    source = Source(notebook_id=notebook.id, filename="a.md", status=SourceStatus.READY)
    db_session.add(source)
    await db_session.flush()

    chunk1 = Chunk(source_id=source.id, chunk_index=0, text="A0")
    chunk2 = Chunk(source_id=source.id, chunk_index=1, text="B0")
    db_session.add_all([chunk1, chunk2])
    await db_session.commit()
    await db_session.refresh(chunk1)
    await db_session.refresh(chunk2)

    vector_store = InMemoryVectorStore()
    await vector_store.add(
        notebook_id=notebook.id,
        source_id=source.id,
        chunk_ids=[chunk1.id, chunk2.id],
        vectors=[[1.0, 0.0, 0.0], [0.0, 1.0, 0.0]],
    )

    deps = StudioDeps(
        settings=test_settings,
        session=db_session,
        vector_store=vector_store,
        embedder=_SeedAwareEmbedder("test-embed"),
        cache=InMemoryCache(ttl=60),
    )

    paragraph = await retrieve_context(
        deps,
        notebook_id=notebook.id,
        seed="seed",
        source_ids=[source.id],
        output_type=OutputType.PARAGRAPH,
        preference="quality",
        top_k=5,
        min_score=0.0,
    )

    slides = await retrieve_context(
        deps,
        notebook_id=notebook.id,
        seed="seed",
        source_ids=[source.id],
        output_type=OutputType.SLIDES,
        preference="quality",
        top_k=5,
        min_score=0.0,
    )

    assert paragraph.stats.multi_query_enabled is True
    assert paragraph.stats.seed_cap == 2
    assert paragraph.stats.query_count == 2
    assert paragraph.stats.max_chunks_per_source == 3
    assert paragraph.stats.budget_tokens == 6000

    assert slides.stats.multi_query_enabled is True
    assert slides.stats.seed_cap == 3
    assert slides.stats.query_count == 3
    assert slides.stats.max_chunks_per_source == 2
    assert slides.stats.budget_tokens == 6800
