"""Chunk metadata extraction utilities."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from crystalith.shared.db import Chunk


def extract_page_number(chunk: Chunk) -> int | None:
    """Extract page number from chunk metadata."""
    metadata = chunk.metadata_ if isinstance(chunk.metadata_, dict) else None
    page = metadata.get("page") if metadata else None
    return page if isinstance(page, int) else None


def extract_paragraph_index(chunk: Chunk) -> int | None:
    """Extract paragraph index from chunk metadata."""
    metadata = chunk.metadata_ if isinstance(chunk.metadata_, dict) else None
    paragraph_index = metadata.get("paragraph_index") if metadata else None
    return paragraph_index if isinstance(paragraph_index, int) else None
