from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class Citation(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    source_id: int
    source_name: str
    chunk_id: int
    chunk_index: int
    page_number: int | None = None
    paragraph_index: int | None = None
    snippet: str
    score: float | None = None
