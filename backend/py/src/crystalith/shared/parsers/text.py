from __future__ import annotations

from .interfaces import ParserError
from .types import Chunk
from .utils import chunk_paragraphs


class TextParser:
    parser_type = "text"
    supported_mime_types = {"text/plain", "text/markdown"}
    supported_extensions = {".txt", ".md", ".markdown"}
    page_count: int | None = None

    def parse(self, content: bytes) -> list[Chunk]:
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise ParserError("Unable to decode text content as UTF-8") from exc
        return chunk_paragraphs(text)
