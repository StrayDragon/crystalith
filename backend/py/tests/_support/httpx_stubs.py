from __future__ import annotations

from collections.abc import Callable
from typing import Any, Protocol

import pytest


class AsyncStreamResponse(Protocol):
    status_code: int

    async def __aenter__(self) -> Any: ...

    async def __aexit__(self, exc_type, exc, tb) -> bool: ...


class AsyncStreamResponseStub:
    def __init__(self, status_code: int) -> None:
        self.status_code = status_code

    async def __aenter__(self) -> AsyncStreamResponseStub:
        return self

    async def __aexit__(self, exc_type, exc, tb) -> bool:
        return False


def install_httpx_asyncclient_stub(
    monkeypatch: pytest.MonkeyPatch,
    *,
    stream: Callable[[str, str], AsyncStreamResponse],
) -> None:
    class _Client:
        def __init__(self, *_args: object, **_kwargs: object) -> None:
            pass

        async def __aenter__(self) -> _Client:
            return self

        async def __aexit__(self, exc_type, exc, tb) -> bool:
            return False

        def stream(self, method: str, url: str):
            return stream(method, url)

    import httpx

    # Mock reason: deterministic reachability probe without external service dependency.
    monkeypatch.setattr(httpx, "AsyncClient", _Client)


class StreamResponse(Protocol):
    status_code: int

    def __enter__(self) -> Any: ...

    def __exit__(self, exc_type, exc, tb) -> bool: ...


class StreamResponseStub:
    def __init__(self, status_code: int) -> None:
        self.status_code = status_code

    def __enter__(self) -> StreamResponseStub:
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False


def make_httpx_client_stub(*, stream: Callable[[str, str], StreamResponse]) -> type:
    class _Client:
        def __init__(self, *_args: object, **_kwargs: object) -> None:
            pass

        def __enter__(self) -> _Client:
            return self

        def __exit__(self, exc_type, exc, tb) -> bool:
            return False

        def stream(self, method: str, url: str):
            return stream(method, url)

    return _Client
