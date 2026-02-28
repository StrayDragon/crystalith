from __future__ import annotations

from pydantic import BaseModel

from .interfaces import (
    AIProviderPlugin,
    BasePlugin,
    OutputTypePlugin,
    ParserPlugin,
    SUPPORTED_PLUGIN_API_VERSIONS,
)
from .render_types import OutputTypePluginMeta, PluginConfigSchema, RenderDescriptor


def check_plugin(plugin_id: str, plugin: object) -> list[str]:
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

    if not has_interface:
        issues.append("plugin does not implement any supported plugin interfaces")

    return issues
