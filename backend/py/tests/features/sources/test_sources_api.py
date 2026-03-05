from __future__ import annotations

import asyncio
from collections.abc import Iterator
import contextlib
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from types import SimpleNamespace

import pytest

from crystalith.shared.db import Chunk, Source
from crystalith.shared.parsers.factory import ParserFactory
from crystalith.shared.parsers.factory import ParserResolution
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
def _serve_searx_json(payload: dict[str, object]) -> Iterator[str]:
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
        host = server.server_address[0]
        port = server.server_address[1]
        yield f"http://{host}:{port}/"
    finally:
        server.shutdown()
        thread.join(timeout=5)
        server.server_close()


@contextlib.contextmanager
def _serve_html(html: str) -> Iterator[str]:
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
        host = server.server_address[0]
        port = server.server_address[1]
        yield f"http://{host}:{port}/"
    finally:
        server.shutdown()
        thread.join(timeout=5)
        server.server_close()


@contextlib.contextmanager
def _serve_redirect(location: str) -> Iterator[tuple[str, dict[str, int]]]:
    hits: dict[str, int] = {"count": 0}

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format: str, *args) -> None:  # noqa: A003 - base signature
            return

        def do_GET(self) -> None:  # noqa: N802 - http.server naming
            hits["count"] += 1
            self.send_response(302)
            self.send_header("Location", location)
            self.end_headers()

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        host = server.server_address[0]
        port = server.server_address[1]
        yield f"http://{host}:{port}/", hits
    finally:
        server.shutdown()
        thread.join(timeout=5)
        server.server_close()


@contextlib.contextmanager
def _serve_html_counting(html: str) -> Iterator[tuple[str, dict[str, int]]]:
    body = html.encode("utf-8")
    hits: dict[str, int] = {"count": 0}

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format: str, *args) -> None:  # noqa: A003 - base signature
            return

        def do_GET(self) -> None:  # noqa: N802 - http.server naming
            hits["count"] += 1
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        host = server.server_address[0]
        port = server.server_address[1]
        yield f"http://{host}:{port}/", hits
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
async def test_upload_html_source_records_parser_plugin_id(client):
    notebook_resp = await client.post("/v1/notebooks", json={"name": "HTML Upload"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    html = b"<html><body><main><p>Hello world</p></main></body></html>"
    create_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/sources",
        files={"file": ("page.html", html, "text/html")},
    )
    assert create_resp.status_code == 201
    payload = create_resp.json()
    assert payload["parser_type"] == "html"
    assert payload["metadata"]["parser_plugin_id"] == "parser-html"


@pytest.mark.asyncio
async def test_source_from_url_fetch_blocks_private_url_without_network_request(client):
    notebook_resp = await client.post("/v1/notebooks", json={"name": "From URL SSRF Block"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    with _serve_html_counting("<html><body>hello</body></html>") as (url, hits):
        resp = await client.post(
            f"/v1/notebooks/{notebook_id}/sources/from-url",
            json={"url": url, "mode": "fetch"},
        )
        assert resp.status_code == 400
        assert hits["count"] == 0

    list_resp = await client.get(f"/v1/notebooks/{notebook_id}/sources")
    assert list_resp.status_code == 200
    assert list_resp.json() == []


@pytest.mark.asyncio
async def test_source_from_url_fetch_blocks_redirect_to_metadata(client, app):
    notebook_resp = await client.post("/v1/notebooks", json={"name": "From URL Redirect SSRF"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    # Allowlist initial local server so we can exercise redirect validation.
    app.state.settings.source_ingestion.url_fetch.security.allowlist_hosts = ["127.0.0.1"]

    with _serve_redirect("http://169.254.169.254/") as (url, hits):
        resp = await client.post(
            f"/v1/notebooks/{notebook_id}/sources/from-url",
            json={"url": url, "mode": "fetch"},
        )
        assert resp.status_code == 400
        assert hits["count"] == 1

    list_resp = await client.get(f"/v1/notebooks/{notebook_id}/sources")
    assert list_resp.status_code == 200
    assert list_resp.json() == []


@pytest.mark.asyncio
async def test_source_from_url_fetch_allows_allowlisted_host(client, app):
    notebook_resp = await client.post("/v1/notebooks", json={"name": "From URL Allowlist"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    app.state.settings.source_ingestion.url_fetch.security.allowlist_hosts = ["127.0.0.1"]

    with _serve_html("<html><head><title>T</title></head><body>Hello</body></html>") as url:
        resp = await client.post(
            f"/v1/notebooks/{notebook_id}/sources/from-url",
            json={"url": url, "mode": "fetch"},
        )
        assert resp.status_code == 201

    list_resp = await client.get(f"/v1/notebooks/{notebook_id}/sources")
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1


@pytest.mark.asyncio
async def test_upload_source_parse_runs_in_executor_without_blocking_requests(client, monkeypatch):
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Slow Parse Notebook"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    parse_started = threading.Event()
    allow_parse = threading.Event()

    class _GatedSlowParser:
        parser_type = "text"
        page_count = None

        def parse(self, content: bytes):
            parse_started.set()
            allow_parse.wait(timeout=5)
            text = content.decode("utf-8", errors="ignore") or "slow"
            return [
                SimpleNamespace(
                    text=text,
                    start_offset=0,
                    end_offset=len(text),
                    metadata={},
                )
            ]

    def _from_file(
        cls,  # noqa: ANN001
        *,
        filename: str | None,
        mime_type: str | None,
        transcriber=None,  # noqa: ANN001
        media_fetcher=None,  # noqa: ANN001
        plugins=None,  # noqa: ANN001
    ):
        return ParserResolution(parser=_GatedSlowParser())

    # Mock reason: inject deterministic parser latency/content to validate concurrency behavior.
    monkeypatch.setattr(ParserFactory, "resolve_from_file", classmethod(_from_file))

    upload_task = asyncio.create_task(
        client.post(
            f"/v1/notebooks/{notebook_id}/sources",
            files={"file": ("slow.txt", b"A" * 1024, "text/plain")},
        )
    )

    try:
        assert await asyncio.to_thread(parse_started.wait, 5)

        quick_resp = await client.post("/v1/notebooks", json={"name": "Quick Notebook"})
        assert quick_resp.status_code == 201
        assert not upload_task.done()

        allow_parse.set()
        upload_resp = await asyncio.wait_for(upload_task, timeout=5)
        assert upload_resp.status_code == 201
    finally:
        allow_parse.set()


@pytest.mark.asyncio
async def test_upload_empty_file_returns_400_and_does_not_create_source(client):
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Empty Upload"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    resp = await client.post(
        f"/v1/notebooks/{notebook_id}/sources",
        files={"file": ("empty.txt", b"", "text/plain")},
    )
    assert resp.status_code == 400

    list_resp = await client.get(f"/v1/notebooks/{notebook_id}/sources")
    assert list_resp.status_code == 200
    assert list_resp.json() == []


@pytest.mark.asyncio
async def test_upload_no_chunks_returns_400_and_does_not_create_source(client, monkeypatch):
    notebook_resp = await client.post("/v1/notebooks", json={"name": "No Chunks"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    class _EmptyParser:
        parser_type = "text"
        page_count = None

        def parse(self, _content: bytes):
            return []

    def _from_file(
        cls,  # noqa: ANN001
        *,
        filename: str | None,
        mime_type: str | None,
        transcriber=None,  # noqa: ANN001
        media_fetcher=None,  # noqa: ANN001
        plugins=None,  # noqa: ANN001
    ):
        return ParserResolution(parser=_EmptyParser())

    # Mock reason: inject empty parser output to verify no-chunk error handling path.
    monkeypatch.setattr(ParserFactory, "resolve_from_file", classmethod(_from_file))

    resp = await client.post(
        f"/v1/notebooks/{notebook_id}/sources",
        files={"file": ("empty-doc.txt", b"not empty", "text/plain")},
    )
    assert resp.status_code == 400

    list_resp = await client.get(f"/v1/notebooks/{notebook_id}/sources")
    assert list_resp.status_code == 200
    assert list_resp.json() == []


@pytest.mark.asyncio
async def test_upload_three_sources_concurrently_keeps_response_times_stable(client, monkeypatch):
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Concurrent Upload Notebook"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    started_events = [threading.Event() for _ in range(3)]
    release_events = [threading.Event() for _ in range(3)]
    parser_idx = 0
    parser_lock = threading.Lock()

    class _GatedSlowParser:
        parser_type = "text"
        page_count = None

        def __init__(self, idx: int) -> None:
            self._idx = idx

        def parse(self, content: bytes):
            started_events[self._idx].set()
            release_events[self._idx].wait(timeout=5)
            text = content.decode("utf-8", errors="ignore") or f"slow-{self._idx}"
            return [
                SimpleNamespace(
                    text=text,
                    start_offset=0,
                    end_offset=len(text),
                    metadata={},
                )
            ]

    def _from_file(
        cls,  # noqa: ANN001
        *,
        filename: str | None,
        mime_type: str | None,
        transcriber=None,  # noqa: ANN001
        media_fetcher=None,  # noqa: ANN001
        plugins=None,  # noqa: ANN001
    ):
        nonlocal parser_idx
        with parser_lock:
            idx = parser_idx
            parser_idx += 1
        if idx >= len(started_events):  # pragma: no cover - defensive
            return ParserResolution(parser=_SlowParser())
        return ParserResolution(parser=_GatedSlowParser(idx))

    # Mock reason: inject deterministic parser latency/content to validate concurrent upload stability.
    monkeypatch.setattr(ParserFactory, "resolve_from_file", classmethod(_from_file))

    async def _upload(index: int) -> int:
        response = await client.post(
            f"/v1/notebooks/{notebook_id}/sources",
            files={"file": (f"slow-{index}.txt", b"B" * 2048, "text/plain")},
        )
        return response.status_code

    tasks = [asyncio.create_task(_upload(index)) for index in range(3)]

    try:
        waits = [asyncio.to_thread(event.wait, 5) for event in started_events]
        assert all(await asyncio.gather(*waits))

        quick_resp = await client.post("/v1/notebooks", json={"name": "Quick Notebook 2"})
        assert quick_resp.status_code == 201
        assert all(not task.done() for task in tasks)

        for event in release_events:
            event.set()

        upload_statuses = await asyncio.gather(*tasks)
        assert all(status_code == 201 for status_code in upload_statuses)
    finally:
        for event in release_events:
            event.set()


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
    available = [item for item in payload["extractors"] if item.get("available")]
    expected_default = available[0]["type"] if available else None
    assert payload["default_extractor"] == expected_default
    assert payload["fallback_enabled"] is True
    assert payload["policy"]["mode"] == "inherit_global"


@pytest.mark.asyncio
async def test_notebook_extractor_policy_custom_mode_controls_fetch_mode(client, app):
    from crystalith.shared.extraction.types import ExtractedContent, ExtractorType
    from crystalith.shared.plugins import PluginRegistry

    class _StubExtractor:
        @property
        def extractor_type(self):  # noqa: ANN001
            return ExtractorType.TRAFILATURA

        async def extract(self, url: str, html: str | None = None) -> ExtractedContent:  # noqa: ARG002
            return ExtractedContent(text="Hello world", title="Example", url=url, extractor="trafilatura")

        async def is_available(self) -> bool:
            return True

        async def close(self) -> None:
            return None

    class _StubExtractorPlugin:
        api_version = "v1"
        extractor_type = "trafilatura"
        display_name = "Stub Trafilatura"
        description = "Stub extractor"
        requires_api_key = False
        requires_service = False

        def create_extractor(self, *_args, **_kwargs):  # noqa: ANN002, ANN003
            return _StubExtractor()

    # Inject a stub extractor plugin into the app-level plugin registry.
    registry = PluginRegistry()
    plugin_id = "extractor-trafilatura"
    plugin = _StubExtractorPlugin()
    registry.web_extractors[plugin.extractor_type] = plugin
    registry.plugins[plugin_id] = plugin
    registry._web_extractor_plugin_ids[plugin.extractor_type] = plugin_id  # noqa: SLF001
    registry._load_report.loaded.append(plugin_id)  # noqa: SLF001
    app.state.plugins = registry

    notebook_resp = await client.post("/v1/notebooks", json={"name": "Extractor Policy"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    extractors_resp = await client.get(f"/v1/notebooks/{notebook_id}/sources/extractors")
    assert extractors_resp.status_code == 200
    payload = extractors_resp.json()
    assert payload["default_extractor"] == "trafilatura"

    # Switch to custom mode but disable all extractors in the notebook.
    patch_resp = await client.patch(
        f"/v1/notebooks/{notebook_id}/sources/extractors",
        json={"mode": "custom", "enabled_extractors": []},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["policy"]["mode"] == "custom"
    assert patch_resp.json()["policy"]["enabled_extractors"] == []

    blocked = await client.post(
        f"/v1/notebooks/{notebook_id}/sources/from-url",
        json={"url": "https://example.com", "mode": "fetch"},
    )
    assert blocked.status_code == 503
    assert blocked.json()["error_code"] == "OPTIONAL_SERVICE_UNAVAILABLE"

    # Enable extractor and retry.
    patch_resp2 = await client.patch(
        f"/v1/notebooks/{notebook_id}/sources/extractors",
        json={"enabled_extractors": ["trafilatura"]},
    )
    assert patch_resp2.status_code == 200
    assert patch_resp2.json()["policy"]["enabled_extractors"] == ["trafilatura"]

    ok = await client.post(
        f"/v1/notebooks/{notebook_id}/sources/from-url",
        json={"url": "https://example.com", "mode": "fetch"},
    )
    assert ok.status_code == 201
    assert ok.json()["status"] == SourceStatus.READY.value


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

    app.state.settings.source_ingestion.url_fetch.security.allowlist_hosts = ["127.0.0.1"]

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
    assert payload["status"] == SourceStatus.READY.value
    assert payload["parser_type"].startswith("web:")
    metadata = payload.get("metadata") or {}
    assert metadata.get("url") == base_url
    assert metadata.get("extractor") == "trafilatura"


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
