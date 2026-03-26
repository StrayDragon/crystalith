from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal, Protocol, TypedDict

from .a2ui_v1 import A2uiCreateOpV1, A2uiMountOpV1, A2uiRemoveOpV1, A2uiUnmountOpV1, A2uiUpdateOpV1, A2uiV1
from .limits import UiInputLimitsV1, push_json_patch_op_v1
from .state_ui_patch import (
    JsonPatchOp,
    delete_component_v1,
    increment_component_revision_v1,
    mount_component_v1,
    set_component_props_v1,
    set_component_state_v1,
    set_component_v1,
    unmount_component_v1,
)


class A2uiWarning(TypedDict):
    code: Literal["UNKNOWN_KEY", "COMPONENT_NOT_FOUND", "KEY_ALREADY_EXISTS", "COMPONENT_ID_COLLISION"]
    message: str
    opIndex: int
    key: str


class CompileA2uiV1Result(TypedDict):
    patchOps: list[JsonPatchOp]
    createdComponentIds: list[str]
    warnings: list[A2uiWarning]


class KeyMapStore(Protocol):
    def get(self, *, thread_id: str, key: str) -> str | None: ...
    def set(self, *, thread_id: str, key: str, component_id: str) -> None: ...
    def delete(self, *, thread_id: str, key: str) -> None: ...
    def list(self, *, thread_id: str) -> dict[str, str]: ...


@dataclass
class InMemoryKeyMapStore:
    _data: dict[str, dict[str, str]] = None  # type: ignore[assignment]

    def __post_init__(self) -> None:
        if self._data is None:
            self._data = {}

    def get(self, *, thread_id: str, key: str) -> str | None:
        return self._data.get(thread_id, {}).get(key)

    def set(self, *, thread_id: str, key: str, component_id: str) -> None:
        self._data.setdefault(thread_id, {})[key] = component_id

    def delete(self, *, thread_id: str, key: str) -> None:
        data = self._data.get(thread_id)
        if not data:
            return
        data.pop(key, None)
        if not data:
            self._data.pop(thread_id, None)

    def list(self, *, thread_id: str) -> dict[str, str]:
        return dict(self._data.get(thread_id, {}))


class SqliteKeyMapStore:
    def __init__(self, path: str | Path) -> None:
        self._path = str(path)
        self._init_db()

    @property
    def path(self) -> str:
        return self._path

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._path)
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=NORMAL;")
        return conn

    def _init_db(self) -> None:
        Path(self._path).parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS rivu_key_map (
                  thread_id TEXT NOT NULL,
                  key TEXT NOT NULL,
                  component_id TEXT NOT NULL,
                  PRIMARY KEY(thread_id, key)
                )
                """,
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_rivu_key_map_thread ON rivu_key_map(thread_id)",
            )

    def get(self, *, thread_id: str, key: str) -> str | None:
        if not thread_id.strip():
            raise ValueError("thread_id must be non-empty")
        if not key.strip():
            raise ValueError("key must be non-empty")
        with self._connect() as conn:
            row = conn.execute(
                "SELECT component_id FROM rivu_key_map WHERE thread_id=? AND key=?",
                (thread_id, key),
            ).fetchone()
        return str(row[0]) if row else None

    def set(self, *, thread_id: str, key: str, component_id: str) -> None:
        if not thread_id.strip():
            raise ValueError("thread_id must be non-empty")
        if not key.strip():
            raise ValueError("key must be non-empty")
        if not component_id.strip():
            raise ValueError("component_id must be non-empty")
        with self._connect() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO rivu_key_map(thread_id, key, component_id) VALUES (?,?,?)",
                (thread_id, key, component_id),
            )

    def delete(self, *, thread_id: str, key: str) -> None:
        if not thread_id.strip():
            raise ValueError("thread_id must be non-empty")
        if not key.strip():
            raise ValueError("key must be non-empty")
        with self._connect() as conn:
            conn.execute(
                "DELETE FROM rivu_key_map WHERE thread_id=? AND key=?",
                (thread_id, key),
            )

    def list(self, *, thread_id: str) -> dict[str, str]:
        if not thread_id.strip():
            raise ValueError("thread_id must be non-empty")
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT key, component_id FROM rivu_key_map WHERE thread_id=? ORDER BY key ASC",
                (thread_id,),
            ).fetchall()
        return {str(k): str(v) for (k, v) in rows}


def _default_component_id_for_key(key: str) -> str:
    return f"cmp_{key}"


def _select_component_revision(*, shared_state: dict[str, Any], component_id: str) -> int | None:
    ui_raw = shared_state.get("ui")
    if not isinstance(ui_raw, dict):
        return None
    components_raw = ui_raw.get("components")
    if not isinstance(components_raw, dict):
        return None
    comp_raw = components_raw.get(component_id)
    if not isinstance(comp_raw, dict):
        return None
    rev = comp_raw.get("revision")
    return int(rev) if isinstance(rev, int) else None


def compile_a2ui_v1(
    *,
    payload: A2uiV1,
    shared_state: dict[str, Any],
    thread_id: str,
    key_map_store: KeyMapStore,
    limits: UiInputLimitsV1 | None = None,
) -> CompileA2uiV1Result:
    if not thread_id.strip():
        raise ValueError("thread_id must be non-empty")

    patch_ops: list[JsonPatchOp] = []
    created: list[str] = []
    warnings: list[A2uiWarning] = []

    def push(op: JsonPatchOp) -> None:
        if limits is None:
            patch_ops.append(op)
            return
        push_json_patch_op_v1(ops=patch_ops, op=op, limits=limits)

    def push_all(ops: list[JsonPatchOp]) -> None:
        for op in ops:
            push(op)

    for idx, op in enumerate(payload.ops):
        key = getattr(op, "key")
        component_id = key_map_store.get(thread_id=thread_id, key=key)

        if isinstance(op, A2uiCreateOpV1):
            if component_id is not None:
                warnings.append(
                    {
                        "code": "KEY_ALREADY_EXISTS",
                        "message": f"key already exists: {key}",
                        "opIndex": idx,
                        "key": key,
                    }
                )
                continue

            component_id = _default_component_id_for_key(key)

            # Avoid clobbering an existing component id.
            if _select_component_revision(shared_state=shared_state, component_id=component_id) is not None:
                warnings.append(
                    {
                        "code": "COMPONENT_ID_COLLISION",
                        "message": f"componentId already exists: {component_id}",
                        "opIndex": idx,
                        "key": key,
                    }
                )
                continue

            component: dict[str, Any] = {
                "type": op.type,
                "schemaVersion": int(op.schemaVersion),
                "props": op.props,
                "revision": 0,
                "mounts": [],
            }
            if op.state is not None:
                component["state"] = op.state

            push_all(set_component_v1(component_id=component_id, component=component))
            key_map_store.set(thread_id=thread_id, key=key, component_id=component_id)
            created.append(component_id)

            if op.mount is not None:
                push_all(
                    mount_component_v1(
                        component_id=component_id,
                        message_id=op.mount.messageId,
                        slot=op.mount.slot,
                        order=int(op.mount.order or 0),
                    )
                )

            continue

        if component_id is None:
            warnings.append(
                {
                    "code": "UNKNOWN_KEY",
                    "message": f"unknown key: {key}",
                    "opIndex": idx,
                    "key": key,
                }
            )
            continue

        if isinstance(op, A2uiUpdateOpV1):
            current_revision = _select_component_revision(shared_state=shared_state, component_id=component_id)
            if current_revision is None:
                warnings.append(
                    {
                        "code": "COMPONENT_NOT_FOUND",
                        "message": f"component not found: {component_id}",
                        "opIndex": idx,
                        "key": key,
                    }
                )
                continue

            if op.props is not None:
                push_all(set_component_props_v1(component_id=component_id, props=op.props))
            if op.state is not None:
                push_all(set_component_state_v1(component_id=component_id, state=op.state))
            push_all(increment_component_revision_v1(component_id=component_id, current_revision=current_revision))
            continue

        if isinstance(op, A2uiMountOpV1):
            if _select_component_revision(shared_state=shared_state, component_id=component_id) is None:
                warnings.append(
                    {
                        "code": "COMPONENT_NOT_FOUND",
                        "message": f"component not found: {component_id}",
                        "opIndex": idx,
                        "key": key,
                    }
                )
                continue

            push_all(unmount_component_v1(shared_state=shared_state, component_id=component_id, message_id=op.messageId, slot=op.slot))
            push_all(
                mount_component_v1(
                    component_id=component_id,
                    message_id=op.messageId,
                    slot=op.slot,
                    order=int(op.order or 0),
                )
            )
            continue

        if isinstance(op, A2uiUnmountOpV1):
            push_all(unmount_component_v1(shared_state=shared_state, component_id=component_id, message_id=op.messageId, slot=op.slot))
            continue

        if isinstance(op, A2uiRemoveOpV1):
            push_all(delete_component_v1(shared_state=shared_state, component_id=component_id))
            key_map_store.delete(thread_id=thread_id, key=key)
            continue

    return {"patchOps": patch_ops, "createdComponentIds": created, "warnings": warnings}
