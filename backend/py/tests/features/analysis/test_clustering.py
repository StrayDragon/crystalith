from __future__ import annotations

from crystalith.features.analysis.clustering import cluster_topics
from crystalith.shared.vector_storage import VectorEntry


def test_cluster_topics_returns_empty_when_disabled_or_no_entries() -> None:
    assert cluster_topics([], {}) == []
    assert cluster_topics(
        [VectorEntry(notebook_id=1, source_id=1, chunk_id=1, vector=[1.0, 0.0])],
        {1: "text"},
        max_topics=0,
    ) == []


def test_cluster_topics_groups_similar_vectors_and_extracts_keywords() -> None:
    entries = [
        VectorEntry(notebook_id=1, source_id=1, chunk_id=1, vector=[1.0, 0.0]),
        VectorEntry(notebook_id=1, source_id=1, chunk_id=2, vector=[1.0, 0.0]),
        VectorEntry(notebook_id=1, source_id=1, chunk_id=3, vector=[1.0, 0.0]),
    ]
    chunk_texts = {
        1: "python python python",
        2: "asyncio asyncio",
        3: "concurrency",
    }

    topics = cluster_topics(entries, chunk_texts, min_similarity=0.9, max_topics=10, max_keywords=6)
    assert len(topics) == 1
    assert topics[0].chunk_ids == [1, 2, 3]
    assert topics[0].keywords[:3] == ["python", "asyncio", "concurrency"]
    assert topics[0].name == "python / asyncio / concurrency"


def test_cluster_topics_splits_dissimilar_vectors_into_separate_topics() -> None:
    entries = [
        VectorEntry(notebook_id=1, source_id=1, chunk_id=1, vector=[1.0, 0.0]),
        VectorEntry(notebook_id=1, source_id=1, chunk_id=2, vector=[0.0, 1.0]),
    ]
    topics = cluster_topics(entries, {1: "alpha", 2: "beta"}, min_similarity=0.7, max_topics=10)
    assert len(topics) == 2
    assert topics[0].chunk_ids == [1]
    assert topics[1].chunk_ids == [2]


def test_cluster_topics_handles_vector_dimension_mismatch() -> None:
    entries = [
        VectorEntry(notebook_id=1, source_id=1, chunk_id=1, vector=[1.0, 0.0]),
        VectorEntry(notebook_id=1, source_id=1, chunk_id=2, vector=[1.0, 0.0, 0.0]),
    ]
    topics = cluster_topics(entries, {1: "alpha", 2: "beta"}, min_similarity=0.7, max_topics=10)
    assert len(topics) == 2
