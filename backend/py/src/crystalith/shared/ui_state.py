from __future__ import annotations

from copy import deepcopy
from typing import cast

from rivu_server_sdk import UiStateV1, delete_component_v1
from rivu_server_sdk.json_patch import apply_json_patch

from crystalith.shared.db import Session
from crystalith.shared.json_types import JsonDict, JsonValue

JsonPatchOp = JsonDict


_EMPTY_UI_STATE: JsonDict = {
    "v": 1,
    "components": {},
    "datasets": {},
}


_EMPTY_SHARED_STATE: JsonDict = {
    "ui": deepcopy(_EMPTY_UI_STATE),
}


def build_default_shared_state() -> JsonDict:
    return cast(JsonDict, deepcopy(_EMPTY_SHARED_STATE))


def _coerce_json_dict(value: JsonValue | None) -> JsonDict | None:
    if not isinstance(value, dict):
        return None
    return cast(JsonDict, deepcopy(value))


def normalize_shared_state(value: JsonValue | None) -> JsonDict:
    normalized = _coerce_json_dict(value) or build_default_shared_state()
    ui_raw = normalized.get("ui")
    if not isinstance(ui_raw, dict):
        ui_raw = deepcopy(_EMPTY_UI_STATE)
    ui_state = UiStateV1.model_validate(ui_raw)
    normalized["ui"] = cast(JsonValue, ui_state.model_dump(mode="json", exclude_none=True))
    return normalized


def ensure_session_shared_state(db_session: Session) -> JsonDict:
    normalized = normalize_shared_state(cast(JsonValue | None, db_session.shared_state))
    if db_session.shared_state != normalized:
        db_session.shared_state = normalized
    return normalized


def apply_state_delta(
    db_session: Session,
    *,
    delta: list[JsonPatchOp],
) -> tuple[JsonDict, int]:
    current = ensure_session_shared_state(db_session)
    if not delta:
        return current, int(db_session.shared_state_revision)
    next_state = apply_json_patch(current, cast(list[dict[str, object]], deepcopy(delta)))
    normalized = normalize_shared_state(cast(JsonValue, next_state))
    db_session.shared_state = normalized
    db_session.shared_state_revision = int(db_session.shared_state_revision) + 1
    return normalized, int(db_session.shared_state_revision)


def remove_message_components(
    db_session: Session,
    *,
    message_id: int,
) -> tuple[JsonDict, int, list[JsonPatchOp]]:
    shared_state = ensure_session_shared_state(db_session)
    ui_raw = shared_state.get("ui")
    if not isinstance(ui_raw, dict):
        return shared_state, int(db_session.shared_state_revision), []
    components_raw = ui_raw.get("components")
    if not isinstance(components_raw, dict):
        return shared_state, int(db_session.shared_state_revision), []

    target_message_id = str(message_id)
    working_state = shared_state
    combined_delta: list[JsonPatchOp] = []

    for component_id, component_raw in list(components_raw.items()):
        if not isinstance(component_raw, dict):
            continue
        mounts_raw = component_raw.get("mounts")
        if not isinstance(mounts_raw, list):
            continue
        matches_message = False
        for mount_raw in mounts_raw:
            if not isinstance(mount_raw, dict):
                continue
            mount_message_id = mount_raw.get("messageId")
            if mount_message_id == target_message_id:
                matches_message = True
                break
        if not matches_message:
            continue
        delta_piece = cast(list[JsonPatchOp], delete_component_v1(shared_state=working_state, component_id=component_id))
        if not delta_piece:
            continue
        working_state = normalize_shared_state(
            cast(JsonValue, apply_json_patch(working_state, cast(list[dict[str, object]], delta_piece)))
        )
        combined_delta.extend(delta_piece)

    if not combined_delta:
        return shared_state, int(db_session.shared_state_revision), []

    db_session.shared_state = working_state
    db_session.shared_state_revision = int(db_session.shared_state_revision) + 1
    return working_state, int(db_session.shared_state_revision), combined_delta
