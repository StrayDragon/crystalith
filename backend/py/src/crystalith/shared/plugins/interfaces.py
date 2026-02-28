from __future__ import annotations

from typing import TYPE_CHECKING, Protocol, runtime_checkable

from pydantic import BaseModel

from crystalith.shared.config import ModelConfig, Settings
from .render_types import OutputTypePluginMeta, PluginConfigSchema, RenderDescriptor
if TYPE_CHECKING:
    from crystalith.shared.ai.interfaces import ChatProvider, EmbeddingProvider
    from crystalith.shared.parsers.interfaces import Parser
    from crystalith.shared.parsers.media import MediaFetcher
    from crystalith.shared.parsers.transcription import TranscriptionProvider


PLUGIN_API_VERSION = "v1"
SUPPORTED_PLUGIN_API_VERSIONS: frozenset[str] = frozenset({PLUGIN_API_VERSION})


@runtime_checkable
class BasePlugin(Protocol):
    """
    Optional base metadata for all plugins.

    Plugins may expose `api_version` to declare compatibility with the core
    plugin interface version. When omitted, the core assumes compatibility.
    """

    api_version: str


@runtime_checkable
class AIProviderPlugin(Protocol):
    """
    AI provider plugin factory.

    The entry point name is treated as the provider id and MUST match
    `models.available[].provider` in config.
    """

    api_version: str

    def create_chat_provider(self, settings: Settings, model_config: ModelConfig) -> "ChatProvider": ...

    def create_embedding_provider(self, settings: Settings, model_config: ModelConfig) -> "EmbeddingProvider": ...


@runtime_checkable
class ParserPlugin(Protocol):
    """
    Parser plugin factory.

    `parser_type` will be written to Source.parser_type for observability.
    """

    api_version: str

    parser_type: str
    supported_mime_types: set[str]
    supported_extensions: set[str]

    def create_parser(
        self,
        *,
        filename: str | None,
        mime_type: str | None,
        transcriber: "TranscriptionProvider | None" = None,
        media_fetcher: "MediaFetcher | None" = None,
    ) -> "Parser": ...


@runtime_checkable
class OutputTypePlugin(Protocol):
    """
    Output type extension for structured generation.

    NOTE: Crystalith's database stores Output.type as an enum. For now, plugins
    may override generation for existing output types (by value), but cannot
    introduce brand new output types without a core migration.
    """

    api_version: str

    output_type: str
    schema: type[BaseModel]
    default_prompt: str | None

    metadata: OutputTypePluginMeta | None
    render_descriptor: RenderDescriptor | None
    config_schema: PluginConfigSchema | None
