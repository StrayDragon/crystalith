from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from .interfaces import AIProviderPlugin, OutputTypePlugin, ParserPlugin, PLUGIN_API_VERSION


def check_plugin(plugin_id: str, plugin: Any) -> list[str]:
    """
    Lightweight compliance checker for a loaded plugin object.

    Returns:
        A list of human-readable issues. Empty means compliant enough to load.
    """
    issues: list[str] = []

    api_version = getattr(plugin, "api_version", None)
    if api_version is not None and api_version != PLUGIN_API_VERSION:
        issues.append(
            f"api_version mismatch: got {api_version!r}, expected {PLUGIN_API_VERSION!r}"
        )

    has_interface = False

    if isinstance(plugin, AIProviderPlugin):
        has_interface = True
        for attr in ("create_chat_provider", "create_embedding_provider"):
            if not callable(getattr(plugin, attr, None)):
                issues.append(f"AIProviderPlugin missing callable: {attr}")

    if isinstance(plugin, ParserPlugin):
        has_interface = True
        if not isinstance(getattr(plugin, "parser_type", None), str) or not plugin.parser_type:
            issues.append("ParserPlugin.parser_type must be a non-empty string")
        if not isinstance(getattr(plugin, "supported_mime_types", None), set):
            issues.append("ParserPlugin.supported_mime_types must be a set[str]")
        if not isinstance(getattr(plugin, "supported_extensions", None), set):
            issues.append("ParserPlugin.supported_extensions must be a set[str]")
        if not callable(getattr(plugin, "create_parser", None)):
            issues.append("ParserPlugin missing callable: create_parser")

    if isinstance(plugin, OutputTypePlugin):
        has_interface = True
        output_type = getattr(plugin, "output_type", None)
        if not isinstance(output_type, str) or not output_type:
            issues.append("OutputTypePlugin.output_type must be a non-empty string")
        schema = getattr(plugin, "schema", None)
        if not isinstance(schema, type) or not issubclass(schema, BaseModel):
            issues.append("OutputTypePlugin.schema must be a pydantic BaseModel subclass")

    if not has_interface:
        issues.append("plugin does not implement any supported plugin interfaces")

    return issues
