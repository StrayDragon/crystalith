from __future__ import annotations

from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.pool import StaticPool

from crystalith.api.deps import get_embedding_provider
from crystalith.app import create_app
from crystalith.config import DatabaseSettings, Settings
from crystalith.db import Chunk, create_all, create_db_manager
from crystalith.vector_storage import InMemoryVectorStore

from crystalith.tests_support import create_test_models


class FakeEmbeddingProvider:
    provider = "fake"
    model = "fake"

    async def embed(self, texts: list[str]) -> list[list[float]]:
        return [[float(len(text)), 0.0, 1.0] for text in texts]


class FailingEmbeddingProvider:
    provider = "fake"
    model = "fake"

    async def embed(self, texts: list[str]) -> list[list[float]]:
        raise RuntimeError("boom")


def _escape_pdf_text(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _build_pdf(text: str) -> bytes:
    escaped = _escape_pdf_text(text)
    stream = f"BT\n/F1 24 Tf\n72 72 Td\n({escaped}) Tj\nET\n"
    objects = [
        "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
        "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
        (
            "3 0 obj\n"
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] "
            "/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\n"
            "endobj\n"
        ),
        f"4 0 obj\n<< /Length {len(stream)} >>\nstream\n{stream}endstream\nendobj\n",
        "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    ]

    content = "%PDF-1.4\n"
    offsets = [0]
    for obj in objects:
        offsets.append(len(content))
        content += obj

    xref_offset = len(content)
    xref_lines = ["xref", "0 6", "0000000000 65535 f "]
    xref_lines.extend(f"{offset:010d} 00000 n " for offset in offsets[1:])
    xref = "\n".join(xref_lines) + "\n"
    trailer = f"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n"

    return (content + xref + trailer).encode("ascii")


@pytest_asyncio.fixture
async def test_client() -> AsyncGenerator[tuple[AsyncClient, InMemoryVectorStore, object], None]:
    settings = Settings(database=DatabaseSettings(url="sqlite+aiosqlite:///:memory:"))
    manager = create_db_manager(
        settings.database.url,
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    await create_all(manager.async_engine)

    vector_store = InMemoryVectorStore()
    app = create_app(settings, db_manager=manager, vector_store=vector_store)
    app.dependency_overrides[get_embedding_provider] = lambda: FakeEmbeddingProvider()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client, vector_store, manager
    await manager.close()


@pytest_asyncio.fixture
async def failing_client() -> AsyncGenerator[tuple[AsyncClient, InMemoryVectorStore], None]:
    settings = Settings(database=DatabaseSettings(url="sqlite+aiosqlite:///:memory:"))
    manager = create_db_manager(
        settings.database.url,
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    await create_all(manager.async_engine)

    vector_store = InMemoryVectorStore()
    app = create_app(settings, db_manager=manager, vector_store=vector_store)
    app.dependency_overrides[get_embedding_provider] = lambda: FailingEmbeddingProvider()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client, vector_store
    await manager.close()


@pytest.mark.asyncio
async def test_upload_and_delete_source(
    test_client: tuple[AsyncClient, InMemoryVectorStore, object],
) -> None:
    client, vector_store, _manager = test_client

    created = await client.post("/v1/notebooks", json={"name": "Notes"})
    notebook_id = created.json()["id"]

    upload = await client.post(
        f"/v1/notebooks/{notebook_id}/sources",
        files={"file": ("note.md", b"hello world", "text/markdown")},
    )
    assert upload.status_code == 201
    payload = upload.json()
    assert payload["status"] == "ready"
    assert payload["chunk_count"] >= 1
    assert len(vector_store) == payload["chunk_count"]
    assert payload["parser_type"] == "text"
    assert payload["metadata"]["parser_type"] == "text"
    assert payload["metadata"]["word_count"] == 2

    listing = await client.get(f"/v1/notebooks/{notebook_id}/sources")
    assert listing.status_code == 200
    assert len(listing.json()) == 1

    source_id = payload["id"]
    deleted = await client.delete(f"/v1/notebooks/{notebook_id}/sources/{source_id}")
    assert deleted.status_code == 204
    assert len(vector_store) == 0


@pytest.mark.asyncio
async def test_batch_delete_sources(
    test_client: tuple[AsyncClient, InMemoryVectorStore, object],
) -> None:
    client, vector_store, _manager = test_client

    created = await client.post("/v1/notebooks", json={"name": "Notes"})
    notebook_id = created.json()["id"]

    for name in ("note-a.md", "note-b.md"):
        upload = await client.post(
            f"/v1/notebooks/{notebook_id}/sources",
            files={"file": (name, b"hello world", "text/markdown")},
        )
        assert upload.status_code == 201

    listing = await client.get(f"/v1/notebooks/{notebook_id}/sources")
    assert listing.status_code == 200
    sources = listing.json()
    assert len(sources) == 2
    assert len(vector_store) > 0

    source_ids = [item["id"] for item in sources]
    deleted = await client.request(
        "DELETE",
        f"/v1/notebooks/{notebook_id}/sources",
        json={"source_ids": source_ids},
    )
    assert deleted.status_code == 200
    payload = deleted.json()
    assert set(payload["deleted_ids"]) == set(source_ids)
    assert payload["deleted_count"] == len(source_ids)

    listing = await client.get(f"/v1/notebooks/{notebook_id}/sources")
    assert listing.status_code == 200
    assert listing.json() == []
    assert len(vector_store) == 0


@pytest.mark.asyncio
async def test_upload_failure_marks_source_failed(
    failing_client: tuple[AsyncClient, InMemoryVectorStore],
) -> None:
    client, vector_store = failing_client

    created = await client.post("/v1/notebooks", json={"name": "Notes"})
    notebook_id = created.json()["id"]

    upload = await client.post(
        f"/v1/notebooks/{notebook_id}/sources",
        files={"file": ("note.md", b"hello world", "text/markdown")},
    )
    assert upload.status_code == 500

    listing = await client.get(f"/v1/notebooks/{notebook_id}/sources")
    assert listing.status_code == 200
    payload = listing.json()
    assert len(payload) == 1
    assert payload[0]["status"] == "failed"
    assert payload[0]["chunk_count"] == 0
    assert len(vector_store) == 0
    assert payload[0]["parser_type"] == "text"


@pytest.mark.asyncio
async def test_pdf_chunk_metadata_persisted(
    test_client: tuple[AsyncClient, InMemoryVectorStore, object],
) -> None:
    client, _vector_store, manager = test_client

    created = await client.post("/v1/notebooks", json={"name": "Notes"})
    notebook_id = created.json()["id"]

    pdf_bytes = _build_pdf("Hello PDF")
    upload = await client.post(
        f"/v1/notebooks/{notebook_id}/sources",
        files={"file": ("doc.pdf", pdf_bytes, "application/pdf")},
    )
    assert upload.status_code == 201
    payload = upload.json()

    async with manager.got_manual_session() as session:
        result = await session.execute(
            select(Chunk).where(Chunk.source_id == payload["id"]).order_by(Chunk.chunk_index)
        )
        chunks = result.scalars().all()

    assert chunks
    metadata = chunks[0].metadata_ or {}
    assert metadata.get("page") == 1
    assert metadata.get("paragraph_index") == 0
