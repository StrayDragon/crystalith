from __future__ import annotations

import pytest
from starlette.requests import Request

from crystalith.shared.deps import get_ai_provider, get_embedding_provider, get_vector_store


def _make_request(app) -> Request:  # noqa: ANN001
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
async def test_get_ai_provider_caches_instance(app, monkeypatch):  # noqa: ANN001
    sentinel = object()
    calls = {"count": 0}

    def _factory(settings):  # noqa: ANN001
        calls["count"] += 1
        return sentinel

    import crystalith.shared.deps as deps_module

    monkeypatch.setattr(deps_module, "create_chat_provider", _factory)

    request = _make_request(app)
    first = get_ai_provider(request)
    second = get_ai_provider(request)

    assert first is sentinel
    assert second is sentinel
    assert calls["count"] == 1
    assert app.state.ai_provider is sentinel


@pytest.mark.asyncio
async def test_get_embedding_provider_caches_instance(app, monkeypatch):  # noqa: ANN001
    sentinel = object()
    calls = {"count": 0}

    def _factory(settings):  # noqa: ANN001
        calls["count"] += 1
        return sentinel

    import crystalith.shared.deps as deps_module

    monkeypatch.setattr(deps_module, "create_embedding_provider", _factory)

    request = _make_request(app)
    first = get_embedding_provider(request)
    second = get_embedding_provider(request)

    assert first is sentinel
    assert second is sentinel
    assert calls["count"] == 1
    assert app.state.embedding_provider is sentinel


@pytest.mark.asyncio
async def test_get_vector_store_reads_app_state(app):  # noqa: ANN001
    request = _make_request(app)
    assert get_vector_store(request) is app.state.vector_store
