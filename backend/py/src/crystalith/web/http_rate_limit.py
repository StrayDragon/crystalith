from __future__ import annotations

import asyncio
import math
import time
from dataclasses import dataclass
from typing import Final

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from crystalith.shared.schemas.errors import build_error_response


@dataclass(frozen=True, slots=True)
class RateLimitDecision:
    allowed: bool
    retry_after_s: int | None = None


class FixedWindowRateLimiter:
    def __init__(self, *, window_s: int, max_requests: int) -> None:
        self._window_s: float = float(max(1, int(window_s)))
        self._max_requests: int = max(0, int(max_requests))
        self._lock = asyncio.Lock()
        self._buckets: dict[str, tuple[float, int]] = {}

    async def allow(self, key: str) -> RateLimitDecision:
        if self._max_requests <= 0:
            return RateLimitDecision(allowed=True)

        now = time.monotonic()
        async with self._lock:
            window_start, count = self._buckets.get(key, (now, 0))
            if now - window_start >= self._window_s:
                window_start = now
                count = 0

            count += 1
            self._buckets[key] = (window_start, count)

            if count <= self._max_requests:
                return RateLimitDecision(allowed=True)

            remaining = self._window_s - (now - window_start)
            retry_after_s = max(0, math.ceil(remaining))
            return RateLimitDecision(allowed=False, retry_after_s=retry_after_s)


class HttpRateLimitMiddleware:
    _EXEMPT_PATHS: Final[set[str]] = {"/health", "/health/dependencies"}

    def __init__(
        self,
        app: ASGIApp,
        *,
        window_s: int,
        max_requests: int,
        enabled: bool = True,
        path_prefix: str = "/v1",
    ) -> None:
        self.app = app
        self._enabled = bool(enabled)
        self._path_prefix = path_prefix.rstrip("/") or "/v1"
        self._limiter = FixedWindowRateLimiter(window_s=window_s, max_requests=max_requests)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if not self._enabled or scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = (scope.get("path") or "").rstrip("/") or "/"
        if path in self._EXEMPT_PATHS:
            await self.app(scope, receive, send)
            return

        if not (path == self._path_prefix or path.startswith(f"{self._path_prefix}/")):
            await self.app(scope, receive, send)
            return

        method = (scope.get("method") or "").upper()
        if method == "OPTIONS":
            await self.app(scope, receive, send)
            return

        client = scope.get("client")
        host = str(client[0]) if isinstance(client, (list, tuple)) and client else "unknown"

        decision = await self._limiter.allow(host)
        if decision.allowed:
            await self.app(scope, receive, send)
            return

        retry_after_s = int(decision.retry_after_s or 0)
        headers = {"Retry-After": str(retry_after_s)}
        payload = build_error_response(
            status_code=429,
            detail={
                "error_code": "RATE_LIMITED",
                "message": "请求过于频繁，请稍后重试",
                "retry_after": retry_after_s,
            },
            headers=headers,
        )
        response = JSONResponse(
            status_code=429,
            content=payload.model_dump(exclude_none=True),
            headers=headers,
        )
        await response(scope, receive, send)
