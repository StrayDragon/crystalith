from __future__ import annotations

import json
import time
from copy import deepcopy
from dataclasses import dataclass
from typing import Any, Protocol

from .event_store import Envelope, InMemoryRingBufferEventStore
from .json_patch import JsonPatchError, apply_json_patch
from .snapshot_store import SqliteSnapshotStore


@dataclass(frozen=True)
class EventCompactorConfig:
    """Configuration for server-side flush/compaction on the storage boundary."""

    max_buffered_events: int | None = None
    max_buffered_bytes: int | None = None
    flush_interval_ms: int | None = None
    max_replay_events: int | None = None


@dataclass(frozen=True)
class EventCompactorMetrics:
    buffered_events: int
    buffered_bytes: int
    last_seq: int
    state_deltas_since_snapshot: int
    merged_text_chunks: int
    merged_tool_chunks: int
    snapshots_created: int
    flushes: int


class EventCompactor(Protocol):
    def push(self, envelope: Envelope) -> list[Envelope]: ...

    def flush(self) -> list[Envelope]: ...

    def metrics(self) -> EventCompactorMetrics: ...


def _now_ms() -> int:
    return int(time.time() * 1000)


def _estimate_envelope_bytes(env: Envelope) -> int:
    # Best-effort estimate for buffering/flush budgets.
    try:
        payload = json.dumps(env, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        return len(payload)
    except Exception:
        return 0


def _get_str_field(event: dict[str, Any], key: str) -> str | None:
    v = event.get(key)
    if not isinstance(v, str):
        return None
    v = v.strip()
    return v if v else None


class DefaultEventCompactor:
    def __init__(self, config: EventCompactorConfig | None = None) -> None:
        self._config = config or EventCompactorConfig()
        self._buffer: list[Envelope] = []
        self._buffered_bytes: int = 0
        self._last_flush_at_ms: int = _now_ms()
        self._last_seq: int = 0
        self._shared_state: dict[str, Any] = {}
        self._state_deltas_since_snapshot: int = 0
        self._merged_text_chunks: int = 0
        self._merged_tool_chunks: int = 0
        self._snapshots_created: int = 0
        self._flushes: int = 0

    @property
    def config(self) -> EventCompactorConfig:
        return self._config

    def _should_flush_by_time(self) -> bool:
        interval = self._config.flush_interval_ms
        if interval is None or interval <= 0:
            return False
        if not self._buffer:
            return False
        return _now_ms() - self._last_flush_at_ms >= interval

    def _should_flush_by_budget(self) -> bool:
        max_events = self._config.max_buffered_events
        if max_events is not None and max_events > 0 and len(self._buffer) > max_events:
            return True
        max_bytes = self._config.max_buffered_bytes
        if max_bytes is not None and max_bytes > 0 and self._buffered_bytes > max_bytes:
            return True
        return False

    def _push_buffered(self, envelope: Envelope) -> None:
        self._buffered_bytes += _estimate_envelope_bytes(envelope)
        self._buffer.append(envelope)

    def _try_merge_text_chunk(self, envelope: Envelope) -> bool:
        event = envelope.get("event")
        if not isinstance(event, dict) or event.get("type") != "TEXT_MESSAGE_CHUNK":
            return False

        message_id = _get_str_field(event, "messageId")
        if message_id is None:
            return False
        role = _get_str_field(event, "role") or "assistant"
        delta = event.get("delta")
        if not isinstance(delta, str):
            delta = ""

        if not self._buffer:
            return False
        last = self._buffer[-1]
        last_event = last.get("event")
        if not isinstance(last_event, dict) or last_event.get("type") != "TEXT_MESSAGE_CHUNK":
            return False

        last_message_id = _get_str_field(last_event, "messageId")
        if last_message_id != message_id:
            return False
        last_role = _get_str_field(last_event, "role") or "assistant"
        if last_role != role:
            return False

        prev_bytes = _estimate_envelope_bytes(last)
        last_delta = last_event.get("delta")
        if not isinstance(last_delta, str):
            last_delta = ""
        last["seq"] = int(envelope["seq"])
        last_event["delta"] = f"{last_delta}{delta}"
        self._buffered_bytes = self._buffered_bytes - prev_bytes + _estimate_envelope_bytes(last)
        self._merged_text_chunks += 1
        return True

    def _try_merge_tool_chunk(self, envelope: Envelope) -> bool:
        event = envelope.get("event")
        if not isinstance(event, dict) or event.get("type") != "TOOL_CALL_CHUNK":
            return False

        tool_call_id = _get_str_field(event, "toolCallId")
        if tool_call_id is None:
            return False
        delta = event.get("delta")
        if not isinstance(delta, str):
            delta = ""

        name = _get_str_field(event, "toolCallName")
        parent = _get_str_field(event, "parentMessageId")

        if not self._buffer:
            return False
        last = self._buffer[-1]
        last_event = last.get("event")
        if not isinstance(last_event, dict) or last_event.get("type") != "TOOL_CALL_CHUNK":
            return False

        last_tool_call_id = _get_str_field(last_event, "toolCallId")
        if last_tool_call_id != tool_call_id:
            return False

        last_name = _get_str_field(last_event, "toolCallName")
        if last_name is not None and name is not None and last_name != name:
            return False
        last_parent = _get_str_field(last_event, "parentMessageId")
        if last_parent is not None and parent is not None and last_parent != parent:
            return False

        prev_bytes = _estimate_envelope_bytes(last)
        last_delta = last_event.get("delta")
        if not isinstance(last_delta, str):
            last_delta = ""

        last["seq"] = int(envelope["seq"])
        last_event["delta"] = f"{last_delta}{delta}"
        if last_name is None and name is not None:
            last_event["toolCallName"] = name
        if last_parent is None and parent is not None:
            last_event["parentMessageId"] = parent

        self._buffered_bytes = self._buffered_bytes - prev_bytes + _estimate_envelope_bytes(last)
        self._merged_tool_chunks += 1
        return True

    def _on_state_snapshot(self, event: dict[str, Any]) -> None:
        snapshot = event.get("snapshot")
        if not isinstance(snapshot, dict):
            raise ValueError("STATE_SNAPSHOT.snapshot must be an object")
        self._shared_state = deepcopy(snapshot)
        self._state_deltas_since_snapshot = 0

    def _on_state_delta(self, event: dict[str, Any]) -> None:
        delta = event.get("delta")
        if not isinstance(delta, list):
            raise ValueError("STATE_DELTA.delta must be an array")
        try:
            next_state = apply_json_patch(self._shared_state, delta)  # type: ignore[arg-type]
        except JsonPatchError as e:
            raise ValueError("apply_json_patch failed") from e
        if not isinstance(next_state, dict):
            raise ValueError("patch result must be an object")
        self._shared_state = next_state
        self._state_deltas_since_snapshot += 1

    def _maybe_truncate_patch_chain(self, *, seq: int) -> None:
        max_replay_events = self._config.max_replay_events
        if max_replay_events is None or max_replay_events <= 0:
            return
        if self._state_deltas_since_snapshot <= max_replay_events:
            return

        last_snapshot_seq = 0
        for env in reversed(self._buffer):
            ev = env.get("event")
            if isinstance(ev, dict) and ev.get("type") == "STATE_SNAPSHOT":
                last_snapshot_seq = int(env.get("seq", 0) or 0)
                break

        self._buffer = [
            env
            for env in self._buffer
            if not (isinstance(env.get("event"), dict) and env["event"].get("type") == "STATE_DELTA" and int(env.get("seq", 0)) > last_snapshot_seq)
        ]
        self._buffer.append({"seq": int(seq), "event": {"type": "STATE_SNAPSHOT", "snapshot": deepcopy(self._shared_state)}})
        self._buffered_bytes = sum(_estimate_envelope_bytes(e) for e in self._buffer)
        self._state_deltas_since_snapshot = 0
        self._snapshots_created += 1

    def push(self, envelope: Envelope) -> list[Envelope]:
        seq = envelope.get("seq")
        if not isinstance(seq, int) or seq <= 0:
            raise ValueError("envelope.seq must be a positive int")

        flushed: list[Envelope] = []
        if self._should_flush_by_time():
            flushed.extend(self.flush())

        self._last_seq = max(self._last_seq, seq)

        if self._try_merge_text_chunk(envelope):
            pass
        elif self._try_merge_tool_chunk(envelope):
            pass
        else:
            event = envelope.get("event")
            self._push_buffered({"seq": int(seq), "event": deepcopy(event)})

        event = envelope.get("event")
        if isinstance(event, dict):
            event_type = event.get("type")
            if event_type == "STATE_SNAPSHOT":
                self._on_state_snapshot(event)
            elif event_type == "STATE_DELTA":
                self._on_state_delta(event)
                self._maybe_truncate_patch_chain(seq=seq)

        if self._should_flush_by_budget():
            flushed.extend(self.flush())

        return flushed

    def flush(self) -> list[Envelope]:
        if not self._buffer:
            return []
        self._flushes += 1
        self._last_flush_at_ms = _now_ms()
        out = self._buffer
        self._buffer = []
        self._buffered_bytes = 0
        return out

    def metrics(self) -> EventCompactorMetrics:
        return EventCompactorMetrics(
            buffered_events=len(self._buffer),
            buffered_bytes=self._buffered_bytes,
            last_seq=self._last_seq,
            state_deltas_since_snapshot=self._state_deltas_since_snapshot,
            merged_text_chunks=self._merged_text_chunks,
            merged_tool_chunks=self._merged_tool_chunks,
            snapshots_created=self._snapshots_created,
            flushes=self._flushes,
        )


class CompactingEventSink:
    """Optional helper that persists compactor output into the default stores."""

    def __init__(
        self,
        *,
        thread_id: str,
        event_store: InMemoryRingBufferEventStore,
        snapshot_store: SqliteSnapshotStore,
        compactor: DefaultEventCompactor | None = None,
    ) -> None:
        if not thread_id.strip():
            raise ValueError("thread_id must be non-empty")
        self._thread_id = thread_id
        self._event_store = event_store
        self._snapshot_store = snapshot_store
        self._compactor = compactor or DefaultEventCompactor()

    def push(self, envelope: Envelope) -> None:
        out = self._compactor.push(envelope)
        self._persist(out)

    def flush(self) -> None:
        out = self._compactor.flush()
        self._persist(out)

    def metrics(self) -> EventCompactorMetrics:
        return self._compactor.metrics()

    def _persist(self, envelopes: list[Envelope]) -> None:
        for env in envelopes:
            event = env.get("event")
            if isinstance(event, dict) and event.get("type") == "STATE_SNAPSHOT":
                snapshot = event.get("snapshot")
                if not isinstance(snapshot, dict):
                    raise ValueError("STATE_SNAPSHOT.snapshot must be an object")
                self._snapshot_store.put(thread_id=self._thread_id, seq=int(env["seq"]), shared_state=snapshot)
            self._event_store.append(self._thread_id, env)
