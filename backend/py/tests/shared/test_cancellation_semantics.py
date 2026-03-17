from __future__ import annotations

import asyncio

import pytest
from sqlalchemy import select

from crystalith.shared.agents.deps import StudioDeps
from crystalith.shared.agents.output_graph import run_output_graph
from crystalith.shared.ai.test_provider import TestEmbeddingProvider
from crystalith.shared.db import Notebook, Output, Source
from crystalith.shared.retrieval import RetrievalStats, RetrievedContext
from crystalith.shared.types import OutputType, SourceStatus


@pytest.mark.asyncio
async def test_output_graph_cancellation_does_not_persist(app, db_session, monkeypatch) -> None:
    notebook = Notebook(name="N")
    db_session.add(notebook)
    await db_session.commit()
    await db_session.refresh(notebook)

    source = Source(
        notebook_id=notebook.id,
        filename="Doc.md",
        status=SourceStatus.READY,
    )
    db_session.add(source)
    await db_session.commit()
    await db_session.refresh(source)

    async def _fake_retrieve_context(*_args, **_kwargs) -> RetrievedContext:
        return RetrievedContext(
            context_text="",
            resolved_chunk_ids=[],
            chunks=[],
            stats=RetrievalStats(
                results=0,
                unique_sources=0,
                avg_score=None,
                truncated=False,
                max_chunks_per_source=1,
                budget_tokens=None,
                used_tokens=None,
                reused_chunk_ids=False,
                query_count=1,
                multi_query_enabled=False,
                seed_cap=1,
                fusion_strategy="rrf",
                cache_hit=False,
            ),
            timings_ms={},
        )

    import crystalith.shared.agents.output_graph as output_graph_module

    # Mock reason: force retrieval path to stay in-memory for deterministic cancellation behavior.
    monkeypatch.setattr(output_graph_module, "retrieve_context", _fake_retrieve_context, raising=True)

    async def _cancelled_run(self, *_args, **_kwargs):
        raise asyncio.CancelledError()

    # Mock reason: directly inject CancelledError from model execution path.
    monkeypatch.setattr(output_graph_module.Agent, "run", _cancelled_run, raising=True)

    deps = StudioDeps(
        settings=app.state.settings,
        session=db_session,
        vector_store=app.state.vector_store,
        embedder=TestEmbeddingProvider("test-embed"),
        cache=None,
        limiters=app.state.limiters,
    )

    with pytest.raises(asyncio.CancelledError):
        await run_output_graph(
            notebook_id=notebook.id,
            output_type=OutputType.BULLETS,
            prompt="P",
            deps=deps,
            source_ids=[source.id],
        )

    rows = await db_session.execute(select(Output))
    assert rows.scalars().all() == []


@pytest.mark.asyncio
async def test_slides_generator_cancellation_does_not_fallback(app, db_session, monkeypatch) -> None:
    import crystalith.features.studio.slides.generator as slides_generator_module
    from crystalith.features.studio.slides.generator import generate_slides_outline

    async def _fake_retrieve_context(*_args, **_kwargs) -> RetrievedContext:
        return RetrievedContext(
            context_text="ctx",
            resolved_chunk_ids=[],
            chunks=[],
            stats=RetrievalStats(
                results=0,
                unique_sources=0,
                avg_score=None,
                truncated=False,
                max_chunks_per_source=1,
                budget_tokens=None,
                used_tokens=None,
                reused_chunk_ids=False,
                query_count=1,
                multi_query_enabled=False,
                seed_cap=1,
                fusion_strategy="rrf",
                cache_hit=False,
            ),
            timings_ms={},
        )

    # Mock reason: force retrieval path to stay in-memory for deterministic cancellation behavior.
    monkeypatch.setattr(slides_generator_module, "retrieve_context", _fake_retrieve_context, raising=True)

    async def _cancelled_run(self, *_args, **_kwargs):
        raise asyncio.CancelledError()

    # Mock reason: directly inject CancelledError from model execution path.
    monkeypatch.setattr(slides_generator_module.Agent, "run", _cancelled_run, raising=True)

    deps = StudioDeps(
        settings=app.state.settings,
        session=db_session,
        vector_store=app.state.vector_store,
        embedder=TestEmbeddingProvider("test-embed"),
        cache=None,
        limiters=app.state.limiters,
    )

    with pytest.raises(asyncio.CancelledError):
        await generate_slides_outline(
            deps,
            notebook_id=1,
            title="T",
            prompt="P",
            source_ids=[1],
            generation_config={"preference": "quality"},
        )
