from __future__ import annotations

from typing import Protocol

from .types import Chunk
from crystalith.shared.json_types import JsonValue


class Parser(Protocol):
    parser_type: str
    supported_mime_types: set[str]
    supported_extensions: set[str]
    page_count: int | None

    def parse(self, content: bytes) -> list[Chunk]: ...


class ParserError(RuntimeError):
    pass


class UnsupportedDocumentError(ValueError):
    def __init__(
        self,
        message: str,
        *,
        required_plugin_id: str | None = None,
        details: dict[str, JsonValue] | None = None,
    ) -> None:
        super().__init__(message)
        self.required_plugin_id = required_plugin_id
        self.details = details or {}
