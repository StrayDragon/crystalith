from __future__ import annotations

import pytest

from crystalith.shared.vector_storage.chroma import ChromaVectorStore
from crystalith.shared.vector_storage.memory import InMemoryVectorStore
from crystalith.shared.vector_storage.migration import (
    migrate_in_memory_to_sqlite,
    migrate_sqlite_to_chroma,
)
from crystalith.shared.vector_storage.sqlite import SQLiteVectorStore


@pytest.mark.asyncio
async def test_migrate_in_memory_to_sqlite_roundtrip(tmp_path) -> None:
    source = InMemoryVectorStore()
    await source.add(
        notebook_id=1,
        source_id=10,
        chunk_ids=[1, 2],
        vectors=[[1.0, 0.0], [0.0, 1.0]],
    )

    target = SQLiteVectorStore(path=tmp_path / "vectors.db")
    await migrate_in_memory_to_sqlite(source, target)

    entries = list(await target.entries())
    assert {(e.notebook_id, e.source_id, e.chunk_id) for e in entries} == {
        (1, 10, 1),
        (1, 10, 2),
    }

    await target.close()


@pytest.mark.asyncio
async def test_migrate_sqlite_to_chroma(tmp_path) -> None:
    sqlite = SQLiteVectorStore(path=tmp_path / "vectors.db")
    await sqlite.add(
        notebook_id=1,
        source_id=10,
        chunk_ids=[100],
        vectors=[[1.0, 0.0]],
    )

    chroma = ChromaVectorStore(path=tmp_path / "chroma")
    await migrate_sqlite_to_chroma(sqlite, chroma)

    results = await chroma.search(
        notebook_id=1,
        query_vector=[1.0, 0.0],
        top_k=5,
        min_score=0.0,
    )
    assert results
    assert results[0].entry.chunk_id == 100

    await sqlite.close()
