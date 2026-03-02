from __future__ import annotations

import pytest

from crystalith.shared.vector_storage import SQLiteVectorStore


@pytest.mark.asyncio
async def test_sqlite_vector_store_add_search_filters_and_removals(tmp_path) -> None:
    store = SQLiteVectorStore(path=tmp_path / "vectors.db")
    try:
        await store.add(
            notebook_id=1,
            source_id=1,
            chunk_ids=[10, 11],
            vectors=[
                [1.0, 0.0, 0.0],
                [1.0, 1.0, 0.0],
            ],
        )
        await store.add(
            notebook_id=1,
            source_id=2,
            chunk_ids=[20],
            vectors=[[0.0, 1.0, 0.0]],
        )

        results = await store.search(
            notebook_id=1,
            query_vector=[1.0, 0.0, 0.0],
            top_k=10,
            min_score=0.0,
        )
        assert [item.entry.chunk_id for item in results] == [10, 11, 20]
        assert results[0].score > results[1].score > results[2].score

        results_min_score = await store.search(
            notebook_id=1,
            query_vector=[1.0, 0.0, 0.0],
            top_k=10,
            min_score=0.1,
        )
        assert [item.entry.chunk_id for item in results_min_score] == [10, 11]

        only_source_2 = await store.search(
            notebook_id=1,
            query_vector=[1.0, 0.0, 0.0],
            top_k=10,
            min_score=0.0,
            source_ids=[2],
        )
        assert [item.entry.chunk_id for item in only_source_2] == [20]

        exclude_source_1 = await store.search(
            notebook_id=1,
            query_vector=[1.0, 0.0, 0.0],
            top_k=10,
            min_score=0.0,
            exclude_source_ids=[1],
        )
        assert [item.entry.chunk_id for item in exclude_source_1] == [20]

        await store.remove_source(1)
        after_remove_source = await store.search(
            notebook_id=1,
            query_vector=[1.0, 0.0, 0.0],
            top_k=10,
            min_score=0.0,
        )
        assert [item.entry.chunk_id for item in after_remove_source] == [20]

        await store.remove_notebook(1)
        after_remove_notebook = await store.search(
            notebook_id=1,
            query_vector=[1.0, 0.0, 0.0],
            top_k=10,
            min_score=0.0,
        )
        assert after_remove_notebook == []
    finally:
        await store.close()


@pytest.mark.asyncio
async def test_sqlite_vector_store_enforces_vector_dimension(tmp_path) -> None:
    store = SQLiteVectorStore(path=tmp_path / "vectors.db")
    try:
        await store.add(
            notebook_id=1,
            source_id=1,
            chunk_ids=[1],
            vectors=[[1.0, 0.0, 0.0]],
        )

        with pytest.raises(ValueError, match="consistent dimensions"):
            await store.add(
                notebook_id=1,
                source_id=1,
                chunk_ids=[2],
                vectors=[[1.0, 0.0]],
            )

        wrong_dim_search = await store.search(
            notebook_id=1,
            query_vector=[1.0, 0.0],
            top_k=10,
            min_score=0.0,
        )
        assert wrong_dim_search == []
    finally:
        await store.close()


@pytest.mark.asyncio
async def test_sqlite_vector_store_search_handles_tied_scores(tmp_path) -> None:
    store = SQLiteVectorStore(path=tmp_path / "vectors.db")
    try:
        await store.add(
            notebook_id=1,
            source_id=1,
            chunk_ids=[1, 2],
            vectors=[
                [1.0, 0.0, 0.0],
                [1.0, 0.0, 0.0],
            ],
        )

        results = await store.search(
            notebook_id=1,
            query_vector=[1.0, 0.0, 0.0],
            top_k=10,
            min_score=0.0,
        )
        assert sorted(item.entry.chunk_id for item in results) == [1, 2]
    finally:
        await store.close()
