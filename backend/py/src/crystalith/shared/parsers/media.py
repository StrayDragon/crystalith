from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from .interfaces import ParserError


@dataclass(frozen=True, slots=True)
class MediaSource:
    content: bytes
    mime_type: str | None = None
    filename: str | None = None


class MediaFetcher(Protocol):
    def fetch(self, url: str) -> MediaSource: ...


class DisabledMediaFetcher:
    def fetch(self, url: str) -> MediaSource:
        _ = url
        raise ParserError("Media fetcher is not configured")
