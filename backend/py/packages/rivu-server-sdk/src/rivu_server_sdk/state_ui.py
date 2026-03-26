from __future__ import annotations

import math
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, NonNegativeInt, PositiveInt, model_validator


class UiMountV1(BaseModel):
    model_config = ConfigDict(extra="forbid")

    messageId: str = Field(min_length=1)
    slot: str = Field(min_length=1)
    order: int


class UiComponentErrorV1(BaseModel):
    model_config = ConfigDict(extra="allow")

    code: str = Field(min_length=1)
    message: str = Field(min_length=1)
    details: dict[str, Any] | None = None


class UiComponentV1(BaseModel):
    model_config = ConfigDict(extra="allow")

    type: str = Field(min_length=1)
    schemaVersion: PositiveInt
    props: dict[str, Any]
    state: dict[str, Any] | None = None
    revision: NonNegativeInt
    mounts: list[UiMountV1]
    status: Literal["building", "ready", "error"] | None = None
    error: UiComponentErrorV1 | None = None

    @model_validator(mode="after")
    def _validate_lifecycle(self) -> "UiComponentV1":
        status = self.status or "ready"
        if status == "error":
            if self.error is None:
                raise ValueError("component.error must be set when status=error")
            return self
        if self.error is not None:
            raise ValueError("component.error must be omitted unless status=error")
        return self


class UiDatasetV1(BaseModel):
    model_config = ConfigDict(extra="allow")

    columns: list[str] = Field(min_length=1)
    rows: list[list[Any]]

    @model_validator(mode="after")
    def _validate_shape(self) -> "UiDatasetV1":
        for col in self.columns:
            if not isinstance(col, str) or not col:
                raise ValueError("dataset.columns[*] must be a non-empty string")

        width = len(self.columns)
        for row in self.rows:
            if not isinstance(row, list):
                raise ValueError("dataset.rows[*] must be an array")
            if len(row) != width:
                raise ValueError("dataset.rows[i] length must match columns length")
            for cell in row:
                if cell is None:
                    continue
                if isinstance(cell, bool):
                    raise ValueError("dataset.rows[*][*] must be string|number|null")
                if isinstance(cell, (int, float)):
                    if not math.isfinite(float(cell)):
                        raise ValueError("dataset.rows[*][*] number must be finite")
                    continue
                if isinstance(cell, str):
                    continue
                raise ValueError("dataset.rows[*][*] must be string|number|null")
        return self


class UiDataRefV1(BaseModel):
    model_config = ConfigDict(extra="forbid")

    datasetId: str = Field(min_length=1)

    @model_validator(mode="after")
    def _validate_dataset_id(self) -> "UiDataRefV1":
        if not self.datasetId.strip():
            raise ValueError("dataRef.datasetId must be non-empty")
        return self


class UiStateV1(BaseModel):
    model_config = ConfigDict(extra="allow")

    v: Literal[1]
    components: dict[str, UiComponentV1]
    datasets: dict[str, UiDatasetV1] | None = None

    @model_validator(mode="after")
    def _validate_component_ids(self) -> "UiStateV1":
        for component_id in self.components.keys():
            if not component_id.strip():
                raise ValueError("componentId must be non-empty")
        for dataset_id in (self.datasets or {}).keys():
            if not dataset_id.strip():
                raise ValueError("datasetId must be non-empty")
        return self
