from __future__ import annotations

from dataclasses import dataclass, field
from importlib import metadata
from typing import Any

from cl_logs.logging import get_logger

from crystalith.shared.config import Settings

from .interfaces import (
    AIProviderPlugin,
    OutputTypePlugin,
    ParserPlugin,
    PLUGIN_API_VERSION,
)


log = get_logger(__name__)


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
        self.plugins: dict[str, Any] = {}
        self.ai_providers: dict[str, AIProviderPlugin] = {}
        self.parsers: dict[str, ParserPlugin] = {}
        self.output_types: dict[str, OutputTypePlugin] = {}
        self._loaded_entrypoints: dict[str, str] = {}

    def reset(self) -> None:
        self.plugins.clear()
        self.ai_providers.clear()
        self.parsers.clear()
        self.output_types.clear()
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

            if not self._is_api_compatible(plugin_id, plugin):
                report.skipped[plugin_id] = "incompatible_api"
                continue

            registered_any = False

            if isinstance(plugin, AIProviderPlugin):
                self.ai_providers[plugin_id] = plugin
                registered_any = True

            if isinstance(plugin, ParserPlugin):
                self.parsers[plugin.parser_type] = plugin
                registered_any = True

            if isinstance(plugin, OutputTypePlugin):
                self.output_types[plugin.output_type] = plugin
                registered_any = True

            if not registered_any:
                log.warning(
                    "plugin skipped (no compatible interfaces)",
                    plugin_id=plugin_id,
                    entry_point=str(entry_point.value),
                )
                report.skipped[plugin_id] = "no_compatible_interfaces"
                continue

            self._loaded_entrypoints[plugin_id] = str(entry_point.value)
            self.plugins[plugin_id] = plugin
            report.loaded.append(plugin_id)
            log.info(
                "plugin loaded",
                plugin_id=plugin_id,
                entry_point=str(entry_point.value),
                has_ai_provider=plugin_id in self.ai_providers,
                has_parser=isinstance(plugin, ParserPlugin),
                has_output_type=isinstance(plugin, OutputTypePlugin),
            )

        return report

    def _normalize_loaded_plugin(self, plugin_id: str, loaded: Any) -> Any | None:
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

    def _is_api_compatible(self, plugin_id: str, plugin: Any) -> bool:
        api_version = getattr(plugin, "api_version", None)
        if api_version is None:
            return True

        # If the plugin exposes api_version, validate it.
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
