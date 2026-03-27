from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .state_ui import UiDataRefV1, UiDatasetV1

PivotTableAggV1 = Literal["sum", "count", "avg", "min", "max"]


class PivotTableOptionsV1(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1)
    unit: str | None = Field(default=None, min_length=1)
    showTotals: bool | None = None


class PivotTablePropsV1(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dataRef: UiDataRefV1 | None = None
    data: UiDatasetV1 | None = None
    rows: list[str] = Field(min_length=1)
    columns: str = Field(min_length=1)
    value: str = Field(min_length=1)
    agg: PivotTableAggV1
    options: PivotTableOptionsV1 | None = None

    @model_validator(mode="after")
    def _validate_sources_and_columns(self) -> "PivotTablePropsV1":
        if self.dataRef is None and self.data is None:
            raise ValueError("either dataRef or data must be set")

        for name in self.rows:
            if not isinstance(name, str) or not name:
                raise ValueError("rows[*] must be a non-empty string")

        if self.data is not None:
            columns = set(self.data.columns)
            referenced = [*self.rows, self.columns, self.value]
            missing = [c for c in referenced if c not in columns]
            if missing:
                raise ValueError(f"referenced columns missing from data.columns: {missing}")

        return self


class HeatmapEncodingV1(BaseModel):
    model_config = ConfigDict(extra="forbid")

    x: str = Field(min_length=1)
    y: str = Field(min_length=1)
    value: str = Field(min_length=1)


class HeatmapOptionsV1(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1)
    unit: str | None = Field(default=None, min_length=1)
    height: int | None = Field(default=None, ge=1, le=2000)


class HeatmapPropsV1(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dataRef: UiDataRefV1 | None = None
    data: UiDatasetV1 | None = None
    encoding: HeatmapEncodingV1
    options: HeatmapOptionsV1 | None = None

    @model_validator(mode="after")
    def _validate_sources_and_encoding(self) -> "HeatmapPropsV1":
        if self.dataRef is None and self.data is None:
            raise ValueError("either dataRef or data must be set")

        if self.data is None:
            return self

        columns = set(self.data.columns)
        missing = [c for c in [self.encoding.x, self.encoding.y, self.encoding.value] if c not in columns]
        if missing:
            raise ValueError(f"encoding columns missing from data.columns: {missing}")

        value_index = self.data.columns.index(self.encoding.value)
        for row in self.data.rows:
            cell = row[value_index] if value_index < len(row) else None
            if cell is None:
                continue
            if isinstance(cell, (int, float)):
                continue
            raise ValueError("encoding.value column must be number|null when using inline data")

        return self
