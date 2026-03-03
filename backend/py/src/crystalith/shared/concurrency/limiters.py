from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from time import perf_counter


@dataclass(frozen=True, slots=True)
class LimiterLease:
    name: str
    limit: int | None
    wait_ms: int

    @property
    def hit(self) -> int:
        return 1 if self.wait_ms > 0 else 0


class StageLimiter:
    def __init__(self, name: str, *, limit: int) -> None:
        self.name = str(name)
        resolved = int(limit)
        self.limit = max(0, resolved)
        self._semaphore = asyncio.Semaphore(self.limit) if self.limit > 0 else None

        self._acquires = 0
        self._hits = 0
        self._wait_ms_total = 0
        self._wait_ms_max = 0

    @asynccontextmanager
    async def acquire(self) -> AsyncIterator[LimiterLease]:
        if self._semaphore is None:
            self._acquires += 1
            yield LimiterLease(name=self.name, limit=None, wait_ms=0)
            return

        started = perf_counter()
        await self._semaphore.acquire()
        wait_ms = int((perf_counter() - started) * 1000)

        self._acquires += 1
        self._wait_ms_total += wait_ms
        self._wait_ms_max = max(self._wait_ms_max, wait_ms)
        if wait_ms > 0:
            self._hits += 1

        try:
            yield LimiterLease(name=self.name, limit=self.limit, wait_ms=wait_ms)
        finally:
            self._semaphore.release()

    def snapshot(self) -> dict[str, int]:
        return {
            "limit": int(self.limit),
            "acquires": int(self._acquires),
            "hits": int(self._hits),
            "wait_ms_total": int(self._wait_ms_total),
            "wait_ms_max": int(self._wait_ms_max),
        }


@dataclass(frozen=True, slots=True)
class StageLimiters:
    embedding: StageLimiter
    vector_search: StageLimiter
    llm_generate: StageLimiter

    @classmethod
    def from_limits(
        cls,
        *,
        embedding: int,
        vector_search: int,
        llm_generate: int,
    ) -> StageLimiters:
        return cls(
            embedding=StageLimiter("embedding", limit=embedding),
            vector_search=StageLimiter("vector_search", limit=vector_search),
            llm_generate=StageLimiter("llm_generate", limit=llm_generate),
        )
