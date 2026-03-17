from __future__ import annotations

from pydantic import BaseModel

from .interfaces import (
    SUPPORTED_PLUGIN_API_VERSIONS,
    AIProviderPlugin,
    BasePlugin,
    OutputTypeFrontendBundle,
    OutputTypePlugin,
    ParserPlugin,
    SlidesWorkflowPlugin,
    SourceConnectorPlugin,
    WebExtractorPlugin,
)
from .render_types import (
    FrontendBundleDescriptor,
    OutputTypePluginMeta,
    PluginConfigSchema,
    PreviewDescriptor,
    RenderDescriptor,
)


def check_plugin(_plugin_id: str, plugin: object) -> list[str]:
    """
    Lightweight compliance checker for a loaded plugin object.

    Returns:
        A list of human-readable issues. Empty means compliant enough to load.
    """
    issues: list[str] = []

    has_interface = False

    if isinstance(plugin, BasePlugin) and plugin.api_version not in SUPPORTED_PLUGIN_API_VERSIONS:
        supported = sorted(SUPPORTED_PLUGIN_API_VERSIONS)
        issues.append(f"api_version mismatch: got {plugin.api_version!r}, supported {supported!r}")

    if isinstance(plugin, AIProviderPlugin):
        has_interface = True
        if not callable(plugin.create_chat_provider):
            issues.append("AIProviderPlugin missing callable: create_chat_provider")
        if not callable(plugin.create_embedding_provider):
            issues.append("AIProviderPlugin missing callable: create_embedding_provider")

    if isinstance(plugin, ParserPlugin):
        has_interface = True
        if not isinstance(plugin.parser_type, str) or not plugin.parser_type:
            issues.append("ParserPlugin.parser_type must be a non-empty string")
        if not isinstance(plugin.supported_mime_types, set):
            issues.append("ParserPlugin.supported_mime_types must be a set[str]")
        if not isinstance(plugin.supported_extensions, set):
            issues.append("ParserPlugin.supported_extensions must be a set[str]")
        if not callable(plugin.create_parser):
            issues.append("ParserPlugin missing callable: create_parser")

    if isinstance(plugin, OutputTypePlugin):
        has_interface = True
        if not isinstance(plugin.output_type, str) or not plugin.output_type:
            issues.append("OutputTypePlugin.output_type must be a non-empty string")
        if not isinstance(plugin.schema, type) or not issubclass(plugin.schema, BaseModel):
            issues.append("OutputTypePlugin.schema must be a pydantic BaseModel subclass")

        metadata = plugin.metadata
        if metadata is not None and not isinstance(metadata, OutputTypePluginMeta):
            issues.append("OutputTypePlugin.metadata must be an OutputTypePluginMeta instance")

        render_descriptor = plugin.render_descriptor
        if render_descriptor is not None and not isinstance(render_descriptor, RenderDescriptor):
            issues.append("OutputTypePlugin.render_descriptor must be a RenderDescriptor instance")

        config_schema = plugin.config_schema
        if config_schema is not None and not isinstance(config_schema, PluginConfigSchema):
            issues.append("OutputTypePlugin.config_schema must be a PluginConfigSchema instance")

        if isinstance(plugin, OutputTypeFrontendBundle):
            frontend_bundle = plugin.frontend_bundle
            if frontend_bundle is not None and not isinstance(frontend_bundle, FrontendBundleDescriptor):
                issues.append("OutputTypePlugin.frontend_bundle must be a FrontendBundleDescriptor instance")

    if isinstance(plugin, SlidesWorkflowPlugin):
        has_interface = True
        if not isinstance(plugin.engine, str) or not plugin.engine:
            issues.append("SlidesWorkflowPlugin.engine must be a non-empty string")
        metadata = plugin.metadata
        if metadata is not None and not isinstance(metadata, OutputTypePluginMeta):
            issues.append("SlidesWorkflowPlugin.metadata must be an OutputTypePluginMeta instance")
        if not isinstance(plugin.config_schema, PluginConfigSchema):
            issues.append("SlidesWorkflowPlugin.config_schema must be a PluginConfigSchema instance")
        preview_descriptor = plugin.preview_descriptor
        if preview_descriptor is not None and not isinstance(preview_descriptor, PreviewDescriptor):
            issues.append("SlidesWorkflowPlugin.preview_descriptor must be a PreviewDescriptor instance")
        frontend_bundle = plugin.frontend_bundle
        if frontend_bundle is not None and not isinstance(frontend_bundle, FrontendBundleDescriptor):
            issues.append("SlidesWorkflowPlugin.frontend_bundle must be a FrontendBundleDescriptor instance")
        if not callable(plugin.generate_outline):
            issues.append("SlidesWorkflowPlugin missing callable: generate_outline")
        if not callable(plugin.generate_markdown):
            issues.append("SlidesWorkflowPlugin missing callable: generate_markdown")

    if isinstance(plugin, WebExtractorPlugin):
        has_interface = True
        if not isinstance(plugin.extractor_type, str) or not plugin.extractor_type:
            issues.append("WebExtractorPlugin.extractor_type must be a non-empty string")
        if plugin.display_name is not None and not isinstance(plugin.display_name, str):
            issues.append("WebExtractorPlugin.display_name must be a string or None")
        if plugin.description is not None and not isinstance(plugin.description, str):
            issues.append("WebExtractorPlugin.description must be a string or None")
        if not isinstance(plugin.requires_api_key, bool):
            issues.append("WebExtractorPlugin.requires_api_key must be a bool")
        if not isinstance(plugin.requires_service, bool):
            issues.append("WebExtractorPlugin.requires_service must be a bool")
        if not callable(plugin.create_extractor):
            issues.append("WebExtractorPlugin missing callable: create_extractor")

    if isinstance(plugin, SourceConnectorPlugin):
        has_interface = True
        if not isinstance(plugin.display_name, str) or not plugin.display_name.strip():
            issues.append("SourceConnectorPlugin.display_name must be a non-empty string")
        if plugin.description is not None and not isinstance(plugin.description, str):
            issues.append("SourceConnectorPlugin.description must be a string or None")
        if not isinstance(plugin.connection_config_schema, dict):
            issues.append("SourceConnectorPlugin.connection_config_schema must be a JSON Schema dict")
        if not isinstance(plugin.supports_snapshot, bool):
            issues.append("SourceConnectorPlugin.supports_snapshot must be a bool")
        if not isinstance(plugin.supports_sync_check, bool):
            issues.append("SourceConnectorPlugin.supports_sync_check must be a bool")
        if not callable(plugin.get_diagnostics):
            issues.append("SourceConnectorPlugin missing callable: get_diagnostics")
        if not callable(plugin.list_snapshot_entries):
            issues.append("SourceConnectorPlugin missing callable: list_snapshot_entries")
        if not callable(plugin.read_file_bytes):
            issues.append("SourceConnectorPlugin missing callable: read_file_bytes")

    if not has_interface:
        issues.append("plugin does not implement any supported plugin interfaces")

    return issues
