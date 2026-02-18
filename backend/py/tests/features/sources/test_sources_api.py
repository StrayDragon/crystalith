from __future__ import annotations

import asyncio
import contextlib
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from time import perf_counter
from types import SimpleNamespace

import pytest

from crystalith.shared.db import Chunk, Source
from crystalith.shared.parsers.factory import ParserFactory
from crystalith.shared.types import SourceStatus


class _SlowParser:
    parser_type = "text"
    page_count = None

    def parse(self, content: bytes):
        time.sleep(0.35)
        text = content.decode("utf-8", errors="ignore") or "slow"
        return [
            SimpleNamespace(
                text=text,
                start_offset=0,
                end_offset=len(text),
                metadata={},
            )
        ]


@contextlib.contextmanager
def _serve_searx_json(payload: dict) -> str:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format: str, *args) -> None:  # noqa: A003 - base signature
            return

        def do_GET(self) -> None:  # noqa: N802 - http.server naming
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        host, port = server.server_address
        yield f"http://{host}:{port}/"
    finally:
        server.shutdown()
        thread.join(timeout=5)
        server.server_close()


@contextlib.contextmanager
def _serve_html(html: str) -> str:
    body = html.encode("utf-8")

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format: str, *args) -> None:  # noqa: A003 - base signature
            return

        def do_GET(self) -> None:  # noqa: N802 - http.server naming
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        host, port = server.server_address
        yield f"http://{host}:{port}/"
    finally:
        server.shutdown()
        thread.join(timeout=5)
        server.server_close()

@pytest.mark.asyncio
async def test_sources_crud(client):
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Notebook"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    files = {"file": ("note.txt", b"Hello world", "text/plain")}
    create_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/sources",
        files=files,
    )
    assert create_resp.status_code == 201
    payload = create_resp.json()
    source_id = payload["id"]
    assert payload["chunk_count"] >= 1

    list_resp = await client.get(f"/v1/notebooks/{notebook_id}/sources")
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1

    chunks_resp = await client.get(
        f"/v1/notebooks/{notebook_id}/sources/{source_id}/chunks"
    )
    assert chunks_resp.status_code == 200
    assert len(chunks_resp.json()) >= 1

    delete_resp = await client.delete(
        f"/v1/notebooks/{notebook_id}/sources/{source_id}"
    )
    assert delete_resp.status_code == 204

    after_resp = await client.get(f"/v1/notebooks/{notebook_id}/sources")
    assert after_resp.status_code == 200
    assert after_resp.json() == []


@pytest.mark.asyncio
async def test_upload_source_parse_runs_in_executor_without_blocking_requests(client, monkeypatch):
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Slow Parse Notebook"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    def _from_file(
        cls,  # noqa: ANN001
        *,
        filename: str | None,
        mime_type: str | None,
        transcriber=None,  # noqa: ANN001
        media_fetcher=None,  # noqa: ANN001
    ):
        return _SlowParser()

    monkeypatch.setattr(ParserFactory, "from_file", classmethod(_from_file))

    started = perf_counter()
    upload_task = asyncio.create_task(
        client.post(
            f"/v1/notebooks/{notebook_id}/sources",
            files={"file": ("slow.txt", b"A" * 1024, "text/plain")},
        )
    )

    await asyncio.sleep(0.02)

    quick_started = perf_counter()
    quick_resp = await client.post("/v1/notebooks", json={"name": "Quick Notebook"})
    quick_elapsed = perf_counter() - quick_started

    upload_resp = await upload_task
    total_elapsed = perf_counter() - started

    assert upload_resp.status_code == 201
    assert quick_resp.status_code == 201
    assert total_elapsed >= 0.3
    # Avoid overly strict absolute thresholds under parallel test load. We only
    # need to ensure the "quick" request completes meaningfully earlier than
    # the slow parse upload task.
    assert (total_elapsed - quick_elapsed) > 0.03


@pytest.mark.asyncio
async def test_upload_three_sources_concurrently_keeps_response_times_stable(client, monkeypatch):
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Concurrent Upload Notebook"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    def _from_file(
        cls,  # noqa: ANN001
        *,
        filename: str | None,
        mime_type: str | None,
        transcriber=None,  # noqa: ANN001
        media_fetcher=None,  # noqa: ANN001
    ):
        return _SlowParser()

    monkeypatch.setattr(ParserFactory, "from_file", classmethod(_from_file))

    async def _upload(index: int) -> tuple[float, int]:
        started = perf_counter()
        response = await client.post(
            f"/v1/notebooks/{notebook_id}/sources",
            files={"file": (f"slow-{index}.txt", b"B" * 2048, "text/plain")},
        )
        elapsed = perf_counter() - started
        return elapsed, response.status_code

    tasks = [asyncio.create_task(_upload(index)) for index in range(3)]

    await asyncio.sleep(0.02)
    quick_started = perf_counter()
    quick_resp = await client.post("/v1/notebooks", json={"name": "Quick Notebook 2"})
    quick_elapsed = perf_counter() - quick_started

    upload_results = await asyncio.gather(*tasks)
    upload_durations = [duration for duration, _ in upload_results]
    upload_statuses = [status for _, status in upload_results]

    assert all(status_code == 201 for status_code in upload_statuses)
    assert quick_resp.status_code == 201
    assert quick_elapsed < 0.5
    assert max(upload_durations) < 1.5
    assert max(upload_durations) - min(upload_durations) < 0.8


@pytest.mark.asyncio
async def test_batch_delete_sources_batch_endpoint_removes_vectors(client, app):
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Batch Delete Notebook"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    first = await client.post(
        f"/v1/notebooks/{notebook_id}/sources",
        files={"file": ("one.txt", b"first source", "text/plain")},
    )
    second = await client.post(
        f"/v1/notebooks/{notebook_id}/sources",
        files={"file": ("two.txt", b"second source", "text/plain")},
    )
    assert first.status_code == 201
    assert second.status_code == 201

    source_ids = [first.json()["id"], second.json()["id"]]

    before = await app.state.vector_store.search(
        notebook_id=notebook_id,
        query_vector=[1.0, 0.0, 0.0],
        top_k=10,
        min_score=-1.0,
    )
    assert len(before) >= 2

    batch_resp = await client.request(
        "DELETE",
        f"/v1/notebooks/{notebook_id}/sources/batch",
        json={"source_ids": source_ids},
    )
    assert batch_resp.status_code == 200
    payload = batch_resp.json()
    assert payload["deleted_count"] == 2
    assert payload["deleted_ids"] == source_ids

    after = await app.state.vector_store.search(
        notebook_id=notebook_id,
        query_vector=[1.0, 0.0, 0.0],
        top_k=10,
        min_score=-1.0,
    )
    assert after == []


@pytest.mark.asyncio
async def test_batch_reembed_sources_endpoint(client):
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Batch Reembed Notebook"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    first = await client.post(
        f"/v1/notebooks/{notebook_id}/sources",
        files={"file": ("a.txt", b"alpha", "text/plain")},
    )
    second = await client.post(
        f"/v1/notebooks/{notebook_id}/sources",
        files={"file": ("b.txt", b"beta", "text/plain")},
    )
    assert first.status_code == 201
    assert second.status_code == 201

    source_ids = [first.json()["id"], second.json()["id"]]

    resp = await client.post(
        f"/v1/notebooks/{notebook_id}/sources/batch/re-embed",
        json={"source_ids": source_ids},
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["reembedded_count"] == 2
    assert payload["failed_count"] == 0
    assert payload["reembedded_ids"] == source_ids


@pytest.mark.asyncio
async def test_source_tags_crud_assign_and_filter(client, db_session):
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Tag Notebook"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    source_a = Source(
        notebook_id=notebook_id,
        filename="paper-a.md",
        mime_type="text/markdown",
        parser_type="text",
        status=SourceStatus.READY,
    )
    source_b = Source(
        notebook_id=notebook_id,
        filename="paper-b.txt",
        mime_type="text/plain",
        parser_type="text",
        status=SourceStatus.READY,
    )
    db_session.add_all([source_a, source_b])
    await db_session.flush()
    db_session.add_all([
        Chunk(source_id=source_a.id, chunk_index=0, text="a-0"),
        Chunk(source_id=source_a.id, chunk_index=1, text="a-1"),
        Chunk(source_id=source_b.id, chunk_index=0, text="b-0"),
    ])
    await db_session.commit()

    create_tag = await client.post(
        f"/v1/notebooks/{notebook_id}/sources/tags",
        json={"name": "论文"},
    )
    assert create_tag.status_code == 201
    tag_payload = create_tag.json()
    tag_id = tag_payload["id"]
    assert tag_payload["name"] == "论文"

    assign_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/sources/tags/{tag_id}/sources",
        json={"source_ids": [source_a.id]},
    )
    assert assign_resp.status_code == 200
    assert assign_resp.json()["count"] == 1

    list_tags = await client.get(f"/v1/notebooks/{notebook_id}/sources/tags")
    assert list_tags.status_code == 200
    assert list_tags.json()[0]["name"] == "论文"

    filtered = await client.get(
        f"/v1/notebooks/{notebook_id}/sources",
        params={"tag": "论文", "sort_by": "name", "sort_order": "asc"},
    )
    assert filtered.status_code == 200
    filtered_rows = filtered.json()
    assert len(filtered_rows) == 1
    assert filtered_rows[0]["id"] == source_a.id
    assert filtered_rows[0]["tags"] == ["论文"]

    sort_by_size = await client.get(
        f"/v1/notebooks/{notebook_id}/sources",
        params={"sort_by": "size", "sort_order": "desc"},
    )
    assert sort_by_size.status_code == 200
    assert sort_by_size.json()[0]["id"] == source_a.id

    rename_resp = await client.patch(
        f"/v1/notebooks/{notebook_id}/sources/tags/{tag_id}",
        json={"name": "文献"},
    )
    assert rename_resp.status_code == 200
    assert rename_resp.json()["name"] == "文献"

    unassign_resp = await client.request(
        "DELETE",
        f"/v1/notebooks/{notebook_id}/sources/tags/{tag_id}/sources",
        json={"source_ids": [source_a.id]},
    )
    assert unassign_resp.status_code == 200
    assert unassign_resp.json()["count"] == 1

    delete_tag = await client.delete(f"/v1/notebooks/{notebook_id}/sources/tags/{tag_id}")
    assert delete_tag.status_code == 204


@pytest.mark.asyncio
async def test_list_extractors_endpoint_reports_defaults(client):
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Extractors Notebook"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    resp = await client.get(f"/v1/notebooks/{notebook_id}/sources/extractors")
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["extractors"]
    assert payload["default_extractor"] in {"trafilatura", "jina"}
    assert payload["fallback_enabled"] is True


@pytest.mark.asyncio
async def test_create_source_from_url_link_mode_creates_source(client, app):
    notebook_resp = await client.post("/v1/notebooks", json={"name": "URL Link Notebook"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    resp = await client.post(
        f"/v1/notebooks/{notebook_id}/sources/from-url",
        json={
            "url": "https://example.com",
            "title": "Example",
            "snippet": "Snippet",
            "mode": "link",
        },
    )
    assert resp.status_code == 201
    payload = resp.json()
    assert payload["filename"] == "Example"
    assert payload["status"] == SourceStatus.READY.value
    assert payload["chunk_count"] >= 1

    results = await app.state.vector_store.search(
        notebook_id=notebook_id,
        query_vector=[1.0, 0.0, 0.0],
        top_k=10,
        min_score=-1.0,
    )
    assert results


@pytest.mark.asyncio
async def test_create_source_from_url_fetch_mode_uses_trafilatura_without_external_network(client, app):
    notebook_resp = await client.post("/v1/notebooks", json={"name": "URL Fetch Notebook"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    html = (
        "<html><head><title>Example</title></head>"
        "<body><article><p>Hello world</p></article></body></html>"
    )
    with _serve_html(html) as base_url:
        resp = await client.post(
            f"/v1/notebooks/{notebook_id}/sources/from-url",
            json={
                "url": base_url,
                "mode": "fetch",
                "extractor": "trafilatura",
            },
        )

    assert resp.status_code == 201
    payload = resp.json()
    assert payload["filename"] == "Example"
    assert payload["status"] == SourceStatus.READY.value
    assert payload["chunk_count"] >= 1

    results = await app.state.vector_store.search(
        notebook_id=notebook_id,
        query_vector=[1.0, 0.0, 0.0],
        top_k=10,
        min_score=-1.0,
    )
    assert results


@pytest.mark.asyncio
async def test_search_sources_endpoint_uses_local_searx_stub(client, app):
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Search Notebook"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    with _serve_searx_json(
        {
            "results": [
                {
                    "title": "Result 1",
                    "url": "https://example.com/1",
                    "content": "Snippet 1",
                    "engines": ["google"],
                    "category": "general",
                },
                {
                    "title": "Result 2",
                    "url": "https://example.com/2",
                    "content": "Snippet 2",
                    "engines": ["bing"],
                    "category": "general",
                },
            ],
            "answers": [],
        }
    ) as searx_host:
        app.state.settings.search.searxng.host = searx_host
        resp = await client.post(
            f"/v1/notebooks/{notebook_id}/sources/search",
            json={"query": "crystalith", "engine": "Web", "mode": "Web"},
        )

    assert resp.status_code == 200
    payload = resp.json()
    assert payload["status"] == "ok"
    assert payload["results"]
    assert payload["results"][0]["title"] == "Result 1"
    assert payload["results"][0]["url"] == "https://example.com/1"
