from __future__ import annotations

import contextlib
import threading
from collections.abc import Iterator
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest
from sqlalchemy import select

from crystalith.shared.db import Source
from crystalith.shared.plugins import PluginRegistry


@contextlib.contextmanager
def _serve_html(html: str) -> Iterator[str]:
    body = html.encode("utf-8")

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format: str, *args) -> None:
            return

        def do_GET(self) -> None:
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


@pytest.mark.asyncio
async def test_sources_ingest_errors_and_validation(client, db_session, app) -> None:
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Ingest Errors"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    not_found = await client.get("/v1/notebooks/999999/sources/extractors")
    assert not_found.status_code == 404

    not_found_search = await client.post(
        "/v1/notebooks/999999/sources/search",
        json={"query": "x", "engine": "Web", "mode": "Web"},
    )
    assert not_found_search.status_code == 404

    unsupported = await client.post(
        f"/v1/notebooks/{notebook_id}/sources",
        files={"file": ("file.bin", b"abc", "application/octet-stream")},
    )
    assert unsupported.status_code == 415

    # Core-only: HTML requires the official parser plugin.
    original_plugins = app.state.plugins
    app.state.plugins = PluginRegistry()
    try:
        html_upload = await client.post(
            f"/v1/notebooks/{notebook_id}/sources",
            files={"file": ("page.html", b"<html><body><main>Hello</main></body></html>", "text/html")},
        )
    finally:
        app.state.plugins = original_plugins

    assert html_upload.status_code == 415
    detail = html_upload.json()
    assert detail["error_code"] == "PARSER_PLUGIN_REQUIRED"
    assert detail["details"]["required_plugin_id"] == "parser-html"

    empty = await client.post(
        f"/v1/notebooks/{notebook_id}/sources",
        files={"file": ("empty.txt", b"", "text/plain")},
    )
    assert empty.status_code == 400

    rows = await db_session.execute(
        select(Source).where(Source.notebook_id == notebook_id, Source.filename == "empty.txt")
    )
    created = rows.scalar_one_or_none()
    assert created is None

    html = "<html><head><title>Empty</title></head><body></body></html>"
    app.state.settings.source_ingestion.url_fetch.security.allowlist_hosts = ["127.0.0.1"]
    with _serve_html(html) as base_url:
        original_plugins = app.state.plugins
        app.state.plugins = PluginRegistry()
        try:
            fetch = await client.post(
                f"/v1/notebooks/{notebook_id}/sources/from-url",
                json={
                    "url": base_url,
                    "mode": "fetch",
                    "extractor": "trafilatura",
                },
            )
        finally:
            app.state.plugins = original_plugins
    assert fetch.status_code == 503
    detail = fetch.json()
    assert detail["error_code"] == "OPTIONAL_SERVICE_UNAVAILABLE"
