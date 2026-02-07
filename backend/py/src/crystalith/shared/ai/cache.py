from __future__ import annotations

import hashlib
import threading
from collections import OrderedDict
from typing import Sequence


class EmbeddingCache:
    def __init__(self, maxsize: int = 10_000) -> None:
        if maxsize <= 0:
            raise ValueError("maxsize must be greater than 0")
        self._maxsize = maxsize
        self._lock = threading.Lock()
        self._data: OrderedDict[tuple[str, str], list[float]] = OrderedDict()

    @staticmethod
    def _hash_text(text: str) -> str:
        return hashlib.sha256(text.encode("utf-8")).hexdigest()

    def _key(self, model: str, text: str) -> tuple[str, str]:
        return model, self._hash_text(text)

    def get(self, *, model: str, text: str) -> list[float] | None:
        key = self._key(model, text)
        with self._lock:
            cached = self._data.get(key)
            if cached is None:
                return None
            self._data.move_to_end(key)
            return list(cached)

    def set(self, *, model: str, text: str, vector: Sequence[float]) -> None:
        key = self._key(model, text)
        with self._lock:
            self._data[key] = list(vector)
            self._data.move_to_end(key)
            while len(self._data) > self._maxsize:
                self._data.popitem(last=False)
