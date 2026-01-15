from __future__ import annotations

import sqlite3

import pytest

from crystalith.vector_storage import InMemoryVectorStore, SQLiteVectorStore
from crystalith.vector_storage.migration import migrate_vector_store


sqlite_vss = pytest.importorskip("sqlite_vss")
try:
    _conn = sqlite3.connect(":memory:")
    try:
        sqlite_vss.load(_conn)
    finally:
        _conn.close()
except Exception as exc:  # noqa: BLE001
    pytest.skip(f"sqlite-vss unavailable: {exc}", allow_module_level=True)


@pytest.mark.asyncio
async def test_sqlite_vector_store_add_search_remove(tmp_path) -> None:
    store = SQLiteVectorStore(path=tmp_path / "vectors.db")

    await store.add(
        notebook_id=1,
        source_id=10,
        chunk_ids=[1, 2],
        vectors=[[1.0, 0.0], [0.0, 1.0]],
    )
    await store.add(
        notebook_id=2,
        source_id=20,
        chunk_ids=[3],
        vectors=[[1.0, 0.0]],
    )

    results = await store.search(
        notebook_id=1,
        query_vector=[1.0, 0.0],
        top_k=2,
        min_score=0.0,
    )
    assert results
    assert results[0].entry.chunk_id == 1
    assert results[0].score == pytest.approx(1.0)

    await store.remove_source(10)
    after_remove_source = await store.search(
        notebook_id=1,
        query_vector=[1.0, 0.0],
        top_k=5,
        min_score=0.0,
    )
    assert after_remove_source == []

    await store.remove_notebook(2)
    remaining = await store.search(
        notebook_id=2,
        query_vector=[1.0, 0.0],
        top_k=5,
        min_score=0.0,
    )
    assert remaining == []

    await store.close()


@pytest.mark.asyncio
async def test_migrate_memory_to_sqlite(tmp_path) -> None:
    source = InMemoryVectorStore()
    await source.add(
        notebook_id=1,
        source_id=10,
        chunk_ids=[1, 2],
        vectors=[[1.0, 0.0], [0.0, 1.0]],
    )

    target = SQLiteVectorStore(path=tmp_path / "vectors.db")
    await migrate_vector_store(source, target)

    results = await target.search(
        notebook_id=1,
        query_vector=[1.0, 0.0],
        top_k=5,
        min_score=0.0,
    )
    assert [item.entry.chunk_id for item in results] == [1, 2]

    await target.close()
