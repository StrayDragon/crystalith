from __future__ import annotations

from collections.abc import Sequence
from math import sqrt

from crystalith.shared.vector_storage import VectorEntry

from .types import Relation


def _dot(left: Sequence[float], right: Sequence[float]) -> float:
    return sum(a * b for a, b in zip(left, right))


def _norm(vector: Sequence[float]) -> float:
    return sqrt(sum(value * value for value in vector))


def detect_relations(
    entries: Sequence[VectorEntry],
    *,
    min_score: float = 0.7,
    max_relations: int = 200,
) -> list[Relation]:
    if max_relations <= 0:
        return []
    if len(entries) < 2:
        return []

    indexed = list(entries)
    norms = [_norm(entry.vector) for entry in indexed]

    relations: list[Relation] = []
    for i, left in enumerate(indexed[:-1]):
        left_norm = norms[i]
        if left_norm == 0:
            continue
        for j in range(i + 1, len(indexed)):
            right = indexed[j]
            if left.source_id == right.source_id:
                continue
            if len(left.vector) != len(right.vector):
                continue
            right_norm = norms[j]
            if right_norm == 0:
                continue
            score = _dot(left.vector, right.vector) / (left_norm * right_norm)
            if score < min_score:
                continue
            relations.append(
                Relation(
                    source_chunk_id=left.chunk_id,
                    target_chunk_id=right.chunk_id,
                    relation_type="similar",
                    score=score,
                )
            )

    relations.sort(key=lambda item: item.score, reverse=True)
    return relations[:max_relations]
