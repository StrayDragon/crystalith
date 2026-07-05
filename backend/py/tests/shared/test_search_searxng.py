from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock

import pytest

from crystalith.shared.config import Settings
from crystalith.shared.search import SearXNGSearcher
from tests._support.httpx_stubs import AsyncStreamResponseStub, install_httpx_asyncclient_stub


@pytest.mark.asyncio
async def test_searxng_searcher_validates_query() -> None:
    searcher = SearXNGSearcher(host="http://localhost:8888")
    with pytest.raises(ValueError, match="cannot be empty"):
        await searcher.search("   ")


def test_searxng_searcher_from_settings_uses_defaults() -> None:
    searcher = SearXNGSearcher.from_settings(Settings())
    assert searcher.host == ""


@pytest.mark.asyncio
async def test_searxng_searcher_performs_search_via_http(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify that search() calls _search_raw() and maps results correctly."""
    mock_response = AsyncMock()
    mock_response.status_code = 200
    mock_response.json = AsyncMock(
        return_value={
            "results": [
                {
                    "title": "A",
                    "link": "https://example.com/a",
                    "snippet": "Snippet A",
                    "engines": ["google"],
                },
                {
                    "title": "B",
                    "url": "https://example.com/b",
                    "content": "Snippet B",
                    "engine": "bing",
                    "engines": [],
                },
            ]
        }
    )

    mock_client = AsyncMock()
    mock_client.__aenter__.return_value.get = AsyncMock(return_value=mock_response)

    async def _search_raw_stub(query: str, engines: list[str]) -> list[dict[str, object]]:
        async with mock_client as client:
            resp = await client.get("http://localhost:8888/search")
            data = await resp.json()
            return data["results"]

    searcher = SearXNGSearcher(host="http://localhost:8888")
    monkeypatch.setattr(searcher, "_search_raw", _search_raw_stub)

    results = await searcher.search("query")
    assert len(results) == 2
    assert results[0].engine == "google"
    assert results[0].url == "https://example.com/a"
    assert results[0].snippet == "Snippet A"
    assert results[1].engine == "bing"
    assert results[1].url == "https://example.com/b"


@pytest.mark.asyncio
async def test_searxng_searcher_rejects_unconfigured_host() -> None:
    searcher = SearXNGSearcher.from_settings(Settings())
    with pytest.raises(RuntimeError, match="not configured"):
        await searcher.search("query")


@pytest.mark.asyncio
async def test_searxng_searcher_accepts_empty_query_healthcheck_response(monkeypatch: pytest.MonkeyPatch) -> None:
    def _stream(_method: str, _url: str):
        return AsyncStreamResponseStub(400)

    install_httpx_asyncclient_stub(monkeypatch, stream=_stream)

    searcher = SearXNGSearcher(host="", endpoint_candidates=["http://a/"], timeout=1)
    resolved = await searcher._resolve_host()
    assert resolved == "http://a"


@pytest.mark.asyncio
async def test_searxng_searcher_resolves_host_from_endpoint_candidates(monkeypatch: pytest.MonkeyPatch) -> None:
    def _stream(_method: str, _url: str):
        return AsyncStreamResponseStub(200)

    install_httpx_asyncclient_stub(monkeypatch, stream=_stream)

    searcher = SearXNGSearcher(host="", endpoint_candidates=["http://a/", "http://b/"], timeout=1)

    resolved = await searcher._resolve_host()
    assert resolved == "http://a"
    assert searcher.host == "http://a"


def test_searxng_searcher_from_settings_includes_optional_service_candidates_when_enabled() -> None:
    settings = Settings()
    settings.search.searxng.endpoint_candidates = ["http://search-a"]
    settings.optional_services.searxng.enabled = True
    settings.optional_services.searxng.endpoint_candidates = ["http://optional-a"]
    settings.optional_services.searxng.endpoint = "http://optional-b"

    searcher = SearXNGSearcher.from_settings(settings)
    assert searcher.host == ""
    assert searcher.endpoint_candidates == [
        "http://search-a",
        "http://optional-a",
        "http://optional-b",
    ]


@pytest.mark.asyncio
async def test_searxng_searcher_resolve_host_returns_existing_host_inside_lock() -> None:
    searcher = SearXNGSearcher(host="", endpoint_candidates=["http://a"], timeout=1)

    async with searcher._resolve_lock:
        task = asyncio.create_task(searcher._resolve_host())
        await asyncio.sleep(0)
        searcher.host = "http://already"

    resolved = await task
    assert resolved == "http://already"


@pytest.mark.asyncio
async def test_searxng_searcher_resolves_host_skipping_failures(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = {"stream": 0}

    def _stream(_method: str, _url: str):
        calls["stream"] += 1
        if calls["stream"] == 1:
            raise RuntimeError("boom")
        return AsyncStreamResponseStub(204)

    install_httpx_asyncclient_stub(monkeypatch, stream=_stream)

    searcher = SearXNGSearcher(host="", endpoint_candidates=["http://bad", "http://good"], timeout=1)
    resolved = await searcher._resolve_host()
    assert resolved == "http://good"
    assert calls["stream"] == 2


@pytest.mark.asyncio
async def test_searxng_searcher_reports_unreachable_endpoint_candidates(monkeypatch: pytest.MonkeyPatch) -> None:
    def _stream(_method: str, _url: str):
        return AsyncStreamResponseStub(503)

    install_httpx_asyncclient_stub(monkeypatch, stream=_stream)

    searcher = SearXNGSearcher(host="", endpoint_candidates=["http://a", "http://b"], timeout=1)
    with pytest.raises(RuntimeError, match="unreachable"):
        await searcher._resolve_host()


@pytest.mark.asyncio
async def test_searxng_searcher_wraps_errors_as_runtime_error() -> None:
    async def _broken_raw(query: str, engines: list[str]) -> list[dict[str, object]]:
        raise RuntimeError("boom")

    searcher = SearXNGSearcher(host="http://localhost:8888")
    # Ensure resolve_host doesn't fail
    monkeypatch_attr = pytest.MonkeyPatch()
    monkeypatch_attr.setattr(searcher, "_search_raw", _broken_raw)

    with pytest.raises(RuntimeError, match="Search failed: boom"):
        await searcher.search("query")
    monkeypatch_attr.undo()
