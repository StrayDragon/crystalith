from __future__ import annotations

import asyncio
from collections.abc import Iterable, Sequence

import httpx

from .types import VectorEntry, VectorSearchResult


class ChromaHttpVectorStore:
    def __init__(
        self,
        *,
        host: str,
        port: int = 8000,
        collection_name: str = "vector_entries",
        tenant: str = "default_tenant",
        database: str = "default_database",
        timeout: float = 30.0,
    ) -> None:
        if host.startswith("http://") or host.startswith("https://"):
            base_url = host.rstrip("/")
        else:
            base_url = f"http://{host}:{port}"

        self._client = httpx.AsyncClient(
            base_url=base_url,
            timeout=timeout,
        )
        self._tenant = tenant
        self._database = database
        self._collection_name = collection_name
        self._collection_id: str | None = None
        self._init_lock = asyncio.Lock()
        self._dimension: int | None = None

    async def _ensure_collection(self) -> str:
        if self._collection_id is not None:
            return self._collection_id

        async with self._init_lock:
            if self._collection_id is not None:
                return self._collection_id

            response = await self._client.post(
                "/api/v1/collections",
                params={"tenant": self._tenant, "database": self._database},
                json={
                    "name": self._collection_name,
                    "get_or_create": True,
                    "metadata": {"hnsw:space": "cosine"},
                },
            )
            response.raise_for_status()
            payload = response.json() if response.content else {}
            collection_id = payload.get("id") or payload.get("collection_id")
            if not collection_id:
                raise RuntimeError("Chroma create_collection response missing id")
            self._collection_id = str(collection_id)
            return self._collection_id

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

        if self._dimension is None:
            self._dimension = expected_dim
        elif self._dimension != expected_dim:
            raise ValueError("vectors must have consistent dimensions")

        collection_id = await self._ensure_collection()
        ids = [f"{notebook_id}:{source_id}:{chunk_id}" for chunk_id in chunk_ids]
        metadatas = [
            {
                "notebook_id": notebook_id,
                "source_id": source_id,
                "chunk_id": chunk_id,
            }
            for chunk_id in chunk_ids
        ]

        response = await self._client.post(
            f"/api/v1/collections/{collection_id}/add",
            json={
                "ids": ids,
                "embeddings": vectors_list,
                "metadatas": metadatas,
            },
        )
        response.raise_for_status()

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

        if self._dimension is not None and len(query) != self._dimension:
            return []

        clauses: list[dict[str, object]] = [{"notebook_id": notebook_id}]
        if source_ids:
            clauses.append({"source_id": {"$in": list(source_ids)}})
        if exclude_source_ids:
            clauses.append({"source_id": {"$nin": list(exclude_source_ids)}})

        where: dict[str, object]
        if len(clauses) == 1:
            where = clauses[0]
        else:
            where = {"$and": clauses}

        collection_id = await self._ensure_collection()
        response = await self._client.post(
            f"/api/v1/collections/{collection_id}/query",
            json={
                "query_embeddings": [query],
                "n_results": int(top_k),
                "where": where,
                "include": ["metadatas", "distances"],
            },
        )
        response.raise_for_status()
        payload = response.json() if response.content else {}

        metadatas = payload.get("metadatas") or []
        distances = payload.get("distances") or []

        query_metadatas = metadatas[0] if metadatas else []
        query_distances = distances[0] if distances else []

        output: list[VectorSearchResult] = []
        for idx, metadata in enumerate(query_metadatas):
            if not isinstance(metadata, dict):
                continue
            distance = query_distances[idx] if idx < len(query_distances) else None
            score = 0.0 if distance is None else 1.0 - float(distance)
            if score < min_score:
                continue
            entry = VectorEntry(
                notebook_id=int(metadata.get("notebook_id", notebook_id)),
                source_id=int(metadata["source_id"]),
                chunk_id=int(metadata["chunk_id"]),
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

        expected_dim: int | None = self._dimension
        if expected_dim is None:
            for query_vector in query_vectors:
                if query_vector:
                    expected_dim = len(query_vector)
                    break

        output_groups: list[list[VectorSearchResult]] = [[] for _ in query_vectors]
        if not expected_dim:
            return output_groups

        positions: list[int] = []
        queries: list[list[float]] = []
        for index, query_vector in enumerate(query_vectors):
            query = list(query_vector)
            if not query:
                continue
            if len(query) != expected_dim:
                continue
            positions.append(index)
            queries.append(query)

        if not queries:
            return output_groups

        clauses: list[dict[str, object]] = [{"notebook_id": notebook_id}]
        if source_ids:
            clauses.append({"source_id": {"$in": list(source_ids)}})
        if exclude_source_ids:
            clauses.append({"source_id": {"$nin": list(exclude_source_ids)}})

        where: dict[str, object]
        if len(clauses) == 1:
            where = clauses[0]
        else:
            where = {"$and": clauses}

        collection_id = await self._ensure_collection()
        response = await self._client.post(
            f"/api/v1/collections/{collection_id}/query",
            json={
                "query_embeddings": queries,
                "n_results": int(top_k),
                "where": where,
                "include": ["metadatas", "distances"],
            },
        )
        response.raise_for_status()
        payload = response.json() if response.content else {}

        metadatas = payload.get("metadatas") or []
        distances = payload.get("distances") or []

        for group_idx, position in enumerate(positions):
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
                entry = VectorEntry(
                    notebook_id=int(metadata.get("notebook_id", notebook_id)),
                    source_id=int(metadata["source_id"]),
                    chunk_id=int(metadata["chunk_id"]),
                    vector=[],
                )
                group.append(VectorSearchResult(entry=entry, score=score))

            group.sort(key=lambda item: item.score, reverse=True)
            output_groups[position] = group

        return output_groups

    async def remove_source(self, source_id: int) -> None:
        collection_id = await self._ensure_collection()
        response = await self._client.post(
            f"/api/v1/collections/{collection_id}/delete",
            json={"where": {"source_id": int(source_id)}},
        )
        response.raise_for_status()

    async def remove_notebook(self, notebook_id: int) -> None:
        collection_id = await self._ensure_collection()
        response = await self._client.post(
            f"/api/v1/collections/{collection_id}/delete",
            json={"where": {"notebook_id": int(notebook_id)}},
        )
        response.raise_for_status()

    async def entries(
        self,
        *,
        notebook_id: int | None = None,
        source_ids: Sequence[int] | None = None,
    ) -> Iterable[VectorEntry]:
        collection_id = await self._ensure_collection()
        limit = 1000
        offset = 0

        clauses: list[dict[str, object]] = []
        if notebook_id is not None:
            clauses.append({"notebook_id": int(notebook_id)})
        if source_ids:
            clauses.append({"source_id": {"$in": list(sorted(set(int(value) for value in source_ids)))}})

        where: dict[str, object]
        if not clauses:
            where = {}
        elif len(clauses) == 1:
            where = clauses[0]
        else:
            where = {"$and": clauses}

        entries: list[VectorEntry] = []
        while True:
            response = await self._client.post(
                f"/api/v1/collections/{collection_id}/get",
                json={
                    "where": where,
                    "limit": limit,
                    "offset": offset,
                    "include": ["embeddings", "metadatas"],
                },
            )
            response.raise_for_status()
            payload = response.json() if response.content else {}

            ids = payload.get("ids") or []
            embeddings = payload.get("embeddings") or []
            metadatas = payload.get("metadatas") or []

            if not ids:
                break

            for idx, metadata in enumerate(metadatas):
                if not isinstance(metadata, dict):
                    continue
                vector = list(embeddings[idx]) if idx < len(embeddings) else []
                entries.append(
                    VectorEntry(
                        notebook_id=int(metadata.get("notebook_id", 0)),
                        source_id=int(metadata.get("source_id", 0)),
                        chunk_id=int(metadata.get("chunk_id", 0)),
                        vector=vector,
                    )
                )

            if len(ids) < limit:
                break
            offset += limit

        return entries

    async def close(self) -> None:
        await self._client.aclose()
