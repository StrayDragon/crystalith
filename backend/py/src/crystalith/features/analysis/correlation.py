from __future__ import annotations

from collections.abc import Sequence

from crystalith.shared.vector_storage import VectorEntry, VectorStore

from .types import Relation


async def detect_relations(
    entries: Sequence[VectorEntry],
    *,
    notebook_id: int,
    vector_store: VectorStore,
    min_score: float = 0.7,
    max_relations: int = 200,
    top_k: int = 20,
) -> list[Relation]:
    if max_relations <= 0:
        return []
    if top_k <= 0:
        return []
    if len(entries) < 2:
        return []

    entries_by_chunk: dict[int, VectorEntry] = {entry.chunk_id: entry for entry in entries}
    relations_map: dict[tuple[int, int], Relation] = {}

    for entry in entries:
        results = await vector_store.search(
            notebook_id=notebook_id,
            query_vector=entry.vector,
            top_k=top_k,
            min_score=min_score,
            exclude_source_ids=[entry.source_id],
        )

        for result in results:
            target = entries_by_chunk.get(result.entry.chunk_id)
            if target is None:
                continue
            if target.source_id == entry.source_id:
                continue
            if result.score < min_score:
                continue

            left_chunk_id = entry.chunk_id
            right_chunk_id = target.chunk_id
            relation_key = (
                min(left_chunk_id, right_chunk_id),
                max(left_chunk_id, right_chunk_id),
            )

            current = relations_map.get(relation_key)
            if current is not None and current.score >= result.score:
                continue

            relations_map[relation_key] = Relation(
                source_chunk_id=left_chunk_id,
                target_chunk_id=right_chunk_id,
                relation_type="similar",
                score=result.score,
            )

    relations = sorted(relations_map.values(), key=lambda item: item.score, reverse=True)
    return relations[:max_relations]
