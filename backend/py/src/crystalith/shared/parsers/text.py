from __future__ import annotations

from crystalith.shared.json_types import JsonDict

from .interfaces import ParserError
from .markdown_preprocessor import preprocess_obsidian_markdown
from .types import Chunk
from .utils import chunk_paragraphs


class TextParser:
    parser_type = "text"
    supported_mime_types = {"text/plain", "text/markdown", "text/csv"}
    supported_extensions = {".txt", ".md", ".markdown", ".csv"}
    page_count: int | None = None

    def __init__(self, *, preprocess_markdown: bool = False) -> None:
        self.preprocess_markdown = preprocess_markdown
        self.document_metadata: JsonDict | None = None

    def parse(self, content: bytes) -> list[Chunk]:
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise ParserError("Unable to decode text content as UTF-8") from exc

        self.document_metadata = None
        if self.preprocess_markdown:
            result = preprocess_obsidian_markdown(text)
            self.document_metadata = result.metadata or None
            return result.chunks

        return chunk_paragraphs(text)
