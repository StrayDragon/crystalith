from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

from .event_store import Envelope, InMemoryRingBufferEventStore
from .seq import SeqAllocator
from .snapshot_store import SqliteSnapshotStore


ResumeKind = Literal["replay", "snapshot", "not_found"]


@dataclass(frozen=True)
class ResumeResult:
    kind: ResumeKind
    envelopes: list[Envelope]


def resume_replay(
    *,
    thread_id: str,
    resume_from: int,
    event_store: InMemoryRingBufferEventStore,
    snapshot_store: SqliteSnapshotStore,
    seq_allocator: SeqAllocator | None = None,
) -> ResumeResult:
    """Return envelopes to send for `resumeFrom`.

    - Prefer contiguous replay from the event store.
    - If replay is incomplete, fall back to a `STATE_SNAPSHOT` at `seq = resume_from + 1`.
    """
    replay = event_store.replay_after(thread_id, after_seq=resume_from)
    if replay.complete:
        return ResumeResult(kind="replay", envelopes=replay.envelopes)

    snap = snapshot_store.get_latest(thread_id=thread_id)
    if snap is None:
        return ResumeResult(kind="not_found", envelopes=[])

    seq = resume_from + 1
    if seq_allocator is not None:
        seq_allocator.observe(thread_id, seq)

    snapshot_event: dict[str, Any] = {"type": "STATE_SNAPSHOT", "snapshot": snap.shared_state}
    return ResumeResult(kind="snapshot", envelopes=[{"seq": seq, "event": snapshot_event}])
