from __future__ import annotations

from io import BytesIO

from pypdf import PdfReader

from .interfaces import ParserError
from .types import Chunk
from .utils import chunk_paragraphs


class PDFParser:
    parser_type = "pdf"
    supported_mime_types = {"application/pdf"}
    supported_extensions = {".pdf"}

    def __init__(self) -> None:
        self.page_count: int | None = None

    def parse(self, content: bytes) -> list[Chunk]:
        try:
            reader = PdfReader(BytesIO(content))
        except Exception as exc:
            raise ParserError("Unable to read PDF content") from exc

        if reader.is_encrypted:
            try:
                decrypted = reader.decrypt("")
            except Exception as exc:
                raise ParserError("Encrypted PDF content is not supported") from exc
            if not decrypted:
                raise ParserError("Encrypted PDF content is not supported")

        self.page_count = len(reader.pages)
        chunks: list[Chunk] = []

        for page_number, page in enumerate(reader.pages, start=1):
            try:
                text = page.extract_text() or ""
            except Exception as exc:
                raise ParserError(f"Failed to extract text from page {page_number}") from exc

            if not text.strip():
                continue
            page_chunks = chunk_paragraphs(text, metadata={"page": page_number})
            chunks.extend(page_chunks)

        return chunks
