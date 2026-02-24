from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any, Protocol


class CacheProvider(Protocol):
    async def get(self, key: str) -> Any | None:
        ...

    async def get_many(self, keys: Sequence[str]) -> list[Any | None]:
        ...

    async def set(self, key: str, value: Any, *, ttl: float | None = None) -> None:
        ...

    async def incr(self, key: str, amount: int = 1, *, ttl: float | None = None) -> int:
        ...

    async def set_many(self, items: Mapping[str, Any], *, ttl: float | None = None) -> None:
        ...

    async def delete(self, key: str) -> None:
        ...

    async def invalidate_pattern(self, pattern: str) -> int:
        ...
