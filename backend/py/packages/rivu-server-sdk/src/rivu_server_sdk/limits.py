from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from typing import Any, Final, Literal, NotRequired, TypedDict


class UiInputDecodeLimitsV1(TypedDict, total=False):
    maxBytes: int
    maxDepth: int
    maxStringLength: int


class UiInputUiEventLimitsV1(TypedDict, total=False):
    maxPayloadKeys: int


class UiInputUiStateLimitsV1(TypedDict, total=False):
    maxComponents: int
    maxMountsTotal: int
    maxDatasets: int
    maxDatasetRows: int
    maxDatasetColumns: int


class UiInputJsonPatchLimitsV1(TypedDict, total=False):
    maxOps: int
    maxPathLength: int
    allowedPathPrefixes: list[str]


class UiInputLimitsV1(TypedDict, total=False):
    decode: UiInputDecodeLimitsV1
    uiEvent: UiInputUiEventLimitsV1
    uiState: UiInputUiStateLimitsV1
    jsonPatch: UiInputJsonPatchLimitsV1


viewerDefaults: Final[UiInputLimitsV1] = {
    "decode": {"maxBytes": 1_048_576, "maxDepth": 32, "maxStringLength": 100_000},
    "uiEvent": {"maxPayloadKeys": 32},
    "uiState": {
        "maxComponents": 500,
        "maxMountsTotal": 5_000,
        "maxDatasets": 50,
        "maxDatasetRows": 10_000,
        "maxDatasetColumns": 50,
    },
    "jsonPatch": {"maxOps": 2_000, "maxPathLength": 256, "allowedPathPrefixes": ["/ui"]},
}

workflowDefaults: Final[UiInputLimitsV1] = {
    "decode": {"maxBytes": 262_144, "maxDepth": 24, "maxStringLength": 50_000},
    "uiEvent": {"maxPayloadKeys": 16},
    "uiState": {
        "maxComponents": 200,
        "maxMountsTotal": 2_000,
        "maxDatasets": 20,
        "maxDatasetRows": 2_000,
        "maxDatasetColumns": 50,
    },
    "jsonPatch": {"maxOps": 500, "maxPathLength": 256, "allowedPathPrefixes": ["/ui"]},
}


class LimitExceededErrorInfo(TypedDict):
    code: Literal["LIMIT_EXCEEDED"]
    limit: str
    max: int
    observed: int
    path: NotRequired[str]


class LimitExceededError(Exception):
    def __init__(self, *, limit: str, max: int, observed: int, path: str | None = None) -> None:
        self.info: LimitExceededErrorInfo = {
            "code": "LIMIT_EXCEEDED",
            "limit": limit,
            "max": max,
            "observed": observed,
        }
        if path is not None:
            self.info["path"] = path
        super().__init__(f"LIMIT_EXCEEDED {limit} max={max} observed={observed}")


def check_ui_v1_event_limits_v1(*, event: Mapping[str, Any], limits: UiInputLimitsV1) -> None:
    max_payload_keys = limits.get("uiEvent", {}).get("maxPayloadKeys")
    if max_payload_keys is None:
        return
    payload = (((event.get("value") or {}) if isinstance(event.get("value"), Mapping) else {})).get("payload")
    if not isinstance(payload, Mapping):
        return
    observed = len(payload.keys())
    if observed <= max_payload_keys:
        return
    raise LimitExceededError(limit="uiEvent.maxPayloadKeys", max=max_payload_keys, observed=observed)


def check_json_patch_limits_v1(*, delta: Any, limits: UiInputLimitsV1) -> None:
    json_patch = limits.get("jsonPatch", {})
    if not isinstance(json_patch, Mapping):
        return

    max_ops = json_patch.get("maxOps")
    if max_ops is not None:
        if not isinstance(delta, list):
            return
        observed = len(delta)
        if observed > max_ops:
            raise LimitExceededError(limit="jsonPatch.maxOps", max=max_ops, observed=observed)

    prefixes = json_patch.get("allowedPathPrefixes")
    if prefixes is None:
        return
    if not isinstance(prefixes, list):
        return
    if not isinstance(delta, list):
        return
    for op in delta:
        if not isinstance(op, Mapping):
            continue
        path = op.get("path")
        if not isinstance(path, str):
            continue
        ok = any(isinstance(p, str) and path.startswith(p) for p in prefixes)
        if ok:
            continue
        raise LimitExceededError(limit="jsonPatch.allowedPathPrefixes", max=0, observed=1, path=path)


def push_json_patch_op_v1(*, ops: list[dict[str, Any]], op: Mapping[str, Any], limits: UiInputLimitsV1) -> None:
    json_patch = limits.get("jsonPatch", {})
    if not isinstance(json_patch, Mapping):
        ops.append(dict(op))
        return

    max_ops = json_patch.get("maxOps")
    if max_ops is not None:
        observed = len(ops) + 1
        if observed > max_ops:
            raise LimitExceededError(limit="jsonPatch.maxOps", max=max_ops, observed=observed)

    prefixes = json_patch.get("allowedPathPrefixes")
    if isinstance(prefixes, list):
        path = op.get("path")
        if isinstance(path, str):
            ok = any(isinstance(p, str) and path.startswith(p) for p in prefixes)
            if not ok:
                raise LimitExceededError(limit="jsonPatch.allowedPathPrefixes", max=0, observed=1, path=path)

    ops.append(dict(op))


def check_ui_state_limits_v1(*, shared_state: Any, limits: UiInputLimitsV1) -> None:
    max_components = limits.get("uiState", {}).get("maxComponents")
    if max_components is None:
        return
    if not isinstance(shared_state, Mapping):
        return
    ui = shared_state.get("ui")
    if not isinstance(ui, Mapping):
        return
    components = ui.get("components")
    if not isinstance(components, Mapping):
        return
    observed = len(components.keys())
    if observed <= max_components:
        return
    raise LimitExceededError(limit="uiState.maxComponents", max=max_components, observed=observed)


def estimate_json_utf8_size(value: Any) -> int:
    try:
        raw = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    except TypeError:
        return 2**63 - 1
    return len(raw.encode("utf-8"))


def compute_max_depth(value: Any) -> int:
    max_seen = 1
    stack: list[tuple[Any, int]] = [(value, 1)]
    while stack:
        current, depth = stack.pop()
        if depth > max_seen:
            max_seen = depth
        if isinstance(current, Mapping):
            for v in current.values():
                stack.append((v, depth + 1))
            continue
        if isinstance(current, (str, bytes, bytearray)):
            continue
        if isinstance(current, Sequence):
            for v in current:
                stack.append((v, depth + 1))
    return max_seen


def compute_max_string_length_utf8(value: Any) -> int:
    max_seen = 0
    stack: list[Any] = [value]
    while stack:
        current = stack.pop()
        if isinstance(current, str):
            max_seen = max(max_seen, len(current.encode("utf-8")))
            continue
        if isinstance(current, (bytes, bytearray)):
            max_seen = max(max_seen, len(current))
            continue
        if isinstance(current, Mapping):
            for k, v in current.items():
                if isinstance(k, str):
                    max_seen = max(max_seen, len(k.encode("utf-8")))
                stack.append(v)
            continue
        if isinstance(current, Sequence) and not isinstance(current, (str, bytes, bytearray)):
            for v in current:
                stack.append(v)
    return max_seen


def exceeds_max_depth(value: Any, *, max_depth: int) -> bool:
    stack: list[tuple[Any, int]] = [(value, 1)]
    while stack:
        current, depth = stack.pop()
        if depth > max_depth:
            return True
        if isinstance(current, Mapping):
            for v in current.values():
                stack.append((v, depth + 1))
            continue
        if isinstance(current, (str, bytes)):
            continue
        if isinstance(current, Sequence):
            for v in current:
                stack.append((v, depth + 1))
    return False
