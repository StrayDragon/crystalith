from __future__ import annotations

import pytest

from crystalith.shared.vector_storage import InMemoryVectorStore, SQLiteVectorStore


@pytest.mark.asyncio
async def test_in_memory_vector_store_entries_support_filters() -> None:
    store = InMemoryVectorStore()
    await store.add(notebook_id=1, source_id=10, chunk_ids=[100], vectors=[[1.0]])
    await store.add(notebook_id=2, source_id=20, chunk_ids=[200], vectors=[[2.0]])
    await store.add(notebook_id=1, source_id=11, chunk_ids=[101], vectors=[[3.0]])

    assert len(list(await store.entries())) == 3
    scoped = list(await store.entries(notebook_id=1))
    assert {entry.notebook_id for entry in scoped} == {1}
    assert {entry.source_id for entry in scoped} == {10, 11}

    source_scoped = list(await store.entries(notebook_id=1, source_ids=[11]))
    assert [(entry.notebook_id, entry.source_id) for entry in source_scoped] == [(1, 11)]


@pytest.mark.asyncio
async def test_sqlite_vector_store_entries_support_filters(tmp_path) -> None:
    store = SQLiteVectorStore(path=tmp_path / "vectors.db")
    try:
        await store.add(notebook_id=1, source_id=10, chunk_ids=[100], vectors=[[1.0, 0.0]])
        await store.add(notebook_id=2, source_id=20, chunk_ids=[200], vectors=[[0.0, 1.0]])
        await store.add(notebook_id=1, source_id=11, chunk_ids=[101], vectors=[[1.0, 1.0]])

        assert len(list(await store.entries())) == 3
        scoped = list(await store.entries(notebook_id=1))
        assert {entry.notebook_id for entry in scoped} == {1}
        assert {entry.source_id for entry in scoped} == {10, 11}

        source_scoped = list(await store.entries(notebook_id=1, source_ids=[11]))
        assert [(entry.notebook_id, entry.source_id) for entry in source_scoped] == [(1, 11)]
    finally:
        await store.close()
