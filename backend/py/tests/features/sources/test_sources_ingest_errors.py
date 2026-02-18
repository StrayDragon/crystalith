from __future__ import annotations

import contextlib
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest
from sqlalchemy import select

from crystalith.shared.db import Source
from crystalith.shared.types import SourceStatus


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
async def test_sources_ingest_errors_and_validation(client, db_session) -> None:
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

    empty = await client.post(
        f"/v1/notebooks/{notebook_id}/sources",
        files={"file": ("empty.txt", b"", "text/plain")},
    )
    assert empty.status_code == 500

    rows = await db_session.execute(
        select(Source).where(Source.notebook_id == notebook_id, Source.filename == "empty.txt")
    )
    created = rows.scalar_one_or_none()
    assert created is not None
    assert created.status == SourceStatus.FAILED
    assert created.error_message

    html = "<html><head><title>Empty</title></head><body></body></html>"
    with _serve_html(html) as base_url:
        fetch = await client.post(
            f"/v1/notebooks/{notebook_id}/sources/from-url",
            json={
                "url": base_url,
                "mode": "fetch",
                "extractor": "trafilatura",
            },
        )
    assert fetch.status_code == 400
