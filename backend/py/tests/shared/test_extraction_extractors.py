from __future__ import annotations

import contextlib
import threading
from collections.abc import Callable, Iterator
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import cast

import pytest

from crystalith.shared.extraction.browserless_extractor import BrowserlessExtractor
from crystalith.shared.extraction.firecrawl_extractor import FirecrawlExtractor
from crystalith.shared.extraction.interfaces import (
    ConfigurationError,
    ExtractionError,
    NetworkError,
    ParseError,
    ServiceUnavailableError,
)
from crystalith.shared.extraction.jina_extractor import JinaReaderExtractor


@dataclass(slots=True)
class _RequestCapture:
    headers: dict[str, str] = field(default_factory=dict)
    method: str | None = None
    path: str | None = None


@contextlib.contextmanager
def _serve_http(
    handler: Callable[[BaseHTTPRequestHandler, _RequestCapture], tuple[int, str]],
) -> Iterator[tuple[str, _RequestCapture]]:
    capture = _RequestCapture()

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format: str, *args) -> None:
            return

        def do_HEAD(self) -> None:
            capture.method = "HEAD"
            capture.path = self.path
            capture.headers = dict(self.headers)
            status, _ = handler(self, capture)
            self.send_response(status)
            self.end_headers()

        def do_GET(self) -> None:
            capture.method = "GET"
            capture.path = self.path
            capture.headers = dict(self.headers)
            status, payload = handler(self, capture)
            body = payload.encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        host, port = cast(tuple[str, int], server.server_address)
        base_url = f"http://{host}:{port}/"
        yield base_url, capture
    finally:
        server.shutdown()
        thread.join(timeout=5)
        server.server_close()


@pytest.mark.asyncio
async def test_browserless_extractor_builds_connection_url_and_requires_playwright() -> None:
    extractor = BrowserlessExtractor(endpoint="ws://localhost:3000", token="abc")
    assert extractor._get_connection_url() == "ws://localhost:3000?token=abc"

    # Optional dependency: if playwright isn't installed, ensure we surface a
    # configuration error rather than crashing.
    with pytest.raises(ConfigurationError):
        await extractor._ensure_browser()

    assert await extractor.is_available() is False


@pytest.mark.asyncio
async def test_browserless_extractor_extract_success(monkeypatch: pytest.MonkeyPatch) -> None:
    import crystalith.shared.extraction.browserless_extractor as browserless_module

    class _FakePage:
        async def goto(self, url: str, *, wait_until: str, timeout: int) -> object:
            assert url == "https://example.com"
            assert wait_until == "networkidle"
            assert timeout == 60_000
            return object()

        async def content(self) -> str:
            return "<html><body><main>Hello</main></body></html>"

        async def title(self) -> str:
            return "Rendered Title"

        async def close(self) -> None:
            return None

    class _FakeContext:
        async def new_page(self) -> _FakePage:
            return _FakePage()

        async def close(self) -> None:
            return None

    class _FakeBrowser:
        def is_connected(self) -> bool:
            return True

        async def new_context(self, *, user_agent: str) -> _FakeContext:
            assert "Mozilla" in user_agent
            return _FakeContext()

        async def close(self) -> None:
            return None

    class _FakeChromium:
        async def connect_over_cdp(self, connection_url: str, *, timeout: int) -> _FakeBrowser:
            assert connection_url == "ws://browserless.test?launch=1&token=abc"
            assert timeout == 60_000
            return _FakeBrowser()

    class _FakePlaywright:
        chromium = _FakeChromium()

        async def stop(self) -> None:
            return None

    class _FakePlaywrightManager:
        async def start(self) -> _FakePlaywright:
            return _FakePlaywright()

    def _fake_async_playwright() -> _FakePlaywrightManager:
        return _FakePlaywrightManager()

    class _FakeTrafilaturaMetadata:
        title = "Meta Title"
        author = "Author"
        date = "2020-01-01"
        description = "Desc"
        language = "en"
        sitename = "Site"

    class _FakeTrafilatura:
        def extract(
            self,
            html: str,
            *,
            url: str,
            include_tables: bool,
            include_links: bool,
            include_images: bool,
            include_comments: bool,
            output_format: str,
            with_metadata: bool,
        ) -> str | None:
            assert "Hello" in html
            assert url == "https://example.com"
            assert include_tables is True
            assert include_links is True
            assert include_images is False
            assert include_comments is False
            assert output_format == "markdown"
            assert with_metadata is True
            return "# Hello"

        def extract_metadata(self, html: str, *, default_url: str) -> _FakeTrafilaturaMetadata | None:
            assert "Hello" in html
            assert default_url == "https://example.com"
            return _FakeTrafilaturaMetadata()

    monkeypatch.setattr(browserless_module, "_load_async_playwright", lambda: _fake_async_playwright)
    monkeypatch.setattr(browserless_module, "_load_trafilatura", lambda: _FakeTrafilatura())

    extractor = BrowserlessExtractor(endpoint="ws://browserless.test?launch=1", token="abc")
    result = await extractor.extract("https://example.com")

    assert result.extractor == "browserless"
    assert result.url == "https://example.com"
    assert result.text.startswith("# Hello")
    assert result.title == "Rendered Title"
    assert result.author == "Author"
    assert result.description == "Desc"
    assert result.extra.get("rendered") is True
    assert result.extra.get("title") == "Meta Title"


def test_firecrawl_extractor_requires_api_key() -> None:
    extractor = FirecrawlExtractor()
    with pytest.raises(ConfigurationError, match="API key"):
        extractor._get_client()

    extractor2 = FirecrawlExtractor(api_key="sk-test")
    try:
        import firecrawl  # noqa: F401
    except ImportError:
        with pytest.raises(ConfigurationError, match="firecrawl-py"):
            extractor2._get_client()
    else:
        client = extractor2._get_client()
        assert client is extractor2._client


def test_firecrawl_extractor_parse_result_handles_dict_and_errors() -> None:
    extractor = FirecrawlExtractor(api_key="test")
    content = extractor._parse_result(
        {
            "markdown": "# Hello",
            "metadata": {"title": "T", "description": "D", "language": "en"},
            "html": "<h1>Hello</h1>",
        },
        url="https://example.com",
    )
    assert content.text == "# Hello"
    assert content.title == "T"
    assert content.description == "D"
    assert content.language == "en"
    assert content.raw_html == "<h1>Hello</h1>"

    with pytest.raises(ParseError):
        extractor._parse_result(None, url="https://example.com")

    with pytest.raises(ParseError):
        extractor._parse_result({"markdown": "   "}, url="https://example.com")


def test_jina_reader_extracts_title_and_description_from_markdown() -> None:
    extractor = JinaReaderExtractor()
    title, description = extractor._extract_metadata_from_markdown(
        "# Title\n\nThis is the first paragraph.\n\nMore."
    )
    assert title == "Title"
    assert description == "This is the first paragraph."

    _, description2 = extractor._extract_metadata_from_markdown(
        "# Title\n\n* bullet\n\n[link]\n\nParagraph."
    )
    assert description2 == "Paragraph."


@pytest.mark.asyncio
async def test_jina_reader_extract_success_and_headers(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(_request: BaseHTTPRequestHandler, capture: _RequestCapture) -> tuple[int, str]:
        assert capture.method == "GET"
        # Ensure extractor sets appropriate request headers.
        assert capture.headers.get("Accept") == "text/plain"
        assert capture.headers.get("User-Agent") == "Crystalith/1.0"
        assert capture.headers.get("Authorization") == "Bearer sk-test"
        assert capture.headers.get("X-Return-Format") == "text"
        return 200, "# Title\n\nFirst paragraph.\n\nMore."

    with _serve_http(handler) as (base_url, _):
        # Mock reason: redirect extractor network target to local stub server for deterministic behavior.
        monkeypatch.setattr(JinaReaderExtractor, "BASE_URL", base_url)
        extractor = JinaReaderExtractor(api_key="sk-test", return_format="text")
        result = await extractor.extract("https://example.com")

    assert result.extractor == "jina"
    assert result.title == "Title"
    assert result.description == "First paragraph."
    jina_url = result.extra.get("jina_url")
    assert isinstance(jina_url, str)
    assert "https://example.com" in jina_url


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("status", "error_type"),
    [
        (429, ServiceUnavailableError),
        (402, ServiceUnavailableError),
        (500, ServiceUnavailableError),
        (404, NetworkError),
    ],
)
async def test_jina_reader_extract_maps_http_statuses(
    status: int,
    error_type: type[Exception],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(_request: BaseHTTPRequestHandler, capture: _RequestCapture) -> tuple[int, str]:
        assert capture.method == "GET"
        return status, "error"

    with _serve_http(handler) as (base_url, _):
        # Mock reason: redirect extractor network target to local stub server for deterministic behavior.
        monkeypatch.setattr(JinaReaderExtractor, "BASE_URL", base_url)
        extractor = JinaReaderExtractor()
        with pytest.raises(error_type):
            await extractor.extract("status/test")


@pytest.mark.asyncio
async def test_jina_reader_is_available_true_when_reachable(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(_request: BaseHTTPRequestHandler, capture: _RequestCapture) -> tuple[int, str]:
        assert capture.method == "HEAD"
        return 200, ""

    with _serve_http(handler) as (base_url, _):
        # Mock reason: redirect extractor network target to local stub server for deterministic behavior.
        monkeypatch.setattr(JinaReaderExtractor, "BASE_URL", base_url)
        extractor = JinaReaderExtractor()
        assert await extractor.is_available() is True


@pytest.mark.asyncio
async def test_jina_reader_is_available_false_when_unreachable(monkeypatch: pytest.MonkeyPatch) -> None:
    # Mock reason: force unreachable endpoint to assert fallback behavior without real network dependency.
    monkeypatch.setattr(JinaReaderExtractor, "BASE_URL", "http://127.0.0.1:1/")
    extractor = JinaReaderExtractor()
    assert await extractor.is_available() is False


@pytest.mark.asyncio
async def test_firecrawl_extractor_extract_success_and_error_mapping() -> None:
    class _Client:
        def __init__(self, mode: str) -> None:
            self.mode = mode

        def scrape(self, *_args, **_kwargs):
            if self.mode == "ok":
                return {
                    "markdown": "# Hello",
                    "html": "<h1>Hello</h1>",
                    "metadata": {"title": "T"},
                }
            if self.mode == "unauth":
                raise RuntimeError("401 unauthorized")
            if self.mode == "rate":
                raise RuntimeError("429 rate limit")
            if self.mode == "timeout":
                raise RuntimeError("timeout")
            raise RuntimeError("boom")

    extractor = FirecrawlExtractor(api_key="sk-test")
    extractor._client = _Client("ok")
    ok = await extractor.extract("https://example.com")
    assert ok.text.startswith("# Hello")
    assert ok.title == "T"

    extractor._client = _Client("unauth")
    with pytest.raises(ConfigurationError, match="API key"):
        await extractor.extract("https://example.com")

    extractor._client = _Client("rate")
    with pytest.raises(ServiceUnavailableError, match="rate limit"):
        await extractor.extract("https://example.com")

    extractor._client = _Client("timeout")
    with pytest.raises(NetworkError, match="timed out"):
        await extractor.extract("https://example.com")

    extractor._client = _Client("boom")
    with pytest.raises(ExtractionError, match="Firecrawl extraction failed"):
        await extractor.extract("https://example.com")
