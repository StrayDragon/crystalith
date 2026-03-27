from __future__ import annotations

from typing import Any, TypedDict


class JsonPatchOp(TypedDict, total=False):
    op: str
    path: str
    value: Any


def _encode_pointer(token: str) -> str:
    return token.replace("~", "~0").replace("/", "~1")


def data_ref_v1(*, dataset_id: str) -> dict[str, str]:
    if not dataset_id.strip():
        raise ValueError("dataRef.datasetId must be non-empty")
    return {"datasetId": dataset_id}


def set_dataset_v1(*, shared_state: dict[str, Any], dataset_id: str, dataset: dict[str, Any]) -> list[JsonPatchOp]:
    if not dataset_id.strip():
        raise ValueError("datasetId must be non-empty")

    ui_raw = shared_state.get("ui")
    datasets_raw: Any = None
    if isinstance(ui_raw, dict):
        datasets_raw = ui_raw.get("datasets")

    if not isinstance(datasets_raw, dict):
        return [
            {
                "op": "add",
                "path": "/ui/datasets",
                "value": {dataset_id: dataset},
            }
        ]

    return [
        {
            "op": "add",
            "path": f"/ui/datasets/{_encode_pointer(dataset_id)}",
            "value": dataset,
        }
    ]


def delete_dataset_v1(*, shared_state: dict[str, Any], dataset_id: str) -> list[JsonPatchOp]:
    if not dataset_id.strip():
        raise ValueError("datasetId must be non-empty")

    ui_raw = shared_state.get("ui")
    if not isinstance(ui_raw, dict):
        return []
    datasets_raw = ui_raw.get("datasets")
    if not isinstance(datasets_raw, dict):
        return []
    if dataset_id not in datasets_raw:
        return []

    next_datasets = {k: v for k, v in datasets_raw.items() if k != dataset_id}

    return [
        {
            "op": "replace",
            "path": "/ui/datasets",
            "value": next_datasets,
        }
    ]


def mount_component_v1(*, component_id: str, message_id: str, slot: str, order: int) -> list[JsonPatchOp]:
    return [
        {
            "op": "add",
            "path": f"/ui/components/{_encode_pointer(component_id)}/mounts/-",
            "value": {"messageId": message_id, "slot": slot, "order": order},
        }
    ]


def set_component_v1(*, component_id: str, component: dict[str, Any]) -> list[JsonPatchOp]:
    return [
        {
            "op": "add",
            "path": f"/ui/components/{_encode_pointer(component_id)}",
            "value": component,
        }
    ]


def delete_component_v1(*, shared_state: dict[str, Any], component_id: str) -> list[JsonPatchOp]:
    if not component_id.strip():
        raise ValueError("componentId must be non-empty")

    ui_raw = shared_state.get("ui")
    if not isinstance(ui_raw, dict):
        return []
    components_raw = ui_raw.get("components")
    if not isinstance(components_raw, dict):
        return []
    if component_id not in components_raw:
        return []

    next_components = {k: v for k, v in components_raw.items() if k != component_id}

    return [
        {
            "op": "replace",
            "path": "/ui/components",
            "value": next_components,
        }
    ]


def unmount_component_v1(*, shared_state: dict[str, Any], component_id: str, message_id: str, slot: str) -> list[JsonPatchOp]:
    ui_raw = shared_state.get("ui")
    if not isinstance(ui_raw, dict):
        return []
    components_raw = ui_raw.get("components")
    if not isinstance(components_raw, dict):
        return []
    component_raw = components_raw.get(component_id)
    if not isinstance(component_raw, dict):
        return []
    mounts_raw = component_raw.get("mounts")
    if not isinstance(mounts_raw, list):
        return []

    next_mounts: list[dict[str, Any]] = []
    for m in mounts_raw:
        if not isinstance(m, dict):
            continue
        if m.get("messageId") == message_id and m.get("slot") == slot:
            continue
        next_mounts.append(m)

    return [
        {
            "op": "replace",
            "path": f"/ui/components/{_encode_pointer(component_id)}/mounts",
            "value": next_mounts,
        }
    ]


def set_component_props_v1(*, component_id: str, props: dict[str, Any]) -> list[JsonPatchOp]:
    return [
        {
            "op": "add",
            "path": f"/ui/components/{_encode_pointer(component_id)}/props",
            "value": props,
        }
    ]


def set_component_state_v1(*, component_id: str, state: dict[str, Any]) -> list[JsonPatchOp]:
    return [
        {
            "op": "add",
            "path": f"/ui/components/{_encode_pointer(component_id)}/state",
            "value": state,
        }
    ]


def increment_component_revision_v1(*, component_id: str, current_revision: int) -> list[JsonPatchOp]:
    next_revision = current_revision + 1
    return [
        {
            "op": "replace",
            "path": f"/ui/components/{_encode_pointer(component_id)}/revision",
            "value": next_revision,
        }
    ]
