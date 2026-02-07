from __future__ import annotations

from math import sqrt

import pytest

from crystalith.features.analysis.correlation import detect_relations
from crystalith.shared.vector_storage import InMemoryVectorStore, VectorEntry


def _cosine(left: list[float], right: list[float]) -> float:
    dot = sum(a * b for a, b in zip(left, right))
    left_norm = sqrt(sum(item * item for item in left))
    right_norm = sqrt(sum(item * item for item in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return dot / (left_norm * right_norm)


def _bruteforce_pairs(entries: list[VectorEntry], *, min_score: float) -> set[tuple[int, int]]:
    pairs: set[tuple[int, int]] = set()
    for index, left in enumerate(entries):
        for right in entries[index + 1 :]:
            if left.source_id == right.source_id:
                continue
            score = _cosine(left.vector, right.vector)
            if score < min_score:
                continue
            pairs.add(tuple(sorted((left.chunk_id, right.chunk_id))))
    return pairs


@pytest.mark.asyncio
async def test_detect_relations_excludes_same_source() -> None:
    store = InMemoryVectorStore()

    await store.add(
        notebook_id=1,
        source_id=1,
        chunk_ids=[11, 12],
        vectors=[[1.0, 0.0], [0.9, 0.1]],
    )
    await store.add(
        notebook_id=1,
        source_id=2,
        chunk_ids=[21],
        vectors=[[1.0, 0.0]],
    )

    entries = [
        VectorEntry(notebook_id=1, source_id=1, chunk_id=11, vector=[1.0, 0.0]),
        VectorEntry(notebook_id=1, source_id=1, chunk_id=12, vector=[0.9, 0.1]),
        VectorEntry(notebook_id=1, source_id=2, chunk_id=21, vector=[1.0, 0.0]),
    ]

    relations = await detect_relations(
        entries,
        notebook_id=1,
        vector_store=store,
        min_score=0.7,
        top_k=5,
    )

    assert relations
    pair_set = {
        tuple(sorted((relation.source_chunk_id, relation.target_chunk_id)))
        for relation in relations
    }
    assert (11, 12) not in pair_set
    assert (11, 21) in pair_set or (12, 21) in pair_set


@pytest.mark.asyncio
async def test_detect_relations_overlap_with_bruteforce_is_high() -> None:
    store = InMemoryVectorStore()

    entries = [
        VectorEntry(notebook_id=1, source_id=1, chunk_id=11, vector=[1.0, 0.0]),
        VectorEntry(notebook_id=1, source_id=1, chunk_id=12, vector=[0.0, 1.0]),
        VectorEntry(notebook_id=1, source_id=2, chunk_id=21, vector=[0.95, 0.05]),
        VectorEntry(notebook_id=1, source_id=2, chunk_id=22, vector=[0.1, 0.95]),
        VectorEntry(notebook_id=1, source_id=3, chunk_id=31, vector=[0.9, 0.1]),
        VectorEntry(notebook_id=1, source_id=3, chunk_id=32, vector=[0.05, 0.9]),
    ]

    for source_id in {entry.source_id for entry in entries}:
        source_entries = [entry for entry in entries if entry.source_id == source_id]
        await store.add(
            notebook_id=1,
            source_id=source_id,
            chunk_ids=[entry.chunk_id for entry in source_entries],
            vectors=[entry.vector for entry in source_entries],
        )

    min_score = 0.9
    relations = await detect_relations(
        entries,
        notebook_id=1,
        vector_store=store,
        min_score=min_score,
        top_k=10,
        max_relations=100,
    )

    ann_pairs = {
        tuple(sorted((relation.source_chunk_id, relation.target_chunk_id)))
        for relation in relations
    }
    brute_pairs = _bruteforce_pairs(entries, min_score=min_score)

    assert brute_pairs
    overlap_ratio = len(ann_pairs & brute_pairs) / len(brute_pairs)
    assert overlap_ratio >= 0.9
