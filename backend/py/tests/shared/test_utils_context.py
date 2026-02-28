from __future__ import annotations

from types import SimpleNamespace

from crystalith.shared.utils.context import format_context, format_context_from_chunk_ids


def test_format_context_formats_results_with_1_based_citations() -> None:
    chunk_map = {
        10: (SimpleNamespace(chunk_index=0, text="chunk-a"), SimpleNamespace(filename="a.txt")),
        11: (SimpleNamespace(chunk_index=1, text="chunk-b"), SimpleNamespace(filename="b.txt")),
    }
    results = [
        SimpleNamespace(entry=SimpleNamespace(chunk_id=11)),
        SimpleNamespace(entry=SimpleNamespace(chunk_id=10)),
    ]

    formatted = format_context(results, chunk_map)
    assert formatted.startswith("[1] Source: b.txt (chunk 1)\nchunk-b")
    assert "\n\n[2] Source: a.txt (chunk 0)\nchunk-a" in formatted


def test_format_context_from_chunk_ids_formats_blocks_with_1_based_citations() -> None:
    chunk_map = {
        10: (SimpleNamespace(chunk_index=0, text="chunk-a"), SimpleNamespace(filename="a.txt")),
        11: (SimpleNamespace(chunk_index=1, text="chunk-b"), SimpleNamespace(filename="b.txt")),
    }

    formatted = format_context_from_chunk_ids([10, 11], chunk_map)
    assert formatted.startswith("[1] Source: a.txt (chunk 0)\nchunk-a")
    assert "\n\n[2] Source: b.txt (chunk 1)\nchunk-b" in formatted
