from __future__ import annotations

import pytest

from crystalith.shared.config import Settings
from crystalith.shared.search import SearXNGSearcher


@pytest.mark.asyncio
async def test_searxng_searcher_validates_query() -> None:
    searcher = SearXNGSearcher(host="http://localhost:8888")
    with pytest.raises(ValueError, match="cannot be empty"):
        await searcher.search("   ")


def test_searxng_searcher_from_settings_uses_defaults() -> None:
    searcher = SearXNGSearcher.from_settings(Settings())
    assert searcher.host == ""


@pytest.mark.asyncio
async def test_searxng_searcher_rejects_unconfigured_host() -> None:
    searcher = SearXNGSearcher.from_settings(Settings())
    with pytest.raises(RuntimeError, match="not configured"):
        await searcher.search("query")


@pytest.mark.asyncio
async def test_searxng_searcher_maps_wrapper_results_without_network() -> None:
    class StubWrapper:
        def results(self, _query, *, num_results, engines):  # noqa: ANN001
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
        def results(self, *_args, **_kwargs):  # noqa: ANN002, ANN003
            raise RuntimeError("boom")

    searcher = SearXNGSearcher(host="http://localhost:8888")
    searcher._wrapper = BadWrapper()  # type: ignore[attr-defined]

    with pytest.raises(RuntimeError, match="Search failed: boom"):
        await searcher.search("query")
