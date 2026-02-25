from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx
import pytest
from fastapi import FastAPI, Request
from httpx import ASGITransport

from crystalith.shared.vector_storage.chroma_http import ChromaHttpVectorStore


@dataclass
class _Stored:
    embedding: list[float]
    metadata: dict[str, Any]


def _make_stub_chroma_app(*, include_collection_id: bool = True) -> FastAPI:
    app = FastAPI()

    app.state.collection_id = "col1"
    app.state.entries: dict[str, _Stored] = {}

    @app.post("/api/v1/collections")
    async def create_collection(_request: Request):  # noqa: ANN001
        payload: dict[str, Any] = {}
        if include_collection_id:
            payload["id"] = app.state.collection_id
        return payload

    @app.post("/api/v1/collections/{collection_id}/add")
    async def add(collection_id: str, request: Request):  # noqa: ANN001
        assert collection_id == app.state.collection_id
        body = await request.json()
        ids = body.get("ids") or []
        embeddings = body.get("embeddings") or []
        metadatas = body.get("metadatas") or []
        for entry_id, embedding, metadata in zip(ids, embeddings, metadatas):
            app.state.entries[str(entry_id)] = _Stored(
                embedding=list(embedding),
                metadata=dict(metadata),
            )
        return {"ok": True}

    @app.post("/api/v1/collections/{collection_id}/query")
    async def query(collection_id: str, request: Request):  # noqa: ANN001
        assert collection_id == app.state.collection_id
        body = await request.json()
        where = body.get("where") or {}

        def matches(entry: _Stored) -> bool:
            if "$and" in where:
                clauses = where["$and"]
            else:
                clauses = [where]
            for clause in clauses:
                if "notebook_id" in clause and entry.metadata.get("notebook_id") != clause["notebook_id"]:
                    return False
                source_filter = clause.get("source_id")
                if isinstance(source_filter, dict):
                    if "$in" in source_filter and entry.metadata.get("source_id") not in set(source_filter["$in"]):
                        return False
                    if "$nin" in source_filter and entry.metadata.get("source_id") in set(source_filter["$nin"]):
                        return False
            return True

        matched = [(entry_id, stored) for entry_id, stored in app.state.entries.items() if matches(stored)]
        matched.sort(key=lambda item: item[0])

        embeddings = [stored.embedding for _, stored in matched]
        metadatas = [stored.metadata for _, stored in matched]
        distances = [0.0 for _ in matched]

        return {
            "embeddings": [embeddings],
            "metadatas": [metadatas],
            "distances": [distances],
        }

    @app.post("/api/v1/collections/{collection_id}/delete")
    async def delete(collection_id: str, request: Request):  # noqa: ANN001
        assert collection_id == app.state.collection_id
        body = await request.json()
        where = body.get("where") or {}
        to_delete: list[str] = []
        for entry_id, stored in app.state.entries.items():
            if "source_id" in where and stored.metadata.get("source_id") != where["source_id"]:
                continue
            if "notebook_id" in where and stored.metadata.get("notebook_id") != where["notebook_id"]:
                continue
            to_delete.append(entry_id)
        for entry_id in to_delete:
            app.state.entries.pop(entry_id, None)
        return {"ok": True}

    @app.post("/api/v1/collections/{collection_id}/get")
    async def get(collection_id: str, request: Request):  # noqa: ANN001
        assert collection_id == app.state.collection_id
        body = await request.json()
        where = body.get("where") or {}
        limit = int(body.get("limit") or 1000)
        offset = int(body.get("offset") or 0)

        def matches(entry: _Stored) -> bool:
            if not where:
                return True
            if "$and" in where:
                clauses = where["$and"]
            else:
                clauses = [where]
            for clause in clauses:
                if "notebook_id" in clause and entry.metadata.get("notebook_id") != clause["notebook_id"]:
                    return False
                source_filter = clause.get("source_id")
                if isinstance(source_filter, dict):
                    if "$in" in source_filter and entry.metadata.get("source_id") not in set(source_filter["$in"]):
                        return False
                    if "$nin" in source_filter and entry.metadata.get("source_id") in set(source_filter["$nin"]):
                        return False
                elif source_filter is not None and entry.metadata.get("source_id") != source_filter:
                    return False
            return True

        items = sorted(
            [(entry_id, stored) for entry_id, stored in app.state.entries.items() if matches(stored)],
            key=lambda item: item[0],
        )
        page = items[offset : offset + limit]

        ids = [entry_id for entry_id, _ in page]
        embeddings = [stored.embedding for _, stored in page]
        metadatas = [stored.metadata for _, stored in page]
        return {
            "ids": ids,
            "embeddings": embeddings,
            "metadatas": metadatas,
        }

    return app


@pytest.mark.asyncio
async def test_chroma_http_vector_store_happy_path_without_network() -> None:
    app = _make_stub_chroma_app()
    store = ChromaHttpVectorStore(host="http://testserver")
    store._client = httpx.AsyncClient(  # type: ignore[assignment]
        transport=ASGITransport(app=app),
        base_url="http://testserver",
        timeout=5.0,
    )

    await store.add(
        notebook_id=1,
        source_id=10,
        chunk_ids=[100, 101],
        vectors=[[1.0, 0.0], [0.0, 1.0]],
    )

    entries = list(await store.entries(notebook_id=1))
    assert {entry.chunk_id for entry in entries} == {100, 101}
    assert list(await store.entries(notebook_id=2)) == []
    assert list(await store.entries(source_ids=[10])) == entries
    assert list(await store.entries(notebook_id=1, source_ids=[10])) == entries

    results = await store.search(
        notebook_id=1,
        query_vector=[1.0, 0.0],
        top_k=5,
        min_score=0.0,
        source_ids=[10],
    )
    assert results
    assert results[0].entry.source_id == 10

    await store.remove_notebook(1)
    assert list(await store.entries()) == []

    await store.close()


@pytest.mark.asyncio
async def test_chroma_http_vector_store_validates_collection_response() -> None:
    app = _make_stub_chroma_app(include_collection_id=False)
    store = ChromaHttpVectorStore(host="http://testserver")
    store._client = httpx.AsyncClient(  # type: ignore[assignment]
        transport=ASGITransport(app=app),
        base_url="http://testserver",
        timeout=5.0,
    )

    with pytest.raises(RuntimeError, match="missing id"):
        await store.search(
            notebook_id=1,
            query_vector=[1.0, 0.0],
            top_k=5,
            min_score=0.0,
        )

    await store.close()
