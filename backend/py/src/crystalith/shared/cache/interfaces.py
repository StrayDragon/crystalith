from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Protocol

from crystalith.shared.json_types import JsonValue


class CacheProvider(Protocol):
    async def get(self, key: str) -> JsonValue | None:
        ...

    async def get_many(self, keys: Sequence[str]) -> list[JsonValue | None]:
        ...

    async def set(self, key: str, value: JsonValue, *, ttl: float | None = None) -> None:
        ...

    async def incr(self, key: str, amount: int = 1, *, ttl: float | None = None) -> int:
        ...

    async def set_many(self, items: Mapping[str, JsonValue], *, ttl: float | None = None) -> None:
        ...

    async def delete(self, key: str) -> None:
        ...

    async def invalidate_pattern(self, pattern: str) -> int:
        ...

    async def close(self) -> None:
        ...
