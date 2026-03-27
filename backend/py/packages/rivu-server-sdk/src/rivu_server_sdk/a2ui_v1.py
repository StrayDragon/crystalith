from __future__ import annotations

import json
from collections.abc import Mapping
from typing import Any, Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, PositiveInt, model_validator

from .limits import (
    LimitExceededError,
    UiInputLimitsV1,
    compute_max_depth,
    compute_max_string_length_utf8,
    estimate_json_utf8_size,
)


class A2uiMountV1(BaseModel):
    model_config = ConfigDict(extra="allow")

    messageId: str = Field(min_length=1)
    slot: str = Field(min_length=1)
    order: int | None = None

    @model_validator(mode="after")
    def _validate_trimmed(self) -> "A2uiMountV1":
        if not self.messageId.strip():
            raise ValueError("mount.messageId must be non-empty")
        if not self.slot.strip():
            raise ValueError("mount.slot must be non-empty")
        return self


class A2uiCreateOpV1(BaseModel):
    model_config = ConfigDict(extra="allow")

    op: Literal["create"]
    key: str = Field(min_length=1)
    type: str = Field(min_length=1)
    schemaVersion: PositiveInt
    props: dict[str, Any]
    state: dict[str, Any] | None = None
    mount: A2uiMountV1 | None = None

    @model_validator(mode="after")
    def _validate_trimmed(self) -> "A2uiCreateOpV1":
        if not self.key.strip():
            raise ValueError("op.key must be non-empty")
        if not self.type.strip():
            raise ValueError("op.type must be non-empty")
        return self


class A2uiUpdateOpV1(BaseModel):
    model_config = ConfigDict(extra="allow")

    op: Literal["update"]
    key: str = Field(min_length=1)
    props: dict[str, Any] | None = None
    state: dict[str, Any] | None = None

    @model_validator(mode="after")
    def _validate_update(self) -> "A2uiUpdateOpV1":
        if not self.key.strip():
            raise ValueError("op.key must be non-empty")
        if self.props is None and self.state is None:
            raise ValueError("update op must include props and/or state")
        return self


class A2uiMountOpV1(BaseModel):
    model_config = ConfigDict(extra="allow")

    op: Literal["mount"]
    key: str = Field(min_length=1)
    messageId: str = Field(min_length=1)
    slot: str = Field(min_length=1)
    order: int | None = None

    @model_validator(mode="after")
    def _validate_trimmed(self) -> "A2uiMountOpV1":
        if not self.key.strip():
            raise ValueError("op.key must be non-empty")
        if not self.messageId.strip():
            raise ValueError("mount op.messageId must be non-empty")
        if not self.slot.strip():
            raise ValueError("mount op.slot must be non-empty")
        return self


class A2uiUnmountOpV1(BaseModel):
    model_config = ConfigDict(extra="allow")

    op: Literal["unmount"]
    key: str = Field(min_length=1)
    messageId: str = Field(min_length=1)
    slot: str = Field(min_length=1)

    @model_validator(mode="after")
    def _validate_trimmed(self) -> "A2uiUnmountOpV1":
        if not self.key.strip():
            raise ValueError("op.key must be non-empty")
        if not self.messageId.strip():
            raise ValueError("unmount op.messageId must be non-empty")
        if not self.slot.strip():
            raise ValueError("unmount op.slot must be non-empty")
        return self


class A2uiRemoveOpV1(BaseModel):
    model_config = ConfigDict(extra="allow")

    op: Literal["remove"]
    key: str = Field(min_length=1)

    @model_validator(mode="after")
    def _validate_trimmed(self) -> "A2uiRemoveOpV1":
        if not self.key.strip():
            raise ValueError("op.key must be non-empty")
        return self


A2uiOpV1 = Annotated[
    Union[A2uiCreateOpV1, A2uiUpdateOpV1, A2uiMountOpV1, A2uiUnmountOpV1, A2uiRemoveOpV1],
    Field(discriminator="op"),
]


class A2uiV1(BaseModel):
    model_config = ConfigDict(extra="allow")

    v: Literal[1]
    ops: list[A2uiOpV1]


def decode_a2ui_v1_with_limits_v1(data: Any, *, limits: UiInputLimitsV1) -> A2uiV1:
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

    return A2uiV1.model_validate(obj)
