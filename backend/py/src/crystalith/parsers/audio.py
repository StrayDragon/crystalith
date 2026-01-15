from __future__ import annotations

from .interfaces import ParserError
from .transcription import TranscriptionProvider
from .types import Chunk
from .utils import chunk_paragraphs


class AudioParser:
    parser_type = "audio"
    supported_mime_types = {"audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave"}
    supported_extensions = {".mp3", ".wav"}

    def __init__(
        self,
        transcriber: TranscriptionProvider,
        *,
        filename: str | None = None,
        mime_type: str | None = None,
    ) -> None:
        self._transcriber = transcriber
        self._filename = filename
        self._mime_type = mime_type

    def parse(self, content: bytes) -> list[Chunk]:
        if not content:
            raise ParserError("Empty audio content")

        try:
            transcript = self._transcriber.transcribe(
                content,
                filename=self._filename,
                mime_type=self._mime_type,
            )
        except Exception as exc:
            raise ParserError("Audio transcription failed") from exc

        return chunk_paragraphs(transcript)
