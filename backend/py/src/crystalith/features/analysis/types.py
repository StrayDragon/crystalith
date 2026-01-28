from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

RelationType = Literal["similar", "references", "contradicts"]


class Topic(BaseModel):
    id: str
    name: str
    chunk_ids: list[int]
    keywords: list[str]


class Relation(BaseModel):
    source_chunk_id: int
    target_chunk_id: int
    relation_type: RelationType
    score: float


class AnalysisResult(BaseModel):
    topics: list[Topic]
    relations: list[Relation]
    contradictions: list[Relation]
