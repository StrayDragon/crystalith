from __future__ import annotations

import pytest

from crystalith.vector_storage import InMemoryVectorStore


@pytest.mark.asyncio
async def test_vector_index_filters_by_notebook_and_min_score() -> None:
    index = InMemoryVectorStore()
    await index.add(
        notebook_id=1,
        source_id=10,
        chunk_ids=[1, 2],
        vectors=[[1.0, 0.0], [0.0, 1.0]],
    )
    await index.add(
        notebook_id=2,
        source_id=20,
        chunk_ids=[3],
        vectors=[[1.0, 0.0]],
    )

    results = await index.search(
        notebook_id=1,
        query_vector=[1.0, 0.0],
        top_k=5,
        min_score=0.2,
    )

    assert [result.entry.chunk_id for result in results] == [1]
    assert results[0].score == pytest.approx(1.0)


@pytest.mark.asyncio
async def test_vector_index_orders_by_score_and_top_k() -> None:
    index = InMemoryVectorStore()
    await index.add(
        notebook_id=1,
        source_id=10,
        chunk_ids=[1, 2],
        vectors=[[1.0, 0.0], [0.5, 0.5]],
    )

    results = await index.search(
        notebook_id=1,
        query_vector=[1.0, 0.0],
        top_k=1,
        min_score=0.0,
    )

    assert len(results) == 1
    assert results[0].entry.chunk_id == 1
