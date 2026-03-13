from __future__ import annotations

from typing import TYPE_CHECKING, Protocol, runtime_checkable

from pydantic import BaseModel

from crystalith.shared.config import ModelConfig, Settings
from crystalith.shared.json_types import JsonDict
from .render_types import (
    FrontendBundleDescriptor,
    OutputTypePluginMeta,
    PluginConfigSchema,
    PreviewDescriptor,
    RenderDescriptor,
)

if TYPE_CHECKING:
    from crystalith.features.studio.slides.schemas import SlideGenerationConfig, SlideOutline
    from crystalith.shared.agents.deps import StudioDeps
    from crystalith.shared.ai.interfaces import ChatProvider, EmbeddingProvider
    from crystalith.shared.config.models import UrlFetchSecuritySettings
    from crystalith.shared.extraction.interfaces import Extractor
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

    def create_chat_provider(self, settings: Settings, model_config: ModelConfig) -> ChatProvider: ...

    def create_embedding_provider(self, settings: Settings, model_config: ModelConfig) -> EmbeddingProvider: ...


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
        transcriber: TranscriptionProvider | None = None,
        media_fetcher: MediaFetcher | None = None,
    ) -> Parser: ...


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


@runtime_checkable
class OutputTypeFrontendBundle(Protocol):
    """
    Optional frontend bundle metadata for OutputType plugins.

    Kept as a separate protocol so adding this attribute does not break
    existing OutputTypePlugin implementations loaded via runtime checks.
    """

    frontend_bundle: FrontendBundleDescriptor | None


@runtime_checkable
class SlidesWorkflowPlugin(Protocol):
    """
    Slides workflow plugin for the SLIDES tool.

    Unlike OutputTypePlugin, this contract owns a multi-stage workflow:
    draft config, outline generation, markdown generation, and preview metadata.
    """

    api_version: str

    engine: str
    default_prompt: str | None
    metadata: OutputTypePluginMeta | None
    config_schema: PluginConfigSchema
    preview_descriptor: PreviewDescriptor | None
    frontend_bundle: FrontendBundleDescriptor | None

    async def generate_outline(
        self,
        deps: StudioDeps,
        *,
        notebook_id: int,
        title: str | None,
        prompt: str | None,
        source_ids: list[int],
        generation_config: SlideGenerationConfig | JsonDict | None = None,
        model_id: str | None = None,
        trace_id: str | None = None,
        request_id: str | None = None,
        timings_ms: dict[str, int] | None = None,
    ) -> tuple[SlideOutline, list[int]]: ...

    async def generate_markdown(
        self,
        deps: StudioDeps,
        *,
        notebook_id: int,
        title: str | None,
        prompt: str | None,
        outline: SlideOutline,
        source_ids: list[int],
        chunk_ids: list[int] | None = None,
        generation_config: SlideGenerationConfig | JsonDict | None = None,
        model_id: str | None = None,
        trace_id: str | None = None,
        request_id: str | None = None,
        timings_ms: dict[str, int] | None = None,
    ) -> tuple[str, list[int]]: ...


@runtime_checkable
class WebExtractorPlugin(Protocol):
    """
    Web extractor plugin factory.

    `extractor_type` is the stable key used for selection and diagnostics.
    """

    api_version: str

    extractor_type: str

    display_name: str | None
    description: str | None
    requires_api_key: bool
    requires_service: bool

    def create_extractor(
        self,
        settings: Settings,
        *,
        url_fetch_security: UrlFetchSecuritySettings | None = None,
    ) -> Extractor: ...


@runtime_checkable
class SourceConnectorPlugin(Protocol):
    """
    Source connector plugin factory.

    v1 plugins are backend-only: the host owns persistence and the workflow UI.
    Connectors provide configuration schema, diagnostics, snapshot enumeration,
    and file reads.
    """

    api_version: str

    display_name: str
    description: str | None
    connection_config_schema: JsonDict

    supports_snapshot: bool
    supports_sync_check: bool

    async def get_diagnostics(
        self,
        settings: Settings,
        *,
        connection_config: JsonDict | None = None,
    ) -> list[JsonDict] | None: ...

    async def list_snapshot_entries(
        self,
        settings: Settings,
        *,
        connection_config: JsonDict,
    ) -> list[JsonDict]: ...

    async def read_file_bytes(
        self,
        settings: Settings,
        *,
        connection_config: JsonDict,
        relative_path: str,
    ) -> bytes: ...
