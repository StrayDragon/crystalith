from __future__ import annotations

from typing import Any, Protocol


class CacheProvider(Protocol):
    async def get(self, key: str) -> Any | None:
        ...

    async def set(self, key: str, value: Any, *, ttl: float | None = None) -> None:
        ...

    async def delete(self, key: str) -> None:
        ...

    async def invalidate_pattern(self, pattern: str) -> int:
        ...
