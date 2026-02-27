from __future__ import annotations

from collections.abc import Iterable, Sequence
from pathlib import Path
from typing import cast

import chromadb
from chromadb.api.types import Metadatas, PyEmbeddings, Where
from chromadb.config import Settings as ChromaSettings

from .types import VectorEntry, VectorSearchResult


class ChromaVectorStore:
    def __init__(
        self,
        *,
        path: str | Path,
        collection_name: str = "vector_entries",
        telemetry: bool = False,
    ) -> None:
        self._path = Path(path)
        settings = ChromaSettings(anonymized_telemetry=telemetry)
        self._client = chromadb.PersistentClient(path=str(self._path), settings=settings)
        self._collection = self._client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"},
        )
        self._dimension: int | None = None
        self._dimension = self._load_dimension()

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

        self._ensure_dimension(expected_dim)

        ids = [self._build_id(notebook_id, source_id, chunk_id) for chunk_id in chunk_ids]
        metadatas = cast(Metadatas, [
            {
                "notebook_id": notebook_id,
                "source_id": source_id,
                "chunk_id": chunk_id,
            }
            for chunk_id in chunk_ids
        ])
        self._collection.upsert(
            ids=ids,
            embeddings=cast(PyEmbeddings, vectors_list),
            metadatas=metadatas,
        )

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
        exclude_source_ids: Sequence[int] | None = None,
    ) -> list[VectorSearchResult]:
        query = list(query_vector)
        if not query:
            return []

        dimension = self._load_dimension()
        if dimension is None or len(query) != dimension:
            return []

        clauses: list[dict[str, object]] = [{"notebook_id": notebook_id}]
        if source_ids:
            clauses.append({"source_id": {"$in": list(source_ids)}})
        if exclude_source_ids:
            clauses.append({"source_id": {"$nin": list(exclude_source_ids)}})

        where_obj: dict[str, object]
        if len(clauses) == 1:
            where_obj = clauses[0]
        else:
            where_obj = {"$and": clauses}

        results = self._collection.query(
            query_embeddings=cast(PyEmbeddings, [query]),
            n_results=top_k,
            where=cast(Where, where_obj),
            include=["metadatas", "distances"],
        )

        metadatas = results.get("metadatas")
        distances = results.get("distances")
        if metadatas is None:
            metadatas = []
        if distances is None:
            distances = []

        if len(metadatas) == 0:
            return []

        query_metadatas = metadatas[0] if len(metadatas) > 0 else []
        query_distances = distances[0] if len(distances) > 0 else []

        output: list[VectorSearchResult] = []
        for idx, metadata in enumerate(query_metadatas):
            if not isinstance(metadata, dict):
                continue
            distance = query_distances[idx] if idx < len(query_distances) else None
            score = 0.0 if distance is None else 1.0 - float(distance)
            if score < min_score:
                continue
            metadata_obj = cast(dict[str, object], metadata)
            entry = VectorEntry(
                notebook_id=int(cast(int, metadata_obj.get("notebook_id"))),
                source_id=int(cast(int, metadata_obj.get("source_id"))),
                chunk_id=int(cast(int, metadata_obj.get("chunk_id"))),
                vector=[],
            )
            output.append(VectorSearchResult(entry=entry, score=score))

        output.sort(key=lambda item: item.score, reverse=True)
        return output

    async def search_many(
        self,
        *,
        notebook_id: int,
        query_vectors: Sequence[Sequence[float]],
        top_k: int = 5,
        min_score: float = 0.2,
        source_ids: Sequence[int] | None = None,
        exclude_source_ids: Sequence[int] | None = None,
    ) -> list[list[VectorSearchResult]]:
        if not query_vectors:
            return []

        dimension = self._load_dimension()
        if dimension is None:
            return [[] for _ in query_vectors]

        valid_positions: list[int] = []
        valid_queries: list[list[float]] = []
        for index, query_vector in enumerate(query_vectors):
            query = list(query_vector)
            if not query:
                continue
            if len(query) != dimension:
                continue
            valid_positions.append(index)
            valid_queries.append(query)

        if not valid_queries:
            return [[] for _ in query_vectors]

        clauses: list[dict[str, object]] = [{"notebook_id": notebook_id}]
        if source_ids:
            clauses.append({"source_id": {"$in": list(source_ids)}})
        if exclude_source_ids:
            clauses.append({"source_id": {"$nin": list(exclude_source_ids)}})

        where_obj: dict[str, object]
        if len(clauses) == 1:
            where_obj = clauses[0]
        else:
            where_obj = {"$and": clauses}

        results = self._collection.query(
            query_embeddings=cast(PyEmbeddings, valid_queries),
            n_results=top_k,
            where=cast(Where, where_obj),
            include=["metadatas", "distances"],
        )

        metadatas = results.get("metadatas") or []
        distances = results.get("distances") or []

        output_groups: list[list[VectorSearchResult]] = [[] for _ in query_vectors]
        for group_idx, position in enumerate(valid_positions):
            query_metadatas = metadatas[group_idx] if group_idx < len(metadatas) else []
            query_distances = distances[group_idx] if group_idx < len(distances) else []

            group: list[VectorSearchResult] = []
            for idx, metadata in enumerate(query_metadatas):
                if not isinstance(metadata, dict):
                    continue
                distance = query_distances[idx] if idx < len(query_distances) else None
                score = 0.0 if distance is None else 1.0 - float(distance)
                if score < min_score:
                    continue
                metadata_obj = cast(dict[str, object], metadata)
                entry = VectorEntry(
                    notebook_id=int(cast(int, metadata_obj.get("notebook_id"))),
                    source_id=int(cast(int, metadata_obj.get("source_id"))),
                    chunk_id=int(cast(int, metadata_obj.get("chunk_id"))),
                    vector=[],
                )
                group.append(VectorSearchResult(entry=entry, score=score))

            group.sort(key=lambda item: item.score, reverse=True)
            output_groups[position] = group

        return output_groups

    async def remove_source(self, source_id: int) -> None:
        self._collection.delete(where={"source_id": source_id})

    async def remove_notebook(self, notebook_id: int) -> None:
        self._collection.delete(where={"notebook_id": notebook_id})

    async def entries(
        self,
        *,
        notebook_id: int | None = None,
        source_ids: Sequence[int] | None = None,
    ) -> Iterable[VectorEntry]:
        clauses: list[dict[str, object]] = []
        if notebook_id is not None:
            clauses.append({"notebook_id": int(notebook_id)})
        if source_ids:
            clauses.append({"source_id": {"$in": list(sorted(set(int(value) for value in source_ids)))}})

        where_obj: dict[str, object] | None
        if not clauses:
            where_obj = None
        elif len(clauses) == 1:
            where_obj = clauses[0]
        else:
            where_obj = {"$and": clauses}

        if where_obj is None:
            items = self._collection.get(include=["embeddings", "metadatas"])
        else:
            items = self._collection.get(where=cast(Where, where_obj), include=["embeddings", "metadatas"])
        embeddings = items.get("embeddings")
        metadatas = items.get("metadatas")
        if embeddings is None:
            embeddings = []
        if metadatas is None:
            metadatas = []

        entries: list[VectorEntry] = []
        for metadata, vector in zip(metadatas, embeddings):
            if not isinstance(metadata, dict):
                continue
            entries.append(
                VectorEntry(
                    notebook_id=int(cast(int, metadata.get("notebook_id"))),
                    source_id=int(cast(int, metadata.get("source_id"))),
                    chunk_id=int(cast(int, metadata.get("chunk_id"))),
                    vector=list(vector),
                )
            )
        return entries

    async def close(self) -> None:
        return None

    def _build_id(self, notebook_id: int, source_id: int, chunk_id: int) -> str:
        return f"{notebook_id}:{source_id}:{chunk_id}"

    def _ensure_dimension(self, dimension: int) -> None:
        if self._dimension is None:
            self._dimension = dimension
            try:
                self._collection.modify(metadata={"hnsw:space": "cosine", "dimension": dimension})
            except Exception:
                pass
            return
        if self._dimension != dimension:
            raise ValueError("vectors must have consistent dimensions")

    def _load_dimension(self) -> int | None:
        if self._dimension is not None:
            return self._dimension
        metadata_obj: object | None
        try:
            metadata_obj = self._collection.metadata
        except Exception:
            metadata_obj = None
        metadata: dict[str, object] = metadata_obj if isinstance(metadata_obj, dict) else {}
        stored = metadata.get("dimension")
        if isinstance(stored, int):
            self._dimension = stored
            return stored
        if self._collection.count() == 0:
            return None
        peek = self._collection.get(limit=1, include=["embeddings"])
        embeddings = peek.get("embeddings")
        if embeddings is None:
            embeddings = []
        if len(embeddings) > 0 and len(embeddings[0]) > 0:
            self._dimension = len(embeddings[0])
        return self._dimension
