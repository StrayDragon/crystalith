from __future__ import annotations

from dataclasses import dataclass, field
from importlib import metadata
from typing import cast

from cl_logs.logging import get_logger

from crystalith.shared.config import Settings
from crystalith.shared.json_types import JsonValue

from .interfaces import (
    PLUGIN_API_VERSION,
    SUPPORTED_PLUGIN_API_VERSIONS,
    AIProviderPlugin,
    OutputTypeFrontendBundle,
    OutputTypePlugin,
    ParserPlugin,
    SlidesWorkflowPlugin,
    SourceConnectorPlugin,
    WebExtractorPlugin,
)
from .render_types import FrontendBundleDescriptor, OutputTypePluginMeta, PluginConfigSchema, RenderDescriptor

log = get_logger(__name__)

SupportedPlugin = (
    AIProviderPlugin
    | ParserPlugin
    | OutputTypePlugin
    | SlidesWorkflowPlugin
    | WebExtractorPlugin
    | SourceConnectorPlugin
)


def _iter_entry_points(group: str) -> list[metadata.EntryPoint]:
    try:
        selected = metadata.entry_points(group=group)
    except TypeError:
        selected = metadata.entry_points().select(group=group)
    return list(selected)


def _order_entry_points(
    entry_points: list[metadata.EntryPoint],
    *,
    settings: Settings,
) -> list[metadata.EntryPoint]:
    """
    Deterministically order entry points.

    Rules:
    - enabled plugins are loaded in lexicographic `plugin_id` order by default
    - `plugins.load_order` (when set) moves enabled plugins to the end in the given order
    """
    ordered = sorted(entry_points, key=lambda item: item.name)
    load_order = getattr(settings.plugins, "load_order", None) or []
    if not load_order:
        return ordered

    by_id = {item.name: item for item in ordered}
    moved: list[metadata.EntryPoint] = []
    moved_ids: set[str] = set()
    for raw in load_order:
        plugin_id = str(raw or "").strip()
        if not plugin_id or plugin_id in moved_ids:
            continue
        entry_point = by_id.get(plugin_id)
        if entry_point is None:
            continue
        if not settings.plugins.is_enabled(plugin_id):
            continue
        moved.append(entry_point)
        moved_ids.add(plugin_id)

    if not moved:
        return ordered

    remaining = [item for item in ordered if item.name not in moved_ids]
    return remaining + moved


@dataclass(slots=True)
class PluginSkipDetail:
    error_code: str
    message: str
    hint: str | None = None
    details: dict[str, JsonValue] = field(default_factory=dict)

    def to_dict(self) -> dict[str, JsonValue]:
        payload: dict[str, JsonValue] = {
            "error_code": self.error_code,
            "message": self.message,
        }
        if self.hint is not None:
            payload["hint"] = self.hint
        if self.details:
            payload["details"] = self.details
        return payload


@dataclass(slots=True)
class PluginLoadReport:
    loaded: list[str] = field(default_factory=list)
    skipped: dict[str, PluginSkipDetail] = field(default_factory=dict)


@dataclass(slots=True)
class SlidesWorkflowSelection:
    plugin_id: str | None = None
    plugin: SlidesWorkflowPlugin | None = None
    error_code: str | None = None
    message: str | None = None
    hint: str | None = None
    details: dict[str, JsonValue] = field(default_factory=dict)

    @property
    def available(self) -> bool:
        return self.plugin_id is not None and self.plugin is not None

    def to_error_detail(self) -> dict[str, JsonValue]:
        details = dict(self.details)
        if self.plugin_id is not None:
            details.setdefault("plugin_id", self.plugin_id)
        if self.plugin is not None:
            details.setdefault("engine", self.plugin.engine)

        payload: dict[str, JsonValue] = {
            "error_code": self.error_code or "slides_workflow_unavailable",
            "message": self.message or "Slides workflow capability is unavailable",
        }
        if self.hint is not None:
            payload["hint"] = self.hint
        if details:
            payload["details"] = details
        return payload


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
        self.web_extractors: dict[str, WebExtractorPlugin] = {}
        self.output_types: dict[str, OutputTypePlugin] = {}
        self.slides_workflows: dict[str, SlidesWorkflowPlugin] = {}
        self.source_connectors: dict[str, SourceConnectorPlugin] = {}
        self.output_type_metadata: dict[str, OutputTypePluginMeta] = {}
        self.render_descriptors: dict[str, RenderDescriptor] = {}
        self.config_schemas: dict[str, PluginConfigSchema] = {}
        self.frontend_bundles: dict[str, FrontendBundleDescriptor] = {}
        self._output_type_plugin_ids: dict[str, str] = {}
        self._parser_plugin_ids: dict[str, str] = {}
        self._web_extractor_plugin_ids: dict[str, str] = {}
        self._loaded_entrypoints: dict[str, str] = {}
        self._load_report = PluginLoadReport()

    def reset(self) -> None:
        self.plugins.clear()
        self.ai_providers.clear()
        self.parsers.clear()
        self.web_extractors.clear()
        self.output_types.clear()
        self.slides_workflows.clear()
        self.source_connectors.clear()
        self.output_type_metadata.clear()
        self.render_descriptors.clear()
        self.config_schemas.clear()
        self.frontend_bundles.clear()
        self._output_type_plugin_ids.clear()
        self._parser_plugin_ids.clear()
        self._web_extractor_plugin_ids.clear()
        self._loaded_entrypoints.clear()
        self._load_report = PluginLoadReport()

    def load_from_entry_points(self, settings: Settings) -> PluginLoadReport:
        """
        Scan installed packages and register compatible plugins.

        This should be called once during application startup.
        """
        self.reset()

        report = PluginLoadReport()
        for entry_point in _order_entry_points(
            _iter_entry_points(self.entrypoint_group),
            settings=settings,
        ):
            plugin_id = entry_point.name
            entry_point_value = str(entry_point.value)

            if not settings.plugins.is_enabled(plugin_id):
                skip_details: dict[str, JsonValue]
                if settings.plugins.enabled:
                    hint = f"Add {plugin_id!r} to plugins.enabled in config/app.yaml to load this plugin."
                    skip_details = {"policy": "allowlist"}
                else:
                    hint = f"Remove {plugin_id!r} from plugins.disabled in config/app.yaml to load this plugin."
                    skip_details = {"policy": "denylist"}
                skip_details["entry_point"] = entry_point_value
                report.skipped[plugin_id] = PluginSkipDetail(
                    error_code="disabled",
                    message="Plugin disabled by configuration",
                    hint=hint,
                    details=skip_details,
                )
                continue

            try:
                loaded = entry_point.load()
            except Exception as exc:
                log.warning(
                    "plugin load failed",
                    plugin_id=plugin_id,
                    entry_point=entry_point_value,
                    error=type(exc).__name__,
                )
                error_code = "missing_dependency" if isinstance(exc, ModuleNotFoundError) else "load_error"
                hint = (
                    "Install the missing dependency and ensure the plugin package is installed."
                    if error_code == "missing_dependency"
                    else "Verify the entry point is importable and the plugin dependencies are installed."
                )
                load_error_details: dict[str, JsonValue] = {
                    "entry_point": entry_point_value,
                    "error": type(exc).__name__,
                }
                if isinstance(exc, ModuleNotFoundError) and exc.name:
                    load_error_details["missing_module"] = exc.name
                report.skipped[plugin_id] = PluginSkipDetail(
                    error_code=error_code,
                    message="Plugin failed to load",
                    hint=hint,
                    details=load_error_details,
                )
                continue

            plugin = self._normalize_loaded_plugin(plugin_id, loaded)
            if plugin is None:
                plugin_class = (
                    f"{loaded.__module__}.{loaded.__name__}" if isinstance(loaded, type) else type(loaded).__name__
                )
                report.skipped[plugin_id] = PluginSkipDetail(
                    error_code="init_error",
                    message="Plugin initialization failed",
                    hint="Expose a module-level `plugin` instance or make the entry-point object no-arg constructible.",
                    details={
                        "entry_point": entry_point_value,
                        "plugin_class": plugin_class,
                    },
                )
                continue

            has_ai_provider = isinstance(plugin, AIProviderPlugin)
            has_parser = isinstance(plugin, ParserPlugin)
            has_output_type = isinstance(plugin, OutputTypePlugin)
            has_slides_workflow = isinstance(plugin, SlidesWorkflowPlugin)
            has_web_extractor = isinstance(plugin, WebExtractorPlugin)
            has_source_connector = isinstance(plugin, SourceConnectorPlugin)

            if not (
                has_ai_provider
                or has_parser
                or has_output_type
                or has_slides_workflow
                or has_web_extractor
                or has_source_connector
            ):
                log.warning(
                    "plugin skipped (no compatible interfaces)",
                    plugin_id=plugin_id,
                    entry_point=entry_point_value,
                )
                report.skipped[plugin_id] = PluginSkipDetail(
                    error_code="no_compatible_interfaces",
                    message="Plugin does not implement any supported plugin interfaces",
                    hint=(
                        "Implement AIProviderPlugin, ParserPlugin, OutputTypePlugin, "
                        "SlidesWorkflowPlugin, WebExtractorPlugin, or SourceConnectorPlugin from "
                        "crystalith.shared.plugins.interfaces."
                    ),
                    details={"entry_point": entry_point_value},
                )
                continue

            supported = cast(SupportedPlugin, plugin)
            api_issue = self._api_compatibility_issue(plugin_id, supported)
            if api_issue is not None:
                api_issue.details.setdefault("entry_point", entry_point_value)
                report.skipped[plugin_id] = api_issue
                continue

            if has_ai_provider:
                self.ai_providers[plugin_id] = cast(AIProviderPlugin, supported)

            if has_parser:
                self._register_parser_plugin(plugin_id, cast(ParserPlugin, supported))

            if has_web_extractor:
                self._register_web_extractor_plugin(plugin_id, cast(WebExtractorPlugin, supported))

            if has_output_type:
                self._register_output_type_plugin(plugin_id, cast(OutputTypePlugin, supported))

            if has_slides_workflow:
                self._register_slides_workflow_plugin(plugin_id, cast(SlidesWorkflowPlugin, supported))

            if has_source_connector:
                self._register_source_connector_plugin(plugin_id, cast(SourceConnectorPlugin, supported))

            self._loaded_entrypoints[plugin_id] = entry_point_value
            self.plugins[plugin_id] = supported
            report.loaded.append(plugin_id)
            log.info(
                "plugin loaded",
                plugin_id=plugin_id,
                entry_point=entry_point_value,
                has_ai_provider=has_ai_provider,
                has_parser=has_parser,
                has_output_type=has_output_type,
                has_slides_workflow=has_slides_workflow,
                has_web_extractor=has_web_extractor,
                has_source_connector=has_source_connector,
            )

        self._load_report = report
        return report

    def _register_parser_plugin(self, plugin_id: str, plugin: ParserPlugin) -> None:
        parser_type = plugin.parser_type

        existing_plugin_id = self._parser_plugin_ids.get(parser_type)
        if existing_plugin_id is not None:
            log.warning(
                "parser plugin conflict; overwriting",
                parser_type=parser_type,
                existing_plugin_id=existing_plugin_id,
                plugin_id=plugin_id,
            )

        self.parsers[parser_type] = plugin
        self._parser_plugin_ids[parser_type] = plugin_id

    def _register_web_extractor_plugin(self, plugin_id: str, plugin: WebExtractorPlugin) -> None:
        extractor_type = plugin.extractor_type

        existing_plugin_id = self._web_extractor_plugin_ids.get(extractor_type)
        if existing_plugin_id is not None:
            log.warning(
                "web extractor plugin conflict; overwriting",
                extractor_type=extractor_type,
                existing_plugin_id=existing_plugin_id,
                plugin_id=plugin_id,
            )

        self.web_extractors[extractor_type] = plugin
        self._web_extractor_plugin_ids[extractor_type] = plugin_id

    def _register_source_connector_plugin(self, plugin_id: str, plugin: SourceConnectorPlugin) -> None:
        existing = self.source_connectors.get(plugin_id)
        if existing is not None:
            log.warning(
                "source connector plugin conflict; overwriting",
                plugin_id=plugin_id,
                existing_display_name=existing.display_name,
                display_name=plugin.display_name,
            )
        self.source_connectors[plugin_id] = plugin

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
        self.frontend_bundles.pop(output_type, None)

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

        if isinstance(plugin, OutputTypeFrontendBundle):
            frontend_bundle = plugin.frontend_bundle
            if frontend_bundle is not None:
                if isinstance(frontend_bundle, FrontendBundleDescriptor):
                    self.frontend_bundles[output_type] = frontend_bundle
                else:
                    log.warning(
                        "OutputTypePlugin.frontend_bundle must be FrontendBundleDescriptor; ignoring",
                        plugin_id=plugin_id,
                        output_type=output_type,
                        frontend_bundle_type=type(frontend_bundle).__name__,
                    )

    def _register_slides_workflow_plugin(self, plugin_id: str, plugin: SlidesWorkflowPlugin) -> None:
        existing = self.slides_workflows.get(plugin_id)
        if existing is not None:
            log.warning(
                "slides workflow plugin conflict; overwriting",
                plugin_id=plugin_id,
                existing_engine=existing.engine,
                engine=plugin.engine,
            )
        self.slides_workflows[plugin_id] = plugin

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

    def _api_compatibility_issue(self, plugin_id: str, plugin: SupportedPlugin) -> PluginSkipDetail | None:
        api_version = plugin.api_version
        if not isinstance(api_version, str):
            log.warning(
                "plugin api_version must be a string; skipping",
                plugin_id=plugin_id,
                api_version_type=type(api_version).__name__,
            )
            supported = sorted(SUPPORTED_PLUGIN_API_VERSIONS)
            return PluginSkipDetail(
                error_code="invalid_api_version",
                message="Plugin api_version must be a string",
                hint=f"Set api_version to one of: {supported!r}",
                details={"api_version_type": type(api_version).__name__},
            )

        if api_version not in SUPPORTED_PLUGIN_API_VERSIONS:
            supported = sorted(SUPPORTED_PLUGIN_API_VERSIONS)
            supported_payload: list[JsonValue] = list(supported)
            log.warning(
                "plugin api_version unsupported; skipping",
                plugin_id=plugin_id,
                api_version=api_version,
                supported=supported,
            )
            return PluginSkipDetail(
                error_code="incompatible_version",
                message="Plugin api_version is not supported by this host",
                hint=f"Update the plugin to api_version {PLUGIN_API_VERSION!r} (supported: {supported!r}).",
                details={
                    "api_version": api_version,
                    "supported": supported_payload,
                },
            )

        return None

    # =============================================================================
    # Query helpers
    # =============================================================================

    def is_provider_available(self, provider_id: str) -> bool:
        return provider_id in {"openai", "ollama"} or provider_id in self.ai_providers

    def list_ai_providers(self) -> list[str]:
        return sorted(self.ai_providers.keys())

    def list_parsers(self) -> list[str]:
        return sorted(self.parsers.keys())

    def list_web_extractors(self) -> list[str]:
        return sorted(self.web_extractors.keys())

    def list_output_types(self) -> list[str]:
        return sorted(self.output_types.keys())

    def list_slides_workflows(self) -> list[str]:
        return sorted(self.slides_workflows.keys())

    def list_source_connectors(self) -> list[str]:
        return sorted(self.source_connectors.keys())

    def get_load_report(self) -> PluginLoadReport:
        return self._load_report

    def get_output_type_plugin_id(self, output_type: str) -> str | None:
        return self._output_type_plugin_ids.get(output_type)

    def get_output_type_entry_point(self, output_type: str) -> str | None:
        plugin_id = self._output_type_plugin_ids.get(output_type)
        if plugin_id is None:
            return None
        return self._loaded_entrypoints.get(plugin_id)

    def get_parser_plugin_id(self, parser_type: str) -> str | None:
        return self._parser_plugin_ids.get(parser_type)

    def get_parser_entry_point(self, parser_type: str) -> str | None:
        plugin_id = self._parser_plugin_ids.get(parser_type)
        if plugin_id is None:
            return None
        return self._loaded_entrypoints.get(plugin_id)

    def get_web_extractor_plugin_id(self, extractor_type: str) -> str | None:
        return self._web_extractor_plugin_ids.get(extractor_type)

    def get_web_extractor_entry_point(self, extractor_type: str) -> str | None:
        plugin_id = self._web_extractor_plugin_ids.get(extractor_type)
        if plugin_id is None:
            return None
        return self._loaded_entrypoints.get(plugin_id)

    def get_output_type_metadata(self, output_type: str) -> OutputTypePluginMeta | None:
        return self.output_type_metadata.get(output_type)

    def get_render_descriptor(self, output_type: str) -> RenderDescriptor | None:
        return self.render_descriptors.get(output_type)

    def get_config_schema(self, output_type: str) -> PluginConfigSchema | None:
        return self.config_schemas.get(output_type)

    def get_frontend_bundle(self, output_type: str) -> FrontendBundleDescriptor | None:
        return self.frontend_bundles.get(output_type)

    def resolve_active_slides_workflow(self, settings: Settings) -> SlidesWorkflowSelection:
        configured_plugin_id = (settings.slides.default_plugin or '').strip() or None
        available_ids = self.list_slides_workflows()
        available_plugin_ids_json: list[JsonValue] = list(available_ids)

        if configured_plugin_id is not None:
            plugin = self.slides_workflows.get(configured_plugin_id)
            if plugin is not None:
                return SlidesWorkflowSelection(plugin_id=configured_plugin_id, plugin=plugin)

            skip_detail = self._load_report.skipped.get(configured_plugin_id)
            details: dict[str, JsonValue] = {
                'configured_plugin_id': configured_plugin_id,
                'available_plugin_ids': available_plugin_ids_json,
            }
            if skip_detail is not None:
                details['plugin_diagnostic'] = skip_detail.to_dict()
            hint = (
                skip_detail.hint
                if skip_detail is not None and skip_detail.hint
                else f"Install or enable {configured_plugin_id!r}, or update slides.default_plugin."
            )
            return SlidesWorkflowSelection(
                error_code='configured_plugin_unavailable',
                message='Configured slides workflow plugin is unavailable',
                hint=hint,
                details=details,
            )

        if not available_ids:
            return SlidesWorkflowSelection(
                error_code='slides_plugin_required',
                message='Slides workflow capability is unavailable because no slides plugin is active',
                hint='Install and enable a slides-* plugin, or set slides.default_plugin after installation.',
                details={'available_plugin_ids': available_plugin_ids_json},
            )

        if len(available_ids) == 1:
            plugin_id = available_ids[0]
            return SlidesWorkflowSelection(plugin_id=plugin_id, plugin=self.slides_workflows[plugin_id])

        return SlidesWorkflowSelection(
            error_code='ambiguous_slides_plugin',
            message='Multiple slides workflow plugins are available but no default is configured',
            hint='Set slides.default_plugin in config/app.yaml to one of the available slides plugin ids.',
            details={'available_plugin_ids': available_plugin_ids_json},
        )
