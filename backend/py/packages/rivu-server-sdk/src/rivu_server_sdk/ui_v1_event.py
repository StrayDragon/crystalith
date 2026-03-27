from __future__ import annotations

import json
from collections.abc import Mapping
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, NonNegativeInt

from .limits import (
    LimitExceededError,
    UiInputLimitsV1,
    check_ui_v1_event_limits_v1,
    compute_max_depth,
    compute_max_string_length_utf8,
    estimate_json_utf8_size,
)

UI_V1_EVENT_NAME = "ui.v1.event"

def decode_ui_v1_custom_event_with_limits_v1(data: Any, *, limits: UiInputLimitsV1) -> "UiV1CustomEvent":
    decode = limits.get("decode", {})
    if not isinstance(decode, Mapping):
        decode = {}

    max_bytes = decode.get("maxBytes")
    max_depth = decode.get("maxDepth")
    max_string_length = decode.get("maxStringLength")

    event_obj: Any
    if isinstance(data, (bytes, bytearray)):
        raw_bytes = bytes(data)
        observed = len(raw_bytes)
        if max_bytes is not None and observed > max_bytes:
            raise LimitExceededError(limit="decode.maxBytes", max=max_bytes, observed=observed)
        event_obj = json.loads(raw_bytes)
    elif isinstance(data, str):
        observed = len(data.encode("utf-8"))
        if max_bytes is not None and observed > max_bytes:
            raise LimitExceededError(limit="decode.maxBytes", max=max_bytes, observed=observed)
        event_obj = json.loads(data)
    else:
        if max_bytes is not None:
            observed = estimate_json_utf8_size(data)
            if observed > max_bytes:
                raise LimitExceededError(limit="decode.maxBytes", max=max_bytes, observed=observed)
        event_obj = data

    if max_depth is not None:
        observed = compute_max_depth(event_obj)
        if observed > max_depth:
            raise LimitExceededError(limit="decode.maxDepth", max=max_depth, observed=observed)

    if max_string_length is not None:
        observed = compute_max_string_length_utf8(event_obj)
        if observed > max_string_length:
            raise LimitExceededError(limit="decode.maxStringLength", max=max_string_length, observed=observed)

    event = UiV1CustomEvent.model_validate(event_obj)
    check_ui_v1_event_limits_v1(event=event.model_dump(), limits=limits)
    return event


class UiV1EventValue(BaseModel):
    model_config = ConfigDict(extra="forbid")

    componentId: str = Field(min_length=1)
    eventName: str = Field(min_length=1)
    payload: dict[str, Any]
    clientRequestId: str = Field(min_length=1)
    baseRevision: NonNegativeInt

    @classmethod
    def parse_with_limits(
        cls,
        value: Any,
        *,
        max_bytes: int | None = None,
        max_depth: int | None = None,
    ) -> "UiV1EventValue":
        if max_bytes is not None:
            observed = estimate_json_utf8_size(value)
            if observed > max_bytes:
                raise LimitExceededError(limit="decode.maxBytes", max=max_bytes, observed=observed)
        if max_depth is not None:
            observed = compute_max_depth(value)
            if observed > max_depth:
                raise LimitExceededError(limit="decode.maxDepth", max=max_depth, observed=observed)
        return cls.model_validate(value)


class UiV1CustomEvent(BaseModel):
    # Allow passthrough meta fields (e.g. timestamp/rawEvent) and future extensions.
    model_config = ConfigDict(extra="allow")

    type: Literal["CUSTOM"]
    name: Literal["ui.v1.event"]
    value: UiV1EventValue

    timestamp: float | None = None
    rawEvent: Any | None = None

    @classmethod
    def parse_with_limits(
        cls,
        event: Any,
        *,
        max_bytes: int | None = None,
        max_depth: int | None = None,
    ) -> "UiV1CustomEvent":
        if max_bytes is not None:
            observed = estimate_json_utf8_size(event)
            if observed > max_bytes:
                raise LimitExceededError(limit="decode.maxBytes", max=max_bytes, observed=observed)
        if max_depth is not None:
            observed = compute_max_depth(event)
            if observed > max_depth:
                raise LimitExceededError(limit="decode.maxDepth", max=max_depth, observed=observed)
        return cls.model_validate(event)
