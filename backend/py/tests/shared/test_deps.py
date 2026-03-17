from __future__ import annotations

import pytest
from starlette.requests import Request

from crystalith.shared.deps import get_ai_provider, get_embedding_provider, get_vector_store


def _make_request(app) -> Request:
    return Request(
        {
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": "GET",
            "scheme": "http",
            "path": "/",
            "raw_path": b"/",
            "query_string": b"",
            "headers": [],
            "client": ("testclient", 123),
            "server": ("testserver", 80),
            "root_path": "",
            "app": app,
        }
    )


@pytest.mark.asyncio
async def test_get_ai_provider_caches_instance(app, monkeypatch):
    sentinel = object()
    calls = {"count": 0}

    def _factory(settings):
        calls["count"] += 1
        return sentinel

    import crystalith.shared.deps as deps_module

    # Mock reason: assert provider memoization semantics without constructing real provider implementations.
    monkeypatch.setattr(deps_module, "create_chat_provider", _factory)

    request = _make_request(app)
    first = get_ai_provider(request)
    second = get_ai_provider(request)

    assert first is sentinel
    assert second is sentinel
    assert calls["count"] == 1
    assert app.state.ai_provider is sentinel


@pytest.mark.asyncio
async def test_get_embedding_provider_caches_instance(app, monkeypatch):
    from crystalith.shared.ai.test_provider import TestEmbeddingProvider

    sentinel = TestEmbeddingProvider("sentinel")
    calls = {"count": 0}

    def _factory(settings):
        calls["count"] += 1
        return sentinel

    import crystalith.shared.deps as deps_module

    # Mock reason: assert provider memoization semantics without constructing real provider implementations.
    monkeypatch.setattr(deps_module, "create_embedding_provider", _factory)

    request = _make_request(app)
    first = get_embedding_provider(request)
    second = get_embedding_provider(request)

    assert first is second
    assert calls["count"] == 1
    assert first.provider == sentinel.provider
    assert first.model == sentinel.model
    assert app.state.embedding_provider is first


@pytest.mark.asyncio
async def test_get_vector_store_reads_app_state(app):
    request = _make_request(app)
    assert get_vector_store(request) is app.state.vector_store


@pytest.mark.asyncio
async def test_get_embedding_provider_wraps_cached_provider_when_redis(app, monkeypatch):
    calls = {"count": 0}

    class _CountingEmbedder:
        provider = "test"

        def __init__(self) -> None:
            self.model = "counting"

        async def embed(self, texts):
            return await self.embed_batch(texts, batch_size=len(texts) or 1)

        async def embed_batch(self, texts, *, batch_size: int = 100):
            calls["count"] += 1
            return [[1.0, 0.0, 0.0] for _ in texts]

    def _factory(settings):
        return _CountingEmbedder()

    import crystalith.shared.deps as deps_module

    # Mock reason: force deterministic embedder for cache wrapper behavior checks.
    monkeypatch.setattr(deps_module, "create_embedding_provider", _factory)
    # Mock reason: cache wrapper config is driven by env overrides in runtime.
    monkeypatch.setenv("CRYSTALITH_EMBEDDING_CACHE_ENABLED", "1")
    monkeypatch.setenv("CRYSTALITH_EMBEDDING_CACHE_TTL_S", "not-a-number")
    monkeypatch.setenv("CRYSTALITH_EMBEDDING_CACHE_MAX_TEXTS", "not-an-int")
    monkeypatch.setenv("CRYSTALITH_EMBEDDING_CACHE_MAX_CHARS", "not-an-int")

    # Exercise the "redis" branch without requiring Redis in tests.
    app.state.settings.cache.provider = "redis"

    request = _make_request(app)
    provider = get_embedding_provider(request)
    first = await provider.embed_batch(["hello"])
    second = await provider.embed_batch(["hello"])

    assert first == second
    assert calls["count"] == 1
