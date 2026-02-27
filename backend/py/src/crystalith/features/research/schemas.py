from __future__ import annotations

import datetime

from pydantic import BaseModel, ConfigDict

from crystalith.shared.json_types import JsonDict
from crystalith.shared.types import ResearchStatus


class ResearchSessionCreate(BaseModel):
    topic: str


class ResearchSessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    notebook_id: int
    topic: str
    status: ResearchStatus
    current_iteration: int
    max_iterations: int
    aggregated_results: list[JsonDict] | None
    final_report: str | None
    created_at: datetime.datetime
    updated_at: datetime.datetime
