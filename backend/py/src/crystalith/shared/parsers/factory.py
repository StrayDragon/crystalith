from __future__ import annotations

from pathlib import Path
from urllib.parse import urlparse

from .audio import AudioParser
from .csv import CSVParser
from .html import HTMLParser
from .interfaces import Parser, UnsupportedDocumentError
from .media import DisabledMediaFetcher, MediaFetcher
from .pdf import PDFParser
from .text import TextParser
from .transcription import DisabledTranscriber, TranscriptionProvider
from .video import VideoParser
from crystalith.shared.plugins import PluginRegistry

_YOUTUBE_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"}


def _is_youtube_url(value: str) -> bool:
    try:
        parsed = urlparse(value)
    except ValueError:
        return False
    if parsed.scheme not in {"http", "https"}:
        return False
    host = (parsed.hostname or "").lower()
    return host in _YOUTUBE_HOSTS


class ParserFactory:
    @classmethod
    def from_file(
        cls,
        *,
        filename: str | None,
        mime_type: str | None,
        transcriber: TranscriptionProvider | None = None,
        media_fetcher: MediaFetcher | None = None,
        plugins: PluginRegistry | None = None,
    ) -> Parser:
        extension = Path(filename or "").suffix.lower()
        normalized_mime = (mime_type or "").split(";")[0].strip()
        resolved_transcriber = transcriber or DisabledTranscriber()
        resolved_fetcher = media_fetcher or DisabledMediaFetcher()

        if filename and _is_youtube_url(filename):
            return VideoParser(
                resolved_transcriber,
                source_url=filename,
                media_fetcher=resolved_fetcher,
            )

        if normalized_mime:
            if normalized_mime in AudioParser.supported_mime_types:
                return AudioParser(
                    resolved_transcriber,
                    filename=filename,
                    mime_type=normalized_mime,
                )
            if normalized_mime in VideoParser.supported_mime_types:
                return VideoParser(
                    resolved_transcriber,
                    filename=filename,
                    mime_type=normalized_mime,
                    media_fetcher=resolved_fetcher,
                )
            if normalized_mime in CSVParser.supported_mime_types:
                return CSVParser()
            if normalized_mime in TextParser.supported_mime_types:
                return TextParser()
            if normalized_mime in PDFParser.supported_mime_types:
                return PDFParser()
            if normalized_mime in HTMLParser.supported_mime_types:
                return HTMLParser()

        if extension:
            if extension in AudioParser.supported_extensions:
                return AudioParser(
                    resolved_transcriber,
                    filename=filename,
                    mime_type=normalized_mime or None,
                )
            if extension in VideoParser.supported_extensions:
                return VideoParser(
                    resolved_transcriber,
                    filename=filename,
                    mime_type=normalized_mime or None,
                    media_fetcher=resolved_fetcher,
                )
            if extension in CSVParser.supported_extensions:
                return CSVParser()
            if extension in TextParser.supported_extensions:
                return TextParser()
            if extension in PDFParser.supported_extensions:
                return PDFParser()
            if extension in HTMLParser.supported_extensions:
                return HTMLParser()

        if plugins is not None:
            for plugin in plugins.parsers.values():
                if normalized_mime and normalized_mime in plugin.supported_mime_types:
                    return plugin.create_parser(
                        filename=filename,
                        mime_type=normalized_mime or None,
                        transcriber=resolved_transcriber,
                        media_fetcher=resolved_fetcher,
                    )
                if extension and extension in plugin.supported_extensions:
                    return plugin.create_parser(
                        filename=filename,
                        mime_type=normalized_mime or None,
                        transcriber=resolved_transcriber,
                        media_fetcher=resolved_fetcher,
                    )

        raise UnsupportedDocumentError("Unsupported file type")
