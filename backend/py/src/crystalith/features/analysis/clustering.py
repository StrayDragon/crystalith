from __future__ import annotations

import re
from collections import Counter
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from math import sqrt

from crystalith.shared.vector_storage import VectorEntry

from .types import Topic

_STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "but",
    "by",
    "for",
    "from",
    "has",
    "have",
    "he",
    "her",
    "his",
    "if",
    "in",
    "into",
    "is",
    "it",
    "its",
    "may",
    "not",
    "of",
    "on",
    "or",
    "our",
    "she",
    "that",
    "the",
    "their",
    "them",
    "there",
    "this",
    "to",
    "was",
    "were",
    "will",
    "with",
    "you",
    "your",
}


@dataclass
class _Cluster:
    sum_vector: list[float]
    chunk_ids: list[int]

    @property
    def count(self) -> int:
        return len(self.chunk_ids)

    def centroid(self) -> list[float]:
        if not self.sum_vector or self.count == 0:
            return []
        return [value / self.count for value in self.sum_vector]

    def add(self, vector: Sequence[float], chunk_id: int) -> None:
        if not self.sum_vector:
            self.sum_vector = list(vector)
        else:
            for index, value in enumerate(vector):
                self.sum_vector[index] += value
        self.chunk_ids.append(chunk_id)


def _dot(left: Sequence[float], right: Sequence[float]) -> float:
    return sum(a * b for a, b in zip(left, right))


def _norm(vector: Sequence[float]) -> float:
    return sqrt(sum(value * value for value in vector))


def _cosine_similarity(left: Sequence[float], right: Sequence[float]) -> float:
    left_norm = _norm(left)
    right_norm = _norm(right)
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return _dot(left, right) / (left_norm * right_norm)


def _extract_keywords(texts: Sequence[str], *, max_keywords: int) -> list[str]:
    tokens: list[str] = []
    for text in texts:
        for raw in re.split(r"[^A-Za-z0-9]+", text.lower()):
            cleaned = raw.strip()
            if len(cleaned) < 3:
                continue
            if cleaned in _STOPWORDS:
                continue
            tokens.append(cleaned)
    if not tokens:
        return []
    counter = Counter(tokens)
    return [token for token, _ in counter.most_common(max_keywords)]


def _topic_name(keywords: Sequence[str], fallback_index: int) -> str:
    if keywords:
        return " / ".join(keywords[:3])
    return f"Topic {fallback_index}"


def cluster_topics(
    entries: Sequence[VectorEntry],
    chunk_texts: Mapping[int, str],
    *,
    min_similarity: float = 0.7,
    max_topics: int = 10,
    max_keywords: int = 6,
) -> list[Topic]:
    if max_topics <= 0 or not entries:
        return []

    sorted_entries = sorted(entries, key=lambda entry: entry.chunk_id)
    clusters: list[_Cluster] = []

    for entry in sorted_entries:
        if not clusters:
            cluster = _Cluster(sum_vector=[], chunk_ids=[])
            cluster.add(entry.vector, entry.chunk_id)
            clusters.append(cluster)
            continue

        best_index = 0
        best_score = -1.0
        for index, cluster in enumerate(clusters):
            centroid = cluster.centroid()
            if len(centroid) != len(entry.vector):
                continue
            score = _cosine_similarity(entry.vector, centroid)
            if score > best_score:
                best_score = score
                best_index = index

        if best_score >= min_similarity or len(clusters) >= max_topics:
            clusters[best_index].add(entry.vector, entry.chunk_id)
        else:
            cluster = _Cluster(sum_vector=[], chunk_ids=[])
            cluster.add(entry.vector, entry.chunk_id)
            clusters.append(cluster)

    topics: list[Topic] = []
    for index, cluster in enumerate(clusters, start=1):
        chunk_ids = sorted(cluster.chunk_ids)
        texts = [chunk_texts.get(chunk_id, "") for chunk_id in chunk_ids]
        keywords = _extract_keywords(texts, max_keywords=max_keywords)
        topics.append(
            Topic(
                id=f"topic-{index}",
                name=_topic_name(keywords, index),
                chunk_ids=chunk_ids,
                keywords=keywords,
            )
        )

    return topics
