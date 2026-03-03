from __future__ import annotations

from crystalith.shared.db import Chunk, Source
from crystalith.shared.types import SourceStatus
from crystalith.shared.utils.context import format_context, format_context_from_chunk_ids
from crystalith.shared.vector_storage import VectorEntry, VectorSearchResult


def test_format_context_formats_results_with_1_based_citations() -> None:
    source_a = Source(notebook_id=1, filename="a.txt", mime_type=None, parser_type="text", status=SourceStatus.READY)
    source_b = Source(notebook_id=1, filename="b.txt", mime_type=None, parser_type="text", status=SourceStatus.READY)

    chunk_a = Chunk(source_id=1, chunk_index=0, text="chunk-a", metadata_=None)
    chunk_b = Chunk(source_id=2, chunk_index=1, text="chunk-b", metadata_=None)

    chunk_map = {
        10: (chunk_a, source_a),
        11: (chunk_b, source_b),
    }
    results = [
        VectorSearchResult(entry=VectorEntry(notebook_id=1, source_id=2, chunk_id=11, vector=[]), score=0.9),
        VectorSearchResult(entry=VectorEntry(notebook_id=1, source_id=1, chunk_id=10, vector=[]), score=0.8),
    ]

    formatted = format_context(results, chunk_map)
    assert formatted.startswith("[1] Source: b.txt (chunk 1)\nchunk-b")
    assert "\n\n[2] Source: a.txt (chunk 0)\nchunk-a" in formatted


def test_format_context_from_chunk_ids_formats_blocks_with_1_based_citations() -> None:
    source_a = Source(notebook_id=1, filename="a.txt", mime_type=None, parser_type="text", status=SourceStatus.READY)
    source_b = Source(notebook_id=1, filename="b.txt", mime_type=None, parser_type="text", status=SourceStatus.READY)

    chunk_a = Chunk(source_id=1, chunk_index=0, text="chunk-a", metadata_=None)
    chunk_b = Chunk(source_id=2, chunk_index=1, text="chunk-b", metadata_=None)

    chunk_map = {
        10: (chunk_a, source_a),
        11: (chunk_b, source_b),
    }

    formatted = format_context_from_chunk_ids([10, 11], chunk_map)
    assert formatted.startswith("[1] Source: a.txt (chunk 0)\nchunk-a")
    assert "\n\n[2] Source: b.txt (chunk 1)\nchunk-b" in formatted
