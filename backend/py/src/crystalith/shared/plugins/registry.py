from __future__ import annotations

from dataclasses import dataclass, field
from importlib import metadata
from typing import cast

from cl_logs.logging import get_logger

from crystalith.shared.config import Settings

from .interfaces import (
    AIProviderPlugin,
    OutputTypePlugin,
    ParserPlugin,
    PLUGIN_API_VERSION,
)
from .render_types import OutputTypePluginMeta, PluginConfigSchema, RenderDescriptor


log = get_logger(__name__)

SupportedPlugin = AIProviderPlugin | ParserPlugin | OutputTypePlugin


def _iter_entry_points(group: str) -> list[metadata.EntryPoint]:
    try:
        selected = metadata.entry_points(group=group)
    except TypeError:
        selected = metadata.entry_points().select(group=group)
    return list(selected)


@dataclass(slots=True)
class PluginLoadReport:
    loaded: list[str] = field(default_factory=list)
    skipped: dict[str, str] = field(default_factory=dict)


class PluginRegistry:
    """
    A simple startup-time plugin registry.

    Plugins are discovered via Python entry points:

        [project.entry-points."crystalith.plugins"]
        my-provider = "my_pkg.plugin:plugin"
    """

    entrypoint_group = "crystalith.plugins"

    def __init__(self) -> None:
        self.plugins: dict[str, SupportedPlugin] = {}
        self.ai_providers: dict[str, AIProviderPlugin] = {}
        self.parsers: dict[str, ParserPlugin] = {}
        self.output_types: dict[str, OutputTypePlugin] = {}
        self.output_type_metadata: dict[str, OutputTypePluginMeta] = {}
        self.render_descriptors: dict[str, RenderDescriptor] = {}
        self.config_schemas: dict[str, PluginConfigSchema] = {}
        self._output_type_plugin_ids: dict[str, str] = {}
        self._loaded_entrypoints: dict[str, str] = {}

    def reset(self) -> None:
        self.plugins.clear()
        self.ai_providers.clear()
        self.parsers.clear()
        self.output_types.clear()
        self.output_type_metadata.clear()
        self.render_descriptors.clear()
        self.config_schemas.clear()
        self._output_type_plugin_ids.clear()
        self._loaded_entrypoints.clear()

    def load_from_entry_points(self, settings: Settings) -> PluginLoadReport:
        """
        Scan installed packages and register compatible plugins.

        This should be called once during application startup.
        """
        self.reset()

        report = PluginLoadReport()
        for entry_point in _iter_entry_points(self.entrypoint_group):
            plugin_id = entry_point.name

            if not settings.plugins.is_enabled(plugin_id):
                report.skipped[plugin_id] = "disabled"
                continue

            try:
                loaded = entry_point.load()
            except Exception as exc:  # noqa: BLE001 - plugin boundary
                log.warning(
                    "plugin load failed",
                    plugin_id=plugin_id,
                    entry_point=str(entry_point.value),
                    error=type(exc).__name__,
                )
                report.skipped[plugin_id] = f"load_error:{type(exc).__name__}"
                continue

            plugin = self._normalize_loaded_plugin(plugin_id, loaded)
            if plugin is None:
                report.skipped[plugin_id] = "init_error"
                continue

            has_ai_provider = isinstance(plugin, AIProviderPlugin)
            has_parser = isinstance(plugin, ParserPlugin)
            has_output_type = isinstance(plugin, OutputTypePlugin)

            if not (has_ai_provider or has_parser or has_output_type):
                log.warning(
                    "plugin skipped (no compatible interfaces)",
                    plugin_id=plugin_id,
                    entry_point=str(entry_point.value),
                )
                report.skipped[plugin_id] = "no_compatible_interfaces"
                continue

            supported = cast(SupportedPlugin, plugin)
            if not self._is_api_compatible(plugin_id, supported):
                report.skipped[plugin_id] = "incompatible_api"
                continue

            if has_ai_provider:
                self.ai_providers[plugin_id] = cast(AIProviderPlugin, supported)

            if has_parser:
                parser = cast(ParserPlugin, supported)
                self.parsers[parser.parser_type] = parser

            if has_output_type:
                self._register_output_type_plugin(plugin_id, cast(OutputTypePlugin, supported))

            self._loaded_entrypoints[plugin_id] = str(entry_point.value)
            self.plugins[plugin_id] = supported
            report.loaded.append(plugin_id)
            log.info(
                "plugin loaded",
                plugin_id=plugin_id,
                entry_point=str(entry_point.value),
                has_ai_provider=has_ai_provider,
                has_parser=has_parser,
                has_output_type=has_output_type,
            )

        return report

    def _register_output_type_plugin(self, plugin_id: str, plugin: OutputTypePlugin) -> None:
        output_type = plugin.output_type

        existing_plugin_id = self._output_type_plugin_ids.get(output_type)
        if existing_plugin_id is not None:
            log.warning(
                "output type plugin conflict; overwriting",
                output_type=output_type,
                existing_plugin_id=existing_plugin_id,
                plugin_id=plugin_id,
            )

        self.output_types[output_type] = plugin
        self._output_type_plugin_ids[output_type] = plugin_id

        self.output_type_metadata.pop(output_type, None)
        self.render_descriptors.pop(output_type, None)
        self.config_schemas.pop(output_type, None)

        metadata = plugin.metadata
        if metadata is not None:
            if isinstance(metadata, OutputTypePluginMeta):
                self.output_type_metadata[output_type] = metadata
            else:
                log.warning(
                    "OutputTypePlugin.metadata must be OutputTypePluginMeta; ignoring",
                    plugin_id=plugin_id,
                    output_type=output_type,
                    metadata_type=type(metadata).__name__,
                )

        render_descriptor = plugin.render_descriptor
        if render_descriptor is not None:
            if isinstance(render_descriptor, RenderDescriptor):
                self.render_descriptors[output_type] = render_descriptor
            else:
                log.warning(
                    "OutputTypePlugin.render_descriptor must be RenderDescriptor; ignoring",
                    plugin_id=plugin_id,
                    output_type=output_type,
                    render_descriptor_type=type(render_descriptor).__name__,
                )

        config_schema = plugin.config_schema
        if config_schema is not None:
            if isinstance(config_schema, PluginConfigSchema):
                self.config_schemas[output_type] = config_schema
            else:
                log.warning(
                    "OutputTypePlugin.config_schema must be PluginConfigSchema; ignoring",
                    plugin_id=plugin_id,
                    output_type=output_type,
                    config_schema_type=type(config_schema).__name__,
                )

    def _normalize_loaded_plugin(self, plugin_id: str, loaded: object) -> object | None:
        if isinstance(loaded, type):
            try:
                return loaded()
            except TypeError:
                log.warning(
                    "plugin class must be no-arg constructible; skipping",
                    plugin_id=plugin_id,
                    plugin_class=f"{loaded.__module__}.{loaded.__name__}",
                )
                return None
        return loaded

    def _is_api_compatible(self, plugin_id: str, plugin: SupportedPlugin) -> bool:
        api_version = plugin.api_version
        if not isinstance(api_version, str):
            log.warning(
                "plugin api_version must be a string; skipping",
                plugin_id=plugin_id,
                api_version_type=type(api_version).__name__,
            )
            return False

        if api_version != PLUGIN_API_VERSION:
            log.warning(
                "plugin api_version mismatch; skipping",
                plugin_id=plugin_id,
                api_version=api_version,
                expected=PLUGIN_API_VERSION,
            )
            return False

        return True

    # =============================================================================
    # Query helpers
    # =============================================================================

    def is_provider_available(self, provider_id: str) -> bool:
        return provider_id in {"openai", "ollama"} or provider_id in self.ai_providers

    def list_ai_providers(self) -> list[str]:
        return sorted(self.ai_providers.keys())

    def list_parsers(self) -> list[str]:
        return sorted(self.parsers.keys())

    def list_output_types(self) -> list[str]:
        return sorted(self.output_types.keys())

    def get_output_type_metadata(self, output_type: str) -> OutputTypePluginMeta | None:
        return self.output_type_metadata.get(output_type)

    def get_render_descriptor(self, output_type: str) -> RenderDescriptor | None:
        return self.render_descriptors.get(output_type)

    def get_config_schema(self, output_type: str) -> PluginConfigSchema | None:
        return self.config_schemas.get(output_type)
