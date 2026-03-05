from __future__ import annotations

from pathlib import Path

from crystalith.shared.parsers.audio import AudioParser
from crystalith.shared.parsers.interfaces import ParserError
from crystalith.shared.parsers.video import VideoParser


class MediaParserPlugin:
    api_version = "v1"

    parser_type = "media"
    supported_mime_types = AudioParser.supported_mime_types | VideoParser.supported_mime_types
    supported_extensions = AudioParser.supported_extensions | VideoParser.supported_extensions

    def create_parser(self, *_args, filename=None, mime_type=None, transcriber=None, media_fetcher=None, **_kwargs):  # noqa: ANN001, ANN002, ANN003
        resolved_mime = (mime_type or "").split(";")[0].strip().lower()
        extension = Path(filename or "").suffix.lower()

        if resolved_mime.startswith("audio/") or extension in AudioParser.supported_extensions:
            if transcriber is None:
                raise ParserError("Transcription provider is not configured")
            return AudioParser(
                transcriber,
                filename=filename,
                mime_type=resolved_mime or None,
            )

        if resolved_mime.startswith("video/") or extension in VideoParser.supported_extensions or (filename and "youtube" in filename):
            if transcriber is None:
                raise ParserError("Transcription provider is not configured")
            return VideoParser(
                transcriber,
                filename=filename,
                mime_type=resolved_mime or None,
                source_url=filename if filename and "youtu" in filename else None,
                media_fetcher=media_fetcher,
            )

        raise ParserError("Unsupported media content type")


plugin = MediaParserPlugin()
