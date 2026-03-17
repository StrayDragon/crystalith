from __future__ import annotations

from typing import ClassVar

from bs4 import BeautifulSoup

from .interfaces import ParserError
from .types import Chunk
from .utils import chunk_paragraphs


class HTMLParser:
    parser_type: ClassVar[str] = "html"
    supported_mime_types: ClassVar[set[str]] = {"text/html"}
    supported_extensions: ClassVar[set[str]] = {".html", ".htm"}
    page_count: int | None = None

    def parse(self, content: bytes) -> list[Chunk]:
        try:
            text = content.decode("utf-8", errors="replace")
            soup = BeautifulSoup(text, "lxml")
        except Exception as exc:
            raise ParserError("Unable to parse HTML content") from exc

        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()
        for tag in soup(["nav", "header", "footer", "aside"]):
            tag.decompose()

        container = soup.find("article") or soup.find("main") or soup.body or soup
        extracted = container.get_text("\n")
        return chunk_paragraphs(extracted)
