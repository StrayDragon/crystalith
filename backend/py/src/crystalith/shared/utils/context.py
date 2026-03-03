"""Context formatting utilities."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from crystalith.shared.db import Chunk, Source
    from crystalith.shared.vector_storage import VectorSearchResult


def format_context(
    results: Sequence[VectorSearchResult],
    chunk_map: Mapping[int, tuple[Chunk, Source]],
) -> str:
    """Format vector search results into context string with citations."""
    blocks: list[str] = []
    for index, result in enumerate(results, start=1):
        chunk, source = chunk_map[result.entry.chunk_id]
        blocks.append(
            f"[{index}] Source: {source.filename} (chunk {chunk.chunk_index})\n{chunk.text}"
        )
    return "\n\n".join(blocks)


def format_context_from_chunk_ids(
    chunk_ids: Sequence[int],
    chunk_map: Mapping[int, tuple[Chunk, Source]],
) -> str:
    """Format chunk IDs into context string with citations."""
    blocks: list[str] = []
    for index, chunk_id in enumerate(chunk_ids, start=1):
        chunk, source = chunk_map[chunk_id]
        blocks.append(
            f"[{index}] Source: {source.filename} (chunk {chunk.chunk_index})\n{chunk.text}"
        )
    return "\n\n".join(blocks)
