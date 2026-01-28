from __future__ import annotations

from .interfaces import ParserError
from .media import DisabledMediaFetcher, MediaFetcher, MediaSource
from .transcription import TranscriptionProvider
from .types import Chunk
from .utils import chunk_paragraphs


class VideoParser:
    parser_type = "video"
    supported_mime_types = {"video/mp4"}
    supported_extensions = {".mp4"}

    def __init__(
        self,
        transcriber: TranscriptionProvider,
        *,
        filename: str | None = None,
        mime_type: str | None = None,
        source_url: str | None = None,
        media_fetcher: MediaFetcher | None = None,
    ) -> None:
        self._transcriber = transcriber
        self._filename = filename
        self._mime_type = mime_type
        self._source_url = source_url
        self._media_fetcher = media_fetcher or DisabledMediaFetcher()

    def parse(self, content: bytes) -> list[Chunk]:
        filename = self._filename
        mime_type = self._mime_type
        resolved = content

        if self._source_url:
            media: MediaSource = self._media_fetcher.fetch(self._source_url)
            resolved = media.content
            filename = media.filename or filename
            mime_type = media.mime_type or mime_type

        if not resolved:
            raise ParserError("Empty video content")

        try:
            transcript = self._transcriber.transcribe(
                resolved,
                filename=filename,
                mime_type=mime_type,
            )
        except Exception as exc:
            raise ParserError("Video transcription failed") from exc

        return chunk_paragraphs(transcript)
