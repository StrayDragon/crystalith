from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Iterable, Sequence

from sqlalchemy import text

from cl_sqlalchemyx.mgrs import AsyncDBManager

from crystalith.shared.db import create_db_manager

from .types import VectorEntry, VectorSearchResult


_CONFIG_TABLE = "vector_config"
_ENTRIES_TABLE = "vector_entries"


def _dot(left: Sequence[float], right: Sequence[float]) -> float:
    return sum(a * b for a, b in zip(left, right))


def _norm(vector: Sequence[float]) -> float:
    return sum(value * value for value in vector) ** 0.5


def _cosine_similarity(left: Sequence[float], right: Sequence[float]) -> float:
    left_norm = _norm(left)
    right_norm = _norm(right)
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return _dot(left, right) / (left_norm * right_norm)


class SQLiteVectorStore:
    def __init__(
        self,
        *,
        path: str | Path,
        manager: AsyncDBManager | None = None,
    ) -> None:
        self._owns_manager = manager is None
        self._manager = manager or create_db_manager(
            self._build_database_url(path),
            connect_args={"check_same_thread": False},
        )
        self._engine = self._manager.async_engine
        self._init_lock = asyncio.Lock()
        self._initialized = False
        self._dimension: int | None = None

    async def add(
        self,
        *,
        notebook_id: int,
        source_id: int,
        chunk_ids: Sequence[int],
        vectors: Sequence[Sequence[float]],
    ) -> None:
        vectors_list = [list(vector) for vector in vectors]
        if len(chunk_ids) != len(vectors_list):
            raise ValueError("chunk_ids length must match vectors length")
        if not vectors_list:
            return

        expected_dim = len(vectors_list[0])
        for vector in vectors_list[1:]:
            if len(vector) != expected_dim:
                raise ValueError("vectors must have consistent dimensions")

        await self._ensure_schema()
        await self._ensure_dimension(expected_dim)

        async with self._engine.begin() as conn:
            for chunk_id, vector in zip(chunk_ids, vectors_list):
                vector_json = json.dumps(vector, separators=(",", ":"))
                result = await conn.execute(
                    text(
                        f"""
                        INSERT INTO {_ENTRIES_TABLE}
                        (notebook_id, source_id, chunk_id, vector)
                        VALUES (:notebook_id, :source_id, :chunk_id, :vector)
                        """
                    ),
                    {
                        "notebook_id": notebook_id,
                        "source_id": source_id,
                        "chunk_id": chunk_id,
                        "vector": vector_json,
                    },
                )
                entry_id = result.lastrowid
                if entry_id is None:
                    raise RuntimeError("Failed to insert vector entry")

    async def upsert(
        self,
        *,
        notebook_id: int,
        source_id: int,
        chunk_id: int,
        vector: Sequence[float],
    ) -> None:
        await self.add(
            notebook_id=notebook_id,
            source_id=source_id,
            chunk_ids=[chunk_id],
            vectors=[vector],
        )

    async def search(
        self,
        *,
        notebook_id: int,
        query_vector: Sequence[float],
        top_k: int = 5,
        min_score: float = 0.2,
        source_ids: Sequence[int] | None = None,
    ) -> list[VectorSearchResult]:
        query = list(query_vector)
        if not query:
            return []

        await self._ensure_schema()
        if self._dimension is None:
            return []
        if len(query) != self._dimension:
            return []

        source_id_set = set(source_ids) if source_ids else None

        return await self._brute_force_search(
            notebook_id=notebook_id,
            query=query,
            top_k=top_k,
            min_score=min_score,
            source_id_set=source_id_set,
        )

    async def _brute_force_search(
        self,
        *,
        notebook_id: int,
        query: list[float],
        top_k: int,
        min_score: float,
        source_id_set: set[int] | None,
    ) -> list[VectorSearchResult]:
        """Perform brute-force vector search using cosine similarity."""
        entries = [entry for entry in await self.entries() if entry.notebook_id == notebook_id]
        if source_id_set is not None:
            entries = [entry for entry in entries if entry.source_id in source_id_set]
        results: list[VectorSearchResult] = []
        for entry in entries:
            score = _cosine_similarity(query, entry.vector)
            if score < min_score:
                continue
            results.append(VectorSearchResult(entry=entry, score=score))
        results.sort(key=lambda item: item.score, reverse=True)
        return results[:top_k]

    async def remove_source(self, source_id: int) -> None:
        await self._ensure_schema()
        async with self._engine.begin() as conn:
            await conn.execute(
                text(f"DELETE FROM {_ENTRIES_TABLE} WHERE source_id = :source_id"),
                {"source_id": source_id},
            )

    async def remove_notebook(self, notebook_id: int) -> None:
        await self._ensure_schema()
        async with self._engine.begin() as conn:
            await conn.execute(
                text(f"DELETE FROM {_ENTRIES_TABLE} WHERE notebook_id = :notebook_id"),
                {"notebook_id": notebook_id},
            )

    async def entries(self) -> Iterable[VectorEntry]:
        await self._ensure_schema()
        async with self._engine.connect() as conn:
            result = await conn.execute(
                text(
                    f"""
                    SELECT notebook_id, source_id, chunk_id, vector
                    FROM {_ENTRIES_TABLE}
                    ORDER BY id
                    """
                )
            )
            rows = result.fetchall()

        entries: list[VectorEntry] = []
        for row in rows:
            vector = json.loads(row.vector)
            entries.append(
                VectorEntry(
                    notebook_id=row.notebook_id,
                    source_id=row.source_id,
                    chunk_id=row.chunk_id,
                    vector=vector,
                )
            )
        return entries

    async def close(self) -> None:
        if self._owns_manager:
            await self._manager.close()

    async def _ensure_schema(self) -> None:
        if self._initialized:
            return
        async with self._init_lock:
            if self._initialized:
                return
            async with self._engine.begin() as conn:
                await conn.execute(
                    text(
                        f"""
                        CREATE TABLE IF NOT EXISTS {_CONFIG_TABLE} (
                            key TEXT PRIMARY KEY,
                            value TEXT NOT NULL
                        )
                        """
                    )
                )
                await conn.execute(
                    text(
                        f"""
                        CREATE TABLE IF NOT EXISTS {_ENTRIES_TABLE} (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            notebook_id INTEGER NOT NULL,
                            source_id INTEGER NOT NULL,
                            chunk_id INTEGER NOT NULL,
                            vector TEXT NOT NULL
                        )
                        """
                    )
                )
                await conn.execute(
                    text(
                        f"CREATE INDEX IF NOT EXISTS ix_vector_entries_notebook_id ON {_ENTRIES_TABLE} (notebook_id)"
                    )
                )
                await conn.execute(
                    text(
                        f"CREATE INDEX IF NOT EXISTS ix_vector_entries_source_id ON {_ENTRIES_TABLE} (source_id)"
                    )
                )

                result = await conn.execute(
                    text(f"SELECT value FROM {_CONFIG_TABLE} WHERE key = 'dimension'")
                )
                row = result.first()
                if row is not None:
                    self._dimension = int(row.value)
            self._initialized = True

    async def _ensure_dimension(self, dimension: int) -> None:
        if self._dimension == dimension:
            return
        if self._dimension is not None and self._dimension != dimension:
            raise ValueError("vectors must have consistent dimensions")

        async with self._init_lock:
            if self._dimension == dimension:
                return
            if self._dimension is not None and self._dimension != dimension:
                raise ValueError("vectors must have consistent dimensions")
            async with self._engine.begin() as conn:
                await conn.execute(
                    text(
                        f"""
                        INSERT OR REPLACE INTO {_CONFIG_TABLE} (key, value)
                        VALUES ('dimension', :value)
                        """
                    ),
                    {"value": str(dimension)},
                )
            self._dimension = dimension

    @staticmethod
    def _build_database_url(path: str | Path) -> str:
        resolved = Path(path)
        if resolved.is_absolute():
            return f"sqlite+aiosqlite:///{resolved.as_posix()}"
        if resolved.as_posix() == ":memory:":
            return "sqlite+aiosqlite:///:memory:"
        return f"sqlite+aiosqlite:///./{resolved.as_posix()}"
