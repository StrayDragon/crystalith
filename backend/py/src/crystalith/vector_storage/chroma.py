from __future__ import annotations

from collections.abc import Iterable, Sequence
from pathlib import Path
from typing import Any

import chromadb
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
        metadatas = [
            {
                "notebook_id": notebook_id,
                "source_id": source_id,
                "chunk_id": chunk_id,
            }
            for chunk_id in chunk_ids
        ]
        self._collection.upsert(
            ids=ids,
            embeddings=vectors_list,
            metadatas=metadatas,
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

        dimension = self._load_dimension()
        if dimension is None or len(query) != dimension:
            return []

        where: dict[str, Any] = {"notebook_id": notebook_id}
        if source_ids:
            where["source_id"] = {"$in": list(source_ids)}

        results = self._collection.query(
            query_embeddings=[query],
            n_results=top_k,
            where=where,
            include=["embeddings", "metadatas", "distances"],
        )

        embeddings = results.get("embeddings")
        metadatas = results.get("metadatas")
        distances = results.get("distances")
        if embeddings is None:
            embeddings = []
        if metadatas is None:
            metadatas = []
        if distances is None:
            distances = []

        if len(embeddings) == 0 or len(metadatas) == 0:
            return []

        query_embeddings = embeddings[0] if len(embeddings) > 0 else []
        query_metadatas = metadatas[0] if len(metadatas) > 0 else []
        query_distances = distances[0] if len(distances) > 0 else []

        output: list[VectorSearchResult] = []
        for idx, metadata in enumerate(query_metadatas):
            vector = list(query_embeddings[idx]) if idx < len(query_embeddings) else []
            distance = query_distances[idx] if idx < len(query_distances) else None
            score = 0.0 if distance is None else 1.0 - float(distance)
            if score < min_score:
                continue
            entry = VectorEntry(
                notebook_id=int(metadata["notebook_id"]),
                source_id=int(metadata["source_id"]),
                chunk_id=int(metadata["chunk_id"]),
                vector=vector,
            )
            output.append(VectorSearchResult(entry=entry, score=score))

        output.sort(key=lambda item: item.score, reverse=True)
        return output

    async def remove_source(self, source_id: int) -> None:
        self._collection.delete(where={"source_id": source_id})

    async def remove_notebook(self, notebook_id: int) -> None:
        self._collection.delete(where={"notebook_id": notebook_id})

    async def entries(self) -> Iterable[VectorEntry]:
        items = self._collection.get(include=["embeddings", "metadatas"])
        embeddings = items.get("embeddings")
        metadatas = items.get("metadatas")
        if embeddings is None:
            embeddings = []
        if metadatas is None:
            metadatas = []

        entries: list[VectorEntry] = []
        for metadata, vector in zip(metadatas, embeddings):
            entries.append(
                VectorEntry(
                    notebook_id=int(metadata["notebook_id"]),
                    source_id=int(metadata["source_id"]),
                    chunk_id=int(metadata["chunk_id"]),
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
        metadata = getattr(self._collection, "metadata", None) or {}
        stored = metadata.get("dimension") if isinstance(metadata, dict) else None
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
