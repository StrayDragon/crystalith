from __future__ import annotations

import asyncio
import inspect
import json
import struct
from pathlib import Path
from typing import Iterable, Sequence

import sqlalchemy as sa
from cl_logs import get_logger
from sqlalchemy import text

from cl_sqlalchemyx.mgrs import AsyncDBManager

from crystalith.db import create_db_manager

from .types import VectorEntry, VectorSearchResult

logger = get_logger(__name__)


def _serialize_vector(vector: Sequence[float]) -> bytes:
    """Serialize a vector of floats into raw bytes for sqlite-vss."""
    return struct.pack(f"{len(vector)}f", *vector)


_CONFIG_TABLE = "vector_config"
_ENTRIES_TABLE = "vector_entries"
_INDEX_TABLE = "vector_index"


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
        self._vss_ready = False
        self._sqlite_vss = self._load_vss_extension()

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
                if self._sqlite_vss is not None and self._vss_ready:
                    try:
                        await conn.execute(
                            text(
                                f"""
                                INSERT INTO {_INDEX_TABLE} (rowid, embedding)
                                VALUES (:rowid, :embedding)
                                """
                            ),
                            {
                                "rowid": entry_id,
                                "embedding": _serialize_vector(vector),
                            },
                        )
                    except Exception as exc:
                        # sqlite-vss failed, disable it and fall back to brute-force
                        logger.warning(
                            "sqlite-vss insert failed, disabling VSS and falling back to brute-force search: %s",
                            exc,
                        )
                        self._sqlite_vss = None
                        self._vss_ready = False

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

        if self._sqlite_vss is None or not self._vss_ready:
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

        query_blob = _serialize_vector(query)

        # Build source filter condition
        if source_id_set is not None:
            source_filter = f"AND m.source_id IN ({','.join(str(sid) for sid in source_id_set)})"
        else:
            source_filter = ""

        async with self._engine.connect() as conn:
            result = await conn.execute(
                text(
                    f"""
                    SELECT m.notebook_id, m.source_id, m.chunk_id, m.vector, v.distance
                    FROM {_INDEX_TABLE} AS v
                    JOIN {_ENTRIES_TABLE} AS m ON v.rowid = m.id
                    WHERE m.notebook_id = :notebook_id
                      {source_filter}
                      AND vss_search(v.embedding, :query)
                    ORDER BY v.distance
                    LIMIT :top_k
                    """
                ),
                {
                    "notebook_id": notebook_id,
                    "query": query_blob,
                    "top_k": top_k,
                },
            )
            rows = result.fetchall()

        results: list[VectorSearchResult] = []
        for row in rows:
            vector = json.loads(row.vector)
            score = _cosine_similarity(query, vector)
            if score < min_score:
                continue
            entry = VectorEntry(
                notebook_id=row.notebook_id,
                source_id=row.source_id,
                chunk_id=row.chunk_id,
                vector=vector,
            )
            results.append(VectorSearchResult(entry=entry, score=score))

        results.sort(key=lambda item: item.score, reverse=True)
        return results[:top_k]

    async def remove_source(self, source_id: int) -> None:
        await self._ensure_schema()
        async with self._engine.begin() as conn:
            if self._vss_ready:
                # sqlite-vss doesn't support DELETE with subquery, so we first get the rowids
                result = await conn.execute(
                    text(f"SELECT id FROM {_ENTRIES_TABLE} WHERE source_id = :source_id"),
                    {"source_id": source_id},
                )
                rowids = [row.id for row in result.fetchall()]
                for rowid in rowids:
                    await conn.execute(
                        text(f"DELETE FROM {_INDEX_TABLE} WHERE rowid = :rowid"),
                        {"rowid": rowid},
                    )
            await conn.execute(
                text(f"DELETE FROM {_ENTRIES_TABLE} WHERE source_id = :source_id"),
                {"source_id": source_id},
            )

    async def remove_notebook(self, notebook_id: int) -> None:
        await self._ensure_schema()
        async with self._engine.begin() as conn:
            if self._vss_ready:
                # sqlite-vss doesn't support DELETE with subquery, so we first get the rowids
                result = await conn.execute(
                    text(f"SELECT id FROM {_ENTRIES_TABLE} WHERE notebook_id = :notebook_id"),
                    {"notebook_id": notebook_id},
                )
                rowids = [row.id for row in result.fetchall()]
                for rowid in rowids:
                    await conn.execute(
                        text(f"DELETE FROM {_INDEX_TABLE} WHERE rowid = :rowid"),
                        {"rowid": rowid},
                    )
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

    def _load_vss_extension(self):
        try:
            import sqlite_vss
        except ImportError as exc:
            logger.warning(
                "sqlite-vss unavailable; falling back to brute-force vector search."
            )
            return None
        if not hasattr(sqlite_vss, "load"):
            logger.warning(
                "sqlite-vss missing required load function; falling back to brute-force vector search."
            )
            return None

        def _unwrap_connection(dbapi_connection):
            candidates = [dbapi_connection]
            for attr in ("driver_connection", "connection", "_connection", "_conn"):
                candidate = getattr(dbapi_connection, attr, None)
                if candidate is None:
                    continue
                candidates.append(candidate)
                nested = getattr(candidate, "connection", None)
                if nested is not None:
                    candidates.append(nested)
                nested = getattr(candidate, "_conn", None)
                if nested is not None:
                    candidates.append(nested)
            for candidate in candidates:
                load_extension = getattr(candidate, "load_extension", None)
                if load_extension is None:
                    continue
                if inspect.iscoroutinefunction(load_extension):
                    continue
                return candidate
            return None

        def _load_extension(dbapi_connection, _connection_record) -> None:
            if self._sqlite_vss is None:
                return
            raw_connection = _unwrap_connection(dbapi_connection)
            if raw_connection is None:
                logger.warning(
                    "Unable to access sqlite connection for sqlite-vss loading; "
                    "falling back to brute-force vector search."
                )
                self._sqlite_vss = None
                self._vss_ready = False
                return
            enable = getattr(raw_connection, "enable_load_extension", None)
            if callable(enable):
                enable(True)
            try:
                sqlite_vss.load(raw_connection)
            except Exception as exc:
                logger.warning(
                    "Failed to load sqlite-vss extension; "
                    "falling back to brute-force vector search: %s",
                    exc,
                )
                self._sqlite_vss = None
                self._vss_ready = False
            finally:
                if callable(enable):
                    enable(False)

        sa.event.listen(self._engine.sync_engine, "connect", _load_extension)
        return sqlite_vss

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
                    if self._sqlite_vss is not None:
                        await conn.execute(text(self._vss_table_sql(self._dimension)))
                        self._vss_ready = True
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
                if self._sqlite_vss is not None:
                    await conn.execute(text(self._vss_table_sql(dimension)))
                    self._vss_ready = True
            self._dimension = dimension

    def _vss_table_sql(self, dimension: int) -> str:
        return (
            f"CREATE VIRTUAL TABLE IF NOT EXISTS {_INDEX_TABLE} "
            f"USING vss0(embedding({dimension}), metric=cosine)"
        )

    @staticmethod
    def _build_database_url(path: str | Path) -> str:
        resolved = Path(path)
        if resolved.is_absolute():
            return f"sqlite+aiosqlite:///{resolved.as_posix()}"
        if resolved.as_posix() == ":memory:":
            return "sqlite+aiosqlite:///:memory:"
        return f"sqlite+aiosqlite:///./{resolved.as_posix()}"
