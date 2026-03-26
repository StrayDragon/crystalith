from __future__ import annotations

from dataclasses import dataclass
from threading import Lock


@dataclass
class SeqAllocator:
    """Allocate monotonically increasing seq values per thread (in-memory).

    `seq` is transport metadata used for ordering/resume.
    """

    _next_by_thread: dict[str, int]
    _lock: Lock

    def __init__(self) -> None:
        self._next_by_thread = {}
        self._lock = Lock()

    def next(self, thread_id: str) -> int:
        if not thread_id.strip():
            raise ValueError("thread_id must be non-empty")
        with self._lock:
            seq = self._next_by_thread.get(thread_id, 1)
            self._next_by_thread[thread_id] = seq + 1
            return seq

    def observe(self, thread_id: str, seq: int) -> None:
        """Ensure subsequent allocations are > seq."""
        if not thread_id.strip():
            raise ValueError("thread_id must be non-empty")
        if not isinstance(seq, int) or seq < 0:
            raise ValueError("seq must be a non-negative int")
        with self._lock:
            next_seq = seq + 1
            current = self._next_by_thread.get(thread_id, 1)
            if next_seq > current:
                self._next_by_thread[thread_id] = next_seq
