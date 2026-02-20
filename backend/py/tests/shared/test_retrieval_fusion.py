from __future__ import annotations

from crystalith.shared.retrieval.context import _merge_search_results_rrf
from crystalith.shared.vector_storage.types import VectorEntry, VectorSearchResult


def _result(chunk_id: int, score: float, *, source_id: int = 1) -> VectorSearchResult:
    return VectorSearchResult(
        entry=VectorEntry(notebook_id=1, source_id=source_id, chunk_id=int(chunk_id), vector=[]),
        score=float(score),
    )


def test_merge_search_results_rrf_rewards_cross_query_consensus() -> None:
    group1 = [
        _result(1, 0.90),
        _result(2, 0.85),
        _result(3, 0.84),
    ]
    group2 = [
        _result(2, 0.88),
        _result(3, 0.87),
        _result(4, 0.86),
    ]

    merged = _merge_search_results_rrf([group1, group2], rrf_k=60)
    assert [item.entry.chunk_id for item in merged[:4]] == [2, 3, 1, 4]
    assert merged[0].score == 0.88
