from __future__ import annotations

from copy import deepcopy
from typing import Any, Literal, TypedDict

from .json_patch import JsonPatchError, apply_json_patch


class ReduceGap(TypedDict):
    expectedSeq: int
    gotSeq: int


ReduceStatus = Literal["ok", "gap", "patch_error"]


class ReduceResult(TypedDict, total=False):
    status: ReduceStatus
    lastSeq: int
    needsResync: bool
    sharedState: dict[str, Any]
    gap: ReduceGap


def reduce_envelopes_v1(envelopes: list[dict[str, Any]]) -> ReduceResult:
    last_seq = 0
    shared_state: dict[str, Any] = {}

    for env in envelopes:
        seq = env.get("seq")
        event = env.get("event")
        if not isinstance(seq, int) or seq < 0:
            return {
                "status": "patch_error",
                "lastSeq": last_seq,
                "needsResync": True,
                "sharedState": shared_state,
            }
        if not isinstance(event, dict):
            return {
                "status": "patch_error",
                "lastSeq": last_seq,
                "needsResync": True,
                "sharedState": shared_state,
            }

        if seq <= last_seq:
            continue
        if seq > last_seq + 1:
            return {
                "status": "gap",
                "lastSeq": last_seq,
                "needsResync": True,
                "gap": {"expectedSeq": last_seq + 1, "gotSeq": seq},
                "sharedState": shared_state,
            }

        event_type = event.get("type")
        if event_type == "STATE_SNAPSHOT":
            snapshot = event.get("snapshot")
            if not isinstance(snapshot, dict):
                return {
                    "status": "patch_error",
                    "lastSeq": last_seq,
                    "needsResync": True,
                    "sharedState": shared_state,
                }
            shared_state = deepcopy(snapshot)
            last_seq = seq
            continue

        if event_type == "STATE_DELTA":
            delta = event.get("delta")
            if not isinstance(delta, list):
                return {
                    "status": "patch_error",
                    "lastSeq": last_seq,
                    "needsResync": True,
                    "sharedState": shared_state,
                }
            try:
                next_state = apply_json_patch(shared_state, delta)  # type: ignore[arg-type]
            except JsonPatchError:
                return {
                    "status": "patch_error",
                    "lastSeq": last_seq,
                    "needsResync": True,
                    "sharedState": shared_state,
                }
            if not isinstance(next_state, dict):
                return {
                    "status": "patch_error",
                    "lastSeq": last_seq,
                    "needsResync": True,
                    "sharedState": shared_state,
                }
            shared_state = next_state
            last_seq = seq
            continue

        last_seq = seq

    return {
        "status": "ok",
        "lastSeq": last_seq,
        "needsResync": False,
        "sharedState": shared_state,
    }
