from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class ChunkPayload:
    text: str
    start_offset: int
    end_offset: int
    metadata: dict[str, object] = field(default_factory=dict)


def chunk_text(text: str, *, chunk_size: int = 800, overlap: int = 100) -> list[ChunkPayload]:
    normalized = text.replace("\r\n", "\n")
    if not normalized.strip():
        return []

    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive")
    if overlap >= chunk_size:
        raise ValueError("overlap must be smaller than chunk_size")

    step = max(chunk_size - overlap, 1)
    chunks: list[ChunkPayload] = []
    length = len(normalized)
    start = 0

    while start < length:
        end = min(start + chunk_size, length)
        segment = normalized[start:end].strip()
        if segment:
            chunks.append(ChunkPayload(text=segment, start_offset=start, end_offset=end))
        if end == length:
            break
        start += step

    return chunks
