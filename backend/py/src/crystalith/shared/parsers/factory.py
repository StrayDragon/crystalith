from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

from crystalith.shared.plugins import ParserPlugin, PluginRegistry

from .csv import CSVParser
from .interfaces import Parser, UnsupportedDocumentError
from .media import DisabledMediaFetcher, MediaFetcher
from .text import TextParser
from .transcription import DisabledTranscriber, TranscriptionProvider

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


@dataclass(frozen=True, slots=True)
class ParserResolution:
    parser: Parser
    parser_plugin_id: str | None = None


def _recommend_parser_plugin_id(*, extension: str, mime_type: str, filename: str | None) -> str | None:
    if extension == ".pdf" or mime_type == "application/pdf":
        return "parser-pdf"
    if extension in {".html", ".htm"} or mime_type == "text/html":
        return "parser-html"

    if _is_youtube_url(filename or ""):
        return "parser-media"

    if extension in {".mp3", ".wav", ".mp4"}:
        return "parser-media"
    if mime_type.startswith(("audio/", "video/")):
        return "parser-media"

    return None


class ParserFactory:
    @classmethod
    def resolve_from_file(
        cls,
        *,
        filename: str | None,
        mime_type: str | None,
        transcriber: TranscriptionProvider | None = None,
        media_fetcher: MediaFetcher | None = None,
        plugins: PluginRegistry | None = None,
    ) -> ParserResolution:
        extension = Path(filename or "").suffix.lower()
        normalized_mime = (mime_type or "").split(";")[0].strip().lower()
        resolved_transcriber = transcriber or DisabledTranscriber()
        resolved_fetcher = media_fetcher or DisabledMediaFetcher()

        if filename and _is_youtube_url(filename) and not normalized_mime:
            normalized_mime = "video/mp4"

        if plugins is not None:
            resolution = cls._resolve_from_plugins(
                filename=filename,
                mime_type=normalized_mime,
                extension=extension,
                transcriber=resolved_transcriber,
                media_fetcher=resolved_fetcher,
                plugins=plugins,
            )
            if resolution is not None:
                return resolution

        # Core-only minimal parsers: txt/md/markdown/csv
        markdown_mode = normalized_mime == "text/markdown" or extension in {".md", ".markdown"}

        if normalized_mime in CSVParser.supported_mime_types:
            return ParserResolution(parser=CSVParser())
        if normalized_mime in TextParser.supported_mime_types:
            return ParserResolution(parser=TextParser(preprocess_markdown=markdown_mode))

        if extension in CSVParser.supported_extensions:
            return ParserResolution(parser=CSVParser())
        if extension in TextParser.supported_extensions:
            return ParserResolution(parser=TextParser(preprocess_markdown=markdown_mode))

        required_plugin_id = _recommend_parser_plugin_id(
            extension=extension,
            mime_type=normalized_mime,
            filename=filename,
        )
        raise UnsupportedDocumentError(
            "Unsupported file type",
            required_plugin_id=required_plugin_id,
            details={
                "mime_type": normalized_mime or None,
                "extension": extension or None,
            },
        )

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
        return cls.resolve_from_file(
            filename=filename,
            mime_type=mime_type,
            transcriber=transcriber,
            media_fetcher=media_fetcher,
            plugins=plugins,
        ).parser

    @classmethod
    def _resolve_from_plugins(
        cls,
        *,
        filename: str | None,
        mime_type: str,
        extension: str,
        transcriber: TranscriptionProvider,
        media_fetcher: MediaFetcher,
        plugins: PluginRegistry,
    ) -> ParserResolution | None:
        plugin_parsers_by_id: dict[str, list[ParserPlugin]] = {}
        for parser_type, plugin in plugins.parsers.items():
            plugin_id = plugins.get_parser_plugin_id(parser_type)
            if plugin_id is None:
                continue
            plugin_parsers_by_id.setdefault(plugin_id, []).append(plugin)

        def matches(candidate: ParserPlugin) -> bool:
            if mime_type and mime_type in candidate.supported_mime_types:
                return True
            return bool(extension and extension in candidate.supported_extensions)

        # Prefer the last-loaded matching plugin (load order is deterministic and honors plugins.load_order).
        loaded_order = list(plugins.get_load_report().loaded)
        for plugin_id in reversed(loaded_order):
            for plugin in plugin_parsers_by_id.get(plugin_id, []):
                if not matches(plugin):
                    continue
                return ParserResolution(
                    parser=plugin.create_parser(
                        filename=filename,
                        mime_type=mime_type or None,
                        transcriber=transcriber,
                        media_fetcher=media_fetcher,
                    ),
                    parser_plugin_id=plugin_id,
                )

        # Defensive: handle parsers that were registered without a corresponding loaded plugin id.
        for plugin_id in sorted(plugin_parsers_by_id.keys()):
            if plugin_id in set(loaded_order):
                continue
            for plugin in plugin_parsers_by_id.get(plugin_id, []):
                if not matches(plugin):
                    continue
                return ParserResolution(
                    parser=plugin.create_parser(
                        filename=filename,
                        mime_type=mime_type or None,
                        transcriber=transcriber,
                        media_fetcher=media_fetcher,
                    ),
                    parser_plugin_id=plugin_id,
                )

        return None
