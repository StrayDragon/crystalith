from __future__ import annotations

from collections import defaultdict

from .chroma import ChromaVectorStore
from .interfaces import VectorStore
from .memory import InMemoryVectorStore
from .sqlite import SQLiteVectorStore
from .types import VectorEntry


async def migrate_vector_store(source: VectorStore, target: VectorStore) -> None:
    entries = list(await source.entries())
    if not entries:
        return

    grouped: dict[tuple[int, int], list[VectorEntry]] = defaultdict(list)
    for entry in entries:
        grouped[(entry.notebook_id, entry.source_id)].append(entry)

    for (notebook_id, source_id), group in grouped.items():
        chunk_ids = [entry.chunk_id for entry in group]
        vectors = [entry.vector for entry in group]
        await target.add(
            notebook_id=notebook_id,
            source_id=source_id,
            chunk_ids=chunk_ids,
            vectors=vectors,
        )


async def migrate_in_memory_to_sqlite(
    source: InMemoryVectorStore,
    target: SQLiteVectorStore,
) -> None:
    await migrate_vector_store(source, target)


async def migrate_sqlite_to_chroma(
    source: SQLiteVectorStore,
    target: ChromaVectorStore,
) -> None:
    await migrate_vector_store(source, target)
