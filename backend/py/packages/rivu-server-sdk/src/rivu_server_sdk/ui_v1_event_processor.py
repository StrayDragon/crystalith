from __future__ import annotations

import math
import time
from dataclasses import dataclass
from typing import Any, Callable, Literal, TypedDict

from .json_patch import apply_json_patch
from .state_ui import UiComponentV1, UiStateV1
from .ui_v1_event import UiV1CustomEvent, UiV1EventValue


class UiV1EventProcessorError(Exception):
    pass


class AuthorizationError(UiV1EventProcessorError):
    pass


class RevisionConflictError(UiV1EventProcessorError):
    pass


class UnknownComponentError(UiV1EventProcessorError):
    pass


class InvalidPayloadError(UiV1EventProcessorError):
    pass


class ProcessedResult(TypedDict):
    shared_state: dict[str, Any]
    events: list[dict[str, Any]]
    component_id: str
    client_request_id: str
    new_revision: int


AuthorizeHook = Callable[[UiV1CustomEvent, UiComponentV1], None]


@dataclass
class UiV1EventProcessor:
    """A small helper to process `ui.v1.event` into AG-UI state events.

    This processor is intentionally minimal:
    - authorization is a hook
    - idempotency is tracked in-memory by `clientRequestId`
    - concurrency uses `baseRevision` vs component `revision`
    """

    authorize: AuthorizeHook | None = None
    now_ms: Callable[[], int] = lambda: int(time.time() * 1000)

    # clientRequestId -> ProcessedResult (events+revision) for idempotent retries
    _idempotency: dict[str, ProcessedResult] = None  # type: ignore[assignment]

    def __post_init__(self) -> None:
        if self._idempotency is None:
            self._idempotency = {}

    def process(self, *, shared_state: dict[str, Any], event: UiV1CustomEvent) -> ProcessedResult:
        value: UiV1EventValue = event.value
        component_id = value.componentId
        client_request_id = value.clientRequestId

        existing = self._idempotency.get(client_request_id)
        if existing is not None:
            return existing

        ui_raw = shared_state.get("ui")
        if not isinstance(ui_raw, dict):
            raise UnknownComponentError("shared_state.ui is missing")
        ui_state = UiStateV1.model_validate(ui_raw)

        component_raw = ui_state.components.get(component_id)
        if component_raw is None:
            raise UnknownComponentError(f"component not found: {component_id}")

        if value.baseRevision != component_raw.revision:
            raise RevisionConflictError(
                f"revision conflict: baseRevision={value.baseRevision} currentRevision={component_raw.revision}"
            )

        if self.authorize is not None:
            self.authorize(event, component_raw)

        new_component = self._apply_component_event(component=component_raw, value=value)
        new_revision = int(new_component.revision)

        patch = [
            {
                "op": "add",
                "path": f"/ui/components/{_encode_pointer(component_id)}/state",
                "value": new_component.state or {},
            },
            {
                "op": "replace",
                "path": f"/ui/components/{_encode_pointer(component_id)}/revision",
                "value": new_revision,
            },
        ]

        next_shared_state = apply_json_patch(shared_state, patch)
        if not isinstance(next_shared_state, dict):
            raise UiV1EventProcessorError("patch produced non-object shared_state")

        state_delta_event: dict[str, Any] = {"type": "STATE_DELTA", "delta": patch}
        result: ProcessedResult = {
            "shared_state": next_shared_state,
            "events": [state_delta_event],
            "component_id": component_id,
            "client_request_id": client_request_id,
            "new_revision": new_revision,
        }

        self._idempotency[client_request_id] = result
        return result

    def _apply_component_event(self, *, component: UiComponentV1, value: UiV1EventValue) -> UiComponentV1:
        event_name: str = value.eventName
        payload: dict[str, Any] = value.payload

        state = dict(component.state or {})
        revision = int(component.revision)

        def is_finite_number(v: Any) -> bool:
            if isinstance(v, bool):
                return False
            if not isinstance(v, (int, float)):
                return False
            return math.isfinite(float(v))

        if component.type == "ApprovalCard":
            if event_name not in ("approve", "deny"):
                raise InvalidPayloadError(f"unsupported ApprovalCard eventName: {event_name}")
            state["status"] = "approved" if event_name == "approve" else "denied"
            state.setdefault("decidedAtMs", self.now_ms())
            return component.model_copy(update={"state": state, "revision": revision + 1})

        if component.type == "ConfirmCard":
            if event_name not in ("confirm", "cancel"):
                raise InvalidPayloadError(f"unsupported ConfirmCard eventName: {event_name}")
            state["status"] = "confirmed" if event_name == "confirm" else "cancelled"
            state.setdefault("decidedAtMs", self.now_ms())
            return component.model_copy(update={"state": state, "revision": revision + 1})

        if component.type == "Chart":
            if event_name == "chart.clearSelection":
                state["selection"] = {"kind": "none"}
                return component.model_copy(update={"state": state, "revision": revision + 1})

            if event_name != "chart.setSelection":
                raise InvalidPayloadError(f"unsupported Chart eventName: {event_name}")

            selection = payload.get("selection")
            if not isinstance(selection, dict):
                raise InvalidPayloadError("payload.selection must be an object")
            kind = selection.get("kind")

            if kind == "none":
                next_selection = {"kind": "none"}
            elif kind == "point":
                row_index = selection.get("rowIndex")
                if not isinstance(row_index, int) or row_index < 0:
                    raise InvalidPayloadError("payload.selection.rowIndex must be a non-negative integer")

                data = component.props.get("data")
                rows: Any = None
                if isinstance(data, dict):
                    rows = data.get("rows")
                if not isinstance(rows, list):
                    raise InvalidPayloadError("Chart props.data.rows must be an array")
                if row_index >= len(rows):
                    raise InvalidPayloadError(
                        f"payload.selection.rowIndex out of range: rowIndex={row_index} rows={len(rows)}"
                    )
                next_selection = {"kind": "point", "rowIndex": row_index}
            elif kind == "range":
                column = selection.get("column")
                if not isinstance(column, str) or not column.strip():
                    raise InvalidPayloadError("payload.selection.column must be a non-empty string")
                from_v = selection.get("from")
                to_v = selection.get("to")
                if from_v is not None and not (is_finite_number(from_v) or isinstance(from_v, str)):
                    raise InvalidPayloadError("payload.selection.from must be string|number|null")
                if to_v is not None and not (is_finite_number(to_v) or isinstance(to_v, str)):
                    raise InvalidPayloadError("payload.selection.to must be string|number|null")
                next_selection = {"kind": "range", "column": column, "from": from_v, "to": to_v}
            elif kind == "series":
                series_value = selection.get("value")
                if not (isinstance(series_value, str) or is_finite_number(series_value)):
                    raise InvalidPayloadError("payload.selection.value must be string|number")
                next_selection = {"kind": "series", "value": series_value}
            else:
                raise InvalidPayloadError('payload.selection.kind must be one of "none"|"point"|"range"|"series"')

            state["selection"] = next_selection
            return component.model_copy(update={"state": state, "revision": revision + 1})

        if component.type == "FormCard":
            values_state = dict(state.get("values") or {})
            if event_name == "setField":
                field_id = payload.get("fieldId")
                if not isinstance(field_id, str) or not field_id.strip():
                    raise InvalidPayloadError("payload.fieldId must be a non-empty string")
                values_state[field_id] = payload.get("value")
                state["values"] = values_state
                errors_state = dict(state.get("errors") or {})
                errors_state.pop(field_id, None)
                state["errors"] = errors_state
                return component.model_copy(update={"state": state, "revision": revision + 1})
            if event_name == "submit":
                submitted_values = payload.get("values")
                if isinstance(submitted_values, dict):
                    state["values"] = {**values_state, **submitted_values}
                state["status"] = "submitted"
                return component.model_copy(update={"state": state, "revision": revision + 1})
            raise InvalidPayloadError(f"unsupported FormCard eventName: {event_name}")

        if component.type == "MultiStepWizard":
            if event_name == "wizard.setField":
                if set(payload.keys()) != {"fieldId", "value"}:
                    raise InvalidPayloadError("payload must have only fieldId and value")

                field_id = payload.get("fieldId")
                if not isinstance(field_id, str) or not field_id.strip():
                    raise InvalidPayloadError("payload.fieldId must be a non-empty string")

                value = payload.get("value")
                ok_value = value is None or isinstance(value, str) or is_finite_number(value)
                if not ok_value:
                    raise InvalidPayloadError("payload.value must be string|number|null")

                values_state = dict(state.get("values") or {})
                values_state[field_id] = value
                state["values"] = values_state

                errors_state = dict(state.get("errors") or {})
                errors_state.pop(field_id, None)
                state["errors"] = errors_state

                return component.model_copy(update={"state": state, "revision": revision + 1})

            if event_name in ("wizard.next", "wizard.prev", "wizard.submit", "wizard.reset") and payload:
                raise InvalidPayloadError("payload must be empty")

            steps = component.props.get("steps")
            if not isinstance(steps, list) or len(steps) == 0:
                raise InvalidPayloadError("MultiStepWizard props.steps must be a non-empty array")
            step_ids: list[str] = []
            for step in steps:
                if not isinstance(step, dict):
                    raise InvalidPayloadError("MultiStepWizard props.steps entries must be objects")
                step_id = step.get("id")
                if not isinstance(step_id, str) or not step_id.strip():
                    raise InvalidPayloadError("MultiStepWizard step.id must be a non-empty string")
                step_ids.append(step_id)

            current_step_id = state.get("currentStepId")
            if not isinstance(current_step_id, str) or not current_step_id.strip():
                current_step_id = step_ids[0]

            if event_name == "wizard.next":
                idx = step_ids.index(current_step_id) if current_step_id in step_ids else 0
                if idx + 1 < len(step_ids):
                    state["currentStepId"] = step_ids[idx + 1]
                return component.model_copy(update={"state": state, "revision": revision + 1})

            if event_name == "wizard.prev":
                idx = step_ids.index(current_step_id) if current_step_id in step_ids else 0
                if idx > 0:
                    state["currentStepId"] = step_ids[idx - 1]
                return component.model_copy(update={"state": state, "revision": revision + 1})

            if event_name == "wizard.submit":
                state["status"] = "submitted"
                return component.model_copy(update={"state": state, "revision": revision + 1})

            if event_name == "wizard.reset":
                state["currentStepId"] = step_ids[0]
                state["values"] = {}
                state.pop("errors", None)
                state.pop("disabled", None)
                state["status"] = "idle"
                return component.model_copy(update={"state": state, "revision": revision + 1})

            raise InvalidPayloadError(f"unsupported MultiStepWizard eventName: {event_name}")

        if component.type == "FileUploadCard":
            if event_name == "file.add":
                if set(payload.keys()) != {"file"}:
                    raise InvalidPayloadError("payload must have only file")

                file_ref = payload.get("file")
                if not isinstance(file_ref, dict):
                    raise InvalidPayloadError("payload.file must be an object")

                allowed = {"id", "name", "sizeBytes", "mimeType", "url"}
                extra = set(file_ref.keys()) - allowed
                if extra:
                    raise InvalidPayloadError("payload.file contains unexpected keys")

                file_id = file_ref.get("id")
                if not isinstance(file_id, str) or not file_id.strip():
                    raise InvalidPayloadError("payload.file.id must be a non-empty string")

                name = file_ref.get("name")
                if not isinstance(name, str) or not name.strip():
                    raise InvalidPayloadError("payload.file.name must be a non-empty string")

                size_bytes = file_ref.get("sizeBytes")
                if isinstance(size_bytes, bool) or not isinstance(size_bytes, int) or size_bytes < 0:
                    raise InvalidPayloadError("payload.file.sizeBytes must be a non-negative int")

                mime_type = file_ref.get("mimeType")
                if mime_type is not None and (not isinstance(mime_type, str) or not mime_type.strip()):
                    raise InvalidPayloadError("payload.file.mimeType must be a non-empty string")

                url = file_ref.get("url")
                if url is not None and (not isinstance(url, str) or not url.strip()):
                    raise InvalidPayloadError("payload.file.url must be a non-empty string")

                files_state = state.get("files")
                files_list = list(files_state) if isinstance(files_state, list) else []
                files_list.append(file_ref)
                state["files"] = files_list

                return component.model_copy(update={"state": state, "revision": revision + 1})

            if event_name == "file.remove":
                if set(payload.keys()) != {"fileId"}:
                    raise InvalidPayloadError("payload must have only fileId")

                file_id = payload.get("fileId")
                if not isinstance(file_id, str) or not file_id.strip():
                    raise InvalidPayloadError("payload.fileId must be a non-empty string")

                files_state = state.get("files")
                files_list = list(files_state) if isinstance(files_state, list) else []
                state["files"] = [
                    f
                    for f in files_list
                    if not (isinstance(f, dict) and f.get("id") == file_id)
                ]

                return component.model_copy(update={"state": state, "revision": revision + 1})

            if event_name == "file.submit":
                if payload:
                    raise InvalidPayloadError("payload must be empty")
                state["status"] = "submitted"
                return component.model_copy(update={"state": state, "revision": revision + 1})

            raise InvalidPayloadError(f"unsupported FileUploadCard eventName: {event_name}")

        raise InvalidPayloadError(f"unsupported component type: {component.type}")


def _encode_pointer(token: str) -> str:
    return token.replace("~", "~0").replace("/", "~1")
