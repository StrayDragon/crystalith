from __future__ import annotations

import json
from collections.abc import Mapping
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt, StrictStr, model_validator

from .limits import (
    LimitExceededError,
    UiInputLimitsV1,
    compute_max_depth,
    compute_max_string_length_utf8,
    estimate_json_utf8_size,
)

UI_V1_CAPABILITIES_NAME = "ui.v1.capabilities"


class UiV1CapabilitiesComponentRangeV1(BaseModel):
    model_config = ConfigDict(extra="forbid")

    minSchemaVersion: StrictInt = Field(ge=1)
    maxSchemaVersion: StrictInt = Field(ge=1)

    @model_validator(mode="after")
    def _validate_range(self) -> "UiV1CapabilitiesComponentRangeV1":
        if self.maxSchemaVersion < self.minSchemaVersion:
            raise ValueError("maxSchemaVersion must be >= minSchemaVersion")
        return self


class UiV1CapabilitiesChartFeaturesV1(BaseModel):
    model_config = ConfigDict(extra="allow")

    marks: list[StrictStr] | None = None
    interactions: list[StrictStr] | None = None


class UiV1CapabilitiesExportFeaturesV1(BaseModel):
    model_config = ConfigDict(extra="allow")

    formats: list[StrictStr] | None = None


class UiV1CapabilitiesFeaturesV1(BaseModel):
    model_config = ConfigDict(extra="allow")

    datasets: StrictBool | None = None
    lifecycle: StrictBool | None = None
    chart: UiV1CapabilitiesChartFeaturesV1 | None = None
    export: UiV1CapabilitiesExportFeaturesV1 | None = None


class UiV1CapabilitiesValueV1(BaseModel):
    model_config = ConfigDict(extra="allow")

    v: Literal[1]
    components: dict[StrictStr, UiV1CapabilitiesComponentRangeV1]
    features: UiV1CapabilitiesFeaturesV1 | None = None
    client: dict[str, Any] | None = None

    @model_validator(mode="after")
    def _validate_component_types(self) -> "UiV1CapabilitiesValueV1":
        for component_type in self.components.keys():
            if not str(component_type).strip():
                raise ValueError("components keys must be non-empty")
        return self


class UiV1CapabilitiesCustomEvent(BaseModel):
    model_config = ConfigDict(extra="allow")

    type: Literal["CUSTOM"]
    name: Literal["ui.v1.capabilities"]
    value: UiV1CapabilitiesValueV1

    timestamp: float | None = None
    rawEvent: Any | None = None


def decode_ui_v1_capabilities_with_limits_v1(data: Any, *, limits: UiInputLimitsV1) -> UiV1CapabilitiesCustomEvent:
    decode = limits.get("decode", {})
    if not isinstance(decode, Mapping):
        decode = {}

    max_bytes = decode.get("maxBytes")
    max_depth = decode.get("maxDepth")
    max_string_length = decode.get("maxStringLength")

    obj: Any
    if isinstance(data, (bytes, bytearray)):
        raw_bytes = bytes(data)
        observed = len(raw_bytes)
        if max_bytes is not None and observed > max_bytes:
            raise LimitExceededError(limit="decode.maxBytes", max=max_bytes, observed=observed)
        obj = json.loads(raw_bytes)
    elif isinstance(data, str):
        observed = len(data.encode("utf-8"))
        if max_bytes is not None and observed > max_bytes:
            raise LimitExceededError(limit="decode.maxBytes", max=max_bytes, observed=observed)
        obj = json.loads(data)
    else:
        if max_bytes is not None:
            observed = estimate_json_utf8_size(data)
            if observed > max_bytes:
                raise LimitExceededError(limit="decode.maxBytes", max=max_bytes, observed=observed)
        obj = data

    if max_depth is not None:
        observed = compute_max_depth(obj)
        if observed > max_depth:
            raise LimitExceededError(limit="decode.maxDepth", max=max_depth, observed=observed)

    if max_string_length is not None:
        observed = compute_max_string_length_utf8(obj)
        if observed > max_string_length:
            raise LimitExceededError(limit="decode.maxStringLength", max=max_string_length, observed=observed)

    return UiV1CapabilitiesCustomEvent.model_validate(obj)


def is_supported(*, capabilities: UiV1CapabilitiesValueV1, component_type: str, schema_version: int) -> bool:
    rng = capabilities.components.get(component_type)
    if rng is None:
        return False
    return int(rng.minSchemaVersion) <= int(schema_version) <= int(rng.maxSchemaVersion)


def choose_compatible(
    *,
    capabilities: UiV1CapabilitiesValueV1,
    candidates: list[tuple[str, int]],
) -> tuple[str, int] | None:
    # Pick the highest supported schemaVersion per componentType, then choose
    # the earliest componentType in the candidate list (stable fallback ordering).
    best_version: dict[str, int] = {}
    first_index: dict[str, int] = {}

    for idx, (component_type, schema_version) in enumerate(candidates):
        if not is_supported(capabilities=capabilities, component_type=component_type, schema_version=schema_version):
            continue
        best_version[component_type] = max(best_version.get(component_type, schema_version), schema_version)
        first_index[component_type] = min(first_index.get(component_type, idx), idx)

    if not best_version:
        return None

    chosen_type = min(best_version.keys(), key=lambda t: first_index[t])
    return (chosen_type, best_version[chosen_type])


def choose_viewer_chart_component_v1(*, capabilities: UiV1CapabilitiesValueV1, mark: str) -> tuple[str, int] | None:
    # Prefer Chart when both the component and the mark are supported; otherwise
    # fall back to compatibility components for bar/line.
    supported_marks: list[str] | None = None
    chart_features = capabilities.features.chart if capabilities.features else None
    if chart_features and chart_features.marks:
        supported_marks = [str(m) for m in chart_features.marks]

    chart_ok = is_supported(capabilities=capabilities, component_type="Chart", schema_version=1) and (
        supported_marks is not None and mark in supported_marks
    )

    candidates: list[tuple[str, int]] = [("Chart", 1)] if chart_ok else []

    if mark == "bar":
        candidates.append(("BarChart", 1))
    elif mark == "line":
        candidates.append(("LineChart", 1))

    return choose_compatible(capabilities=capabilities, candidates=candidates)
