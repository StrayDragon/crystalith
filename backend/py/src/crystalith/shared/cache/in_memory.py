from __future__ import annotations

import asyncio
import fnmatch
import time
from collections import OrderedDict
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any


@dataclass(slots=True)
class _Entry:
    value: Any
    expires_at: float | None


class InMemoryCache:
    def __init__(self, *, ttl: float = 60.0, max_size: int = 2048) -> None:
        self._default_ttl = float(ttl)
        self._max_size = int(max_size)
        self._data: OrderedDict[str, _Entry] = OrderedDict()
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Any | None:
        now = time.monotonic()
        async with self._lock:
            entry = self._data.get(key)
            if entry is None:
                return None
            if entry.expires_at is not None and entry.expires_at <= now:
                self._data.pop(key, None)
                return None
            self._data.move_to_end(key)
            return entry.value

    async def get_many(self, keys: Sequence[str]) -> list[Any | None]:
        if not keys:
            return []

        now = time.monotonic()
        output: list[Any | None] = []
        async with self._lock:
            for key in keys:
                entry = self._data.get(key)
                if entry is None:
                    output.append(None)
                    continue
                if entry.expires_at is not None and entry.expires_at <= now:
                    self._data.pop(key, None)
                    output.append(None)
                    continue
                self._data.move_to_end(key)
                output.append(entry.value)
        return output

    async def set(self, key: str, value: Any, *, ttl: float | None = None) -> None:
        resolved_ttl = self._default_ttl if ttl is None else float(ttl)
        expires_at = None
        if resolved_ttl > 0:
            expires_at = time.monotonic() + resolved_ttl
        async with self._lock:
            self._data[key] = _Entry(value=value, expires_at=expires_at)
            self._data.move_to_end(key)
            await self._evict_locked()

    async def set_many(self, items: Mapping[str, Any], *, ttl: float | None = None) -> None:
        if not items:
            return None

        resolved_ttl = self._default_ttl if ttl is None else float(ttl)
        expires_at = None
        if resolved_ttl > 0:
            expires_at = time.monotonic() + resolved_ttl

        async with self._lock:
            for key, value in items.items():
                self._data[str(key)] = _Entry(value=value, expires_at=expires_at)
                self._data.move_to_end(str(key))
            await self._evict_locked()

    async def delete(self, key: str) -> None:
        async with self._lock:
            self._data.pop(key, None)

    async def invalidate_pattern(self, pattern: str) -> int:
        async with self._lock:
            keys = [key for key in self._data.keys() if fnmatch.fnmatch(key, pattern)]
            for key in keys:
                self._data.pop(key, None)
            return len(keys)

    async def close(self) -> None:
        return None

    async def _evict_locked(self) -> None:
        if self._max_size <= 0:
            self._data.clear()
            return
        while len(self._data) > self._max_size:
            self._data.popitem(last=False)
