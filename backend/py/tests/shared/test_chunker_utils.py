from __future__ import annotations

import pytest

from crystalith.shared.utils.chunker import chunk_text


def test_chunk_text_returns_empty_for_blank_input() -> None:
    assert chunk_text("") == []
    assert chunk_text("   \n\t  ") == []


def test_chunk_text_validates_parameters() -> None:
    with pytest.raises(ValueError, match="chunk_size must be positive"):
        chunk_text("hello", chunk_size=0)

    with pytest.raises(ValueError, match="overlap must be smaller than chunk_size"):
        chunk_text("hello", chunk_size=10, overlap=10)


def test_chunk_text_splits_with_overlap_and_tracks_offsets() -> None:
    chunks = chunk_text("abcdefghij", chunk_size=6, overlap=2)
    assert [c.text for c in chunks] == ["abcdef", "efghij"]
    assert [(c.start_offset, c.end_offset) for c in chunks] == [(0, 6), (4, 10)]


def test_chunk_text_normalizes_windows_newlines() -> None:
    chunks = chunk_text("a\r\nb", chunk_size=100, overlap=10)
    assert len(chunks) == 1
    assert chunks[0].text == "a\nb"
