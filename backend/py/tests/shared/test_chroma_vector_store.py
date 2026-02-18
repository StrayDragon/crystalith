from __future__ import annotations

import pytest

from crystalith.shared.vector_storage.chroma import ChromaVectorStore


@pytest.mark.asyncio
async def test_chroma_vector_store_add_search_entries_and_removals(tmp_path) -> None:
    store = ChromaVectorStore(path=tmp_path / "chroma")

    await store.add(
        notebook_id=1,
        source_id=10,
        chunk_ids=[100, 101],
        vectors=[[1.0, 0.0], [0.0, 1.0]],
    )

    entries = list(await store.entries())
    assert {entry.chunk_id for entry in entries} == {100, 101}

    results = await store.search(
        notebook_id=1,
        query_vector=[1.0, 0.0],
        top_k=5,
        min_score=0.0,
    )
    assert results
    assert results[0].entry.notebook_id == 1
    assert results[0].entry.source_id == 10

    filtered = await store.search(
        notebook_id=1,
        query_vector=[1.0, 0.0],
        top_k=5,
        min_score=0.0,
        source_ids=[10],
    )
    assert filtered

    excluded = await store.search(
        notebook_id=1,
        query_vector=[1.0, 0.0],
        top_k=5,
        min_score=0.0,
        exclude_source_ids=[10],
    )
    assert excluded == []

    await store.remove_source(10)
    assert list(await store.entries()) == []


@pytest.mark.asyncio
async def test_chroma_vector_store_enforces_dimensions_and_query_shape(tmp_path) -> None:
    store = ChromaVectorStore(path=tmp_path / "chroma")

    await store.add(
        notebook_id=1,
        source_id=10,
        chunk_ids=[1],
        vectors=[[1.0, 0.0]],
    )

    with pytest.raises(ValueError, match="consistent dimensions"):
        await store.add(
            notebook_id=1,
            source_id=10,
            chunk_ids=[2],
            vectors=[[1.0, 0.0, 0.0]],
        )

    assert (
        await store.search(
            notebook_id=1,
            query_vector=[1.0, 0.0, 0.0],
            top_k=5,
            min_score=0.0,
        )
        == []
    )
