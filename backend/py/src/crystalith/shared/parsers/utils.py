from __future__ import annotations

from .types import Chunk


def chunk_paragraphs(text: str, *, metadata: dict[str, object] | None = None) -> list[Chunk]:
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    if not normalized.strip():
        return []

    chunks: list[Chunk] = []
    lines = normalized.splitlines(keepends=True)
    offset = 0
    current_start: int | None = None
    current_parts: list[str] = []
    last_end: int | None = None
    paragraph_index = 0

    for line in lines:
        if line.strip() == "":
            if current_start is not None:
                paragraph_text = "".join(current_parts).strip("\n")
                if paragraph_text.strip():
                    end_offset = last_end if last_end is not None else offset
                    chunk_metadata = dict(metadata) if metadata else {}
                    chunk_metadata.setdefault("paragraph_index", paragraph_index)
                    chunks.append(
                        Chunk(
                            text=paragraph_text,
                            start_offset=current_start,
                            end_offset=end_offset,
                            metadata=chunk_metadata,
                        )
                    )
                    paragraph_index += 1
            current_start = None
            current_parts = []
            last_end = None
        else:
            if current_start is None:
                current_start = offset
            current_parts.append(line)
            last_end = offset + len(line)
        offset += len(line)

    if current_start is not None:
        paragraph_text = "".join(current_parts).strip("\n")
        if paragraph_text.strip():
            end_offset = last_end if last_end is not None else offset
            chunk_metadata = dict(metadata) if metadata else {}
            chunk_metadata.setdefault("paragraph_index", paragraph_index)
            chunks.append(
                Chunk(
                    text=paragraph_text,
                    start_offset=current_start,
                    end_offset=end_offset,
                    metadata=chunk_metadata,
                )
            )
            paragraph_index += 1

    return chunks
