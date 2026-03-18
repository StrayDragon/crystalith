from __future__ import annotations

import asyncio

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


def test_searxng_searcher_builds_wrapper_with_auth_header(monkeypatch: pytest.MonkeyPatch) -> None:
    created: dict[str, object] = {}

    class StubWrapper:
        def __init__(self, *, searx_host: str, k: int, headers=None):
            created["searx_host"] = searx_host
            created["k"] = k
            created["headers"] = headers

        def results(self, *_args, **_kwargs):
            return []

    # Mock reason: avoid importing/instantiating the real LangChain wrapper while validating config wiring.
    import langchain_community.utilities as util

    monkeypatch.setattr(util, "SearxSearchWrapper", StubWrapper)

    searcher = SearXNGSearcher(host="http://searx.example", api_key="k", max_results=7)
    wrapper = searcher._get_wrapper()
    assert wrapper is not None
    assert created["searx_host"] == "http://searx.example"
    assert created["k"] == 7
    assert created["headers"] == {"Authorization": "Bearer k"}


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
    searcher._wrapper = object()  # type: ignore[assignment]

    resolved = await searcher._resolve_host()
    assert resolved == "http://a"
    assert searcher.host == "http://a"
    assert searcher._wrapper is None


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
async def test_searxng_searcher_maps_wrapper_results_without_network() -> None:
    class StubWrapper:
        def results(self, _query, *, num_results, engines):
            assert num_results == 10
            assert engines
            return [
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

    searcher = SearXNGSearcher(host="http://localhost:8888")
    searcher._wrapper = StubWrapper()  # type: ignore[attr-defined]

    results = await searcher.search("query")
    assert len(results) == 2
    assert results[0].engine == "google"
    assert results[0].url == "https://example.com/a"
    assert results[0].snippet == "Snippet A"
    assert results[1].engine == "bing"


@pytest.mark.asyncio
async def test_searxng_searcher_wraps_errors_as_runtime_error() -> None:
    class BadWrapper:
        def results(self, *_args, **_kwargs):
            raise RuntimeError("boom")

    searcher = SearXNGSearcher(host="http://localhost:8888")
    searcher._wrapper = BadWrapper()  # type: ignore[attr-defined]

    with pytest.raises(RuntimeError, match="Search failed: boom"):
        await searcher.search("query")
