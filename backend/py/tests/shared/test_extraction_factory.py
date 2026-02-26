from __future__ import annotations

import contextlib
import threading
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

from crystalith.shared.config.models import WebExtractionSettings
from crystalith.shared.extraction.factory import create_extractor
from crystalith.shared.extraction.interfaces import ExtractionError, ParseError
from crystalith.shared.extraction.jina_extractor import JinaReaderExtractor
from crystalith.shared.extraction.trafilatura_extractor import TrafilaturaExtractor
from crystalith.shared.extraction.types import ExtractorType


@dataclass(slots=True)
class _RequestCapture:
    headers: dict[str, str] = field(default_factory=dict)
    method: str | None = None
    path: str | None = None


@contextlib.contextmanager
def _serve_http(payload: str) -> tuple[str, _RequestCapture]:
    capture = _RequestCapture()

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format: str, *args) -> None:  # noqa: A003 - base signature
            return

        def do_GET(self) -> None:  # noqa: N802 - http.server naming
            capture.method = "GET"
            capture.path = self.path
            capture.headers = dict(self.headers)
            body = payload.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        host, port = server.server_address
        base_url = f"http://{host}:{port}/"
        yield base_url, capture
    finally:
        server.shutdown()
        thread.join(timeout=5)
        server.server_close()


@pytest.mark.asyncio
async def test_extractor_factory_reports_availability_and_extracts_html() -> None:
    settings = WebExtractionSettings(
        trafilatura={"enabled": True},
        jina={"enabled": False},
        firecrawl={"enabled": False},
        browserless={"enabled": False},
    )
    factory = create_extractor(settings)

    infos = factory.get_available_extractors()
    traf = next(info for info in infos if info.type == ExtractorType.TRAFILATURA)
    assert traf.enabled is True
    assert traf.available is True

    html = (
        "<html><head><title>Example</title></head>"
        "<body><article><p>Hello world</p></article></body></html>"
    )
    result = await factory.extract("http://example.test", html=html)
    assert result.extractor == "trafilatura"
    assert "Hello world" in result.text

    await factory.close()


@pytest.mark.asyncio
async def test_trafilatura_extractor_parse_error_includes_context() -> None:
    extractor = TrafilaturaExtractor()

    with pytest.raises(ParseError) as exc_info:
        await extractor.extract("http://example.test", html="<html><body></body></html>")

    err = exc_info.value
    assert err.extractor == "trafilatura"
    assert err.url == "http://example.test"
    assert "extractor=trafilatura" in str(err)
    assert "url=http://example.test" in str(err)


@pytest.mark.asyncio
async def test_extractor_factory_errors_when_no_extractors_enabled() -> None:
    settings = WebExtractionSettings(
        trafilatura={"enabled": False},
        jina={"enabled": False},
        firecrawl={"enabled": False},
        browserless={"enabled": False},
        fallback_order=["trafilatura"],
    )
    factory = create_extractor(settings)

    with pytest.raises(ExtractionError, match="No extractors available"):
        await factory.extract("http://example.test", html="<html></html>")


@pytest.mark.asyncio
async def test_extractor_factory_falls_back_to_jina_when_trafilatura_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    markdown = "# Title\n\nFallback content."

    with _serve_http(markdown) as (base_url, capture):
        # Mock reason: redirect extractor network target to local stub server for deterministic behavior.
        monkeypatch.setattr(JinaReaderExtractor, "BASE_URL", base_url)
        settings = WebExtractionSettings(
            trafilatura={"enabled": True},
            jina={"enabled": True},
            firecrawl={"enabled": False},
            browserless={"enabled": False},
        )
        factory = create_extractor(settings)

        # Trafilatura fails on empty content; Jina returns Markdown.
        result = await factory.extract("http://example.test", html="<html><body></body></html>")

    assert result.extractor == "jina"
    assert result.title == "Title"
    assert "Fallback content" in result.text
    assert capture.method == "GET"


@pytest.mark.asyncio
async def test_extractor_factory_respects_preferred_extractor(monkeypatch: pytest.MonkeyPatch) -> None:
    markdown = "# Preferred\n\nJina wins."

    with _serve_http(markdown) as (base_url, _capture):
        # Mock reason: redirect extractor network target to local stub server for deterministic behavior.
        monkeypatch.setattr(JinaReaderExtractor, "BASE_URL", base_url)
        settings = WebExtractionSettings(
            trafilatura={"enabled": True},
            jina={"enabled": True},
            firecrawl={"enabled": False},
            browserless={"enabled": False},
        )
        factory = create_extractor(settings)

        html = (
            "<html><head><title>Example</title></head>"
            "<body><article><p>Hello world</p></article></body></html>"
        )
        result = await factory.extract(
            "http://example.test",
            html=html,
            preferred_extractor=ExtractorType.JINA,
        )

    assert result.extractor == "jina"
    assert result.title == "Preferred"


@pytest.mark.asyncio
async def test_extractor_factory_stops_when_fallback_disabled() -> None:
    settings = WebExtractionSettings(
        trafilatura={"enabled": True},
        jina={"enabled": False},
        firecrawl={"enabled": False},
        browserless={"enabled": False},
    )
    factory = create_extractor(settings)

    with pytest.raises(ExtractionError, match="All extractors failed"):
        await factory.extract(
            "http://example.test",
            html="<html><body></body></html>",
            enable_fallback=False,
        )
