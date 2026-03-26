from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from threading import Lock
from typing import Any, TypedDict


class Envelope(TypedDict):
    seq: int
    event: Any


@dataclass(frozen=True)
class ReplayResult:
    envelopes: list[Envelope]
    complete: bool
    available_from_seq: int | None
    available_to_seq: int | None


class InMemoryRingBufferEventStore:
    """Per-thread in-memory ring-buffer of envelopes for short resume windows."""

    def __init__(self, *, capacity_per_thread: int = 20_000) -> None:
        if capacity_per_thread <= 0:
            raise ValueError("capacity_per_thread must be > 0")
        self._capacity = int(capacity_per_thread)
        self._buffers: dict[str, deque[Envelope]] = {}
        self._lock = Lock()

    @property
    def capacity_per_thread(self) -> int:
        return self._capacity

    def append(self, thread_id: str, envelope: Envelope) -> None:
        if not thread_id.strip():
            raise ValueError("thread_id must be non-empty")
        seq = envelope.get("seq")
        if not isinstance(seq, int) or seq <= 0:
            raise ValueError("envelope.seq must be a positive int")

        with self._lock:
            buf = self._buffers.get(thread_id)
            if buf is None:
                buf = deque()
                self._buffers[thread_id] = buf
            buf.append(envelope)
            while len(buf) > self._capacity:
                buf.popleft()

    def replay_after(self, thread_id: str, *, after_seq: int) -> ReplayResult:
        if not thread_id.strip():
            raise ValueError("thread_id must be non-empty")
        if not isinstance(after_seq, int) or after_seq < 0:
            raise ValueError("after_seq must be a non-negative int")

        with self._lock:
            buf = self._buffers.get(thread_id)
            if not buf:
                return ReplayResult(envelopes=[], complete=True, available_from_seq=None, available_to_seq=None)
            items = sorted(list(buf), key=lambda e: int(e.get("seq", 0)))

        available_from = int(items[0]["seq"])
        available_to = int(items[-1]["seq"])

        filtered = [e for e in items if int(e["seq"]) > after_seq]
        if not filtered:
            return ReplayResult(envelopes=[], complete=True, available_from_seq=available_from, available_to_seq=available_to)

        expected_first = after_seq + 1
        first_seq = int(filtered[0]["seq"])
        if first_seq != expected_first:
            return ReplayResult(envelopes=[], complete=False, available_from_seq=available_from, available_to_seq=available_to)

        out: list[Envelope] = []
        expected = expected_first
        complete = True
        for env in filtered:
            seq = int(env["seq"])
            if seq != expected:
                complete = False
                break
            out.append(env)
            expected += 1

        return ReplayResult(envelopes=out, complete=complete, available_from_seq=available_from, available_to_seq=available_to)
