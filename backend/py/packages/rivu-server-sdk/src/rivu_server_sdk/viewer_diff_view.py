from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

DiffViewModeV1 = Literal["unified", "split"]


class DiffViewLimitsV1(BaseModel):
    model_config = ConfigDict(extra="forbid")

    maxChars: int | None = Field(default=None, ge=1)
    maxLines: int | None = Field(default=None, ge=1)


class DiffViewPropsV1(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1)
    beforeLabel: str | None = Field(default=None, min_length=1)
    afterLabel: str | None = Field(default=None, min_length=1)
    before: str
    after: str
    mode: DiffViewModeV1 | None = None
    limits: DiffViewLimitsV1 | None = None
