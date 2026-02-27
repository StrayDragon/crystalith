from __future__ import annotations

from typing import Protocol

from .types import Chunk


class Parser(Protocol):
    parser_type: str
    supported_mime_types: set[str]
    supported_extensions: set[str]
    page_count: int | None

    def parse(self, content: bytes) -> list[Chunk]: ...


class ParserError(RuntimeError):
    pass


class UnsupportedDocumentError(ValueError):
    pass
