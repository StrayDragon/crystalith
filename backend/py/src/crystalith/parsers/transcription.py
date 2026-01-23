from __future__ import annotations

from io import BytesIO
from typing import Protocol

from openai import OpenAI

from crystalith.config import Settings

from .interfaces import ParserError


class TranscriptionProvider(Protocol):
    provider: str
    model: str

    def transcribe(
        self,
        content: bytes,
        *,
        filename: str | None = None,
        mime_type: str | None = None,
    ) -> str: ...


class OpenAITranscriber:
    provider = "openai"

    def __init__(
        self,
        model: str = "whisper-1",
        *,
        client: OpenAI | None = None,
        api_key: str | None = None,
        base_url: str | None = None,
        organization: str | None = None,
        project: str | None = None,
    ) -> None:
        self.model = model
        self._client = client or OpenAI(
            api_key=api_key,
            base_url=base_url,
            organization=organization,
            project=project,
        )

    def transcribe(
        self,
        content: bytes,
        *,
        filename: str | None = None,
        mime_type: str | None = None,
    ) -> str:
        if not content:
            raise ParserError("Empty audio content")

        file_obj = BytesIO(content)
        file_obj.name = filename or "audio"

        try:
            response = self._client.audio.transcriptions.create(
                model=self.model,
                file=file_obj,
            )
        except Exception as exc:
            raise ParserError("OpenAI transcription failed") from exc

        if isinstance(response, str):
            return response

        text = getattr(response, "text", None)
        if text is None:
            raise ParserError("Transcription response missing text")
        return text


class DisabledTranscriber:
    provider = "disabled"
    model = "disabled"

    def transcribe(
        self,
        content: bytes,
        *,
        filename: str | None = None,
        mime_type: str | None = None,
    ) -> str:
        raise ParserError("Transcription provider is not configured")


def create_transcription_provider(settings: Settings) -> TranscriptionProvider:
    """
    Create a transcription provider using OpenAI's Whisper API.

    Finds an OpenAI model from available models to get API credentials.
    """
    # Find an OpenAI model to get API credentials
    openai_model = None
    for model in settings.models.available:
        if model.provider == "openai":
            openai_model = model
            break

    if openai_model is None:
        return DisabledTranscriber()

    config = openai_model.get_openai_config()
    api_key = config.api_key or ""
    if not api_key.strip():
        return DisabledTranscriber()

    return OpenAITranscriber(
        api_key=config.api_key,
        base_url=config.base_url,
        organization=config.organization,
        project=config.project,
    )
