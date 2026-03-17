"""Extractor factory with fallback logic."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import TYPE_CHECKING

from cl_logs import get_logger

from crystalith.shared.config import Settings
from crystalith.shared.plugins import PluginRegistry
from crystalith.shared.plugins.official_catalog import OFFICIAL_PLUGIN_CATALOG

from .interfaces import ConfigurationError, ExtractionError, Extractor
from .types import ExtractedContent, ExtractorInfo, ExtractorType

if TYPE_CHECKING:
    from crystalith.shared.config.models import UrlFetchSecuritySettings

logger = get_logger(__name__)

def _clean_optional_str(value: object | None) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    return str(value).strip()


@dataclass(frozen=True, slots=True)
class _ExtractorState:
    extractor: Extractor | None
    error_code: str | None = None
    message: str | None = None
    recovery_hint: str | None = None
    details: Mapping[str, object] | None = None


class ExtractorFactory:
    """
    Factory for creating and managing web content extractors.

    Supports multiple extraction strategies with automatic fallback.

    Extractor implementations are provided by plugins (WebExtractorPlugin).
    """

    def __init__(
        self,
        settings: Settings,
        *,
        plugins: PluginRegistry,
        url_fetch_security: UrlFetchSecuritySettings | None = None,
        policy_mode: str = "inherit_global",
        enabled_extractors: set[str] | None = None,
    ):
        """
        Initialize the factory with configuration.

        Args:
            settings: Host settings.
            plugins: Plugin registry (extractor implementations are provided by plugins).
            url_fetch_security: URL fetch SSRF 安全策略（用于本地抓取器逐跳重定向重验）。
        """
        self.settings = settings
        self.plugins = plugins
        self.web_settings = settings.source_ingestion.web_extraction
        self.url_fetch_security = url_fetch_security
        self.policy_mode = policy_mode
        self.enabled_extractors = set(enabled_extractors or set())
        self._extractors: dict[ExtractorType, _ExtractorState] = {}
        self._initialized = False

    def _ensure_initialized(self) -> None:
        """Lazily initialize extractors based on configuration."""
        if self._initialized:
            return

        for ext_type in ExtractorType:
            self._extractors[ext_type] = self._build_extractor_state(ext_type)

        self._initialized = True

    def _is_globally_enabled(self, extractor_type: ExtractorType) -> bool:
        if extractor_type == ExtractorType.TRAFILATURA:
            return bool(self.web_settings.trafilatura.enabled)
        if extractor_type == ExtractorType.JINA:
            return bool(self.web_settings.jina.enabled)
        if extractor_type == ExtractorType.FIRECRAWL:
            return bool(self.web_settings.firecrawl.enabled)
        if extractor_type == ExtractorType.BROWSERLESS:
            return bool(self.web_settings.browserless.enabled)
        return False

    def _is_effectively_enabled(self, extractor_type: ExtractorType) -> bool:
        if self.policy_mode == "custom":
            return extractor_type.value in self.enabled_extractors
        return self._is_globally_enabled(extractor_type)

    def _build_extractor_state(self, extractor_type: ExtractorType) -> _ExtractorState:
        default_plugin_id = f"extractor-{extractor_type.value}"
        plugin_id = self.plugins.get_web_extractor_plugin_id(extractor_type.value) or default_plugin_id

        report = self.plugins.get_load_report()
        plugin = self.plugins.web_extractors.get(extractor_type.value)
        if plugin is None:
            skipped = report.skipped.get(default_plugin_id)
            if skipped is not None:
                return _ExtractorState(
                    extractor=None,
                    error_code=skipped.error_code,
                    message=skipped.message,
                    recovery_hint=skipped.hint,
                    details=skipped.to_dict(),
                )
            if default_plugin_id in OFFICIAL_PLUGIN_CATALOG:
                entry = OFFICIAL_PLUGIN_CATALOG[default_plugin_id]
                return _ExtractorState(
                    extractor=None,
                    error_code="not_installed",
                    message="Extractor plugin is not installed",
                    recovery_hint=entry.default_install_hint(),
                    details={"plugin_id": default_plugin_id, "package": entry.package},
                )
            return _ExtractorState(
                extractor=None,
                error_code="not_installed",
                message="Extractor plugin is not installed",
                recovery_hint=f"安装并启用 {default_plugin_id!r} 插件。",
                details={"plugin_id": default_plugin_id},
            )

        if not self._is_effectively_enabled(extractor_type):
            if self.policy_mode == "custom":
                return _ExtractorState(
                    extractor=None,
                    error_code="disabled",
                    message="Extractor disabled by notebook policy",
                    recovery_hint="在该 notebook 中启用此提取器，或切换为 inherit_global 使用全局策略。",
                    details={"plugin_id": plugin_id, "policy": "notebook"},
                )
            return _ExtractorState(
                extractor=None,
                error_code="disabled",
                message="Extractor disabled by configuration",
                recovery_hint=f"在 config/app.yaml 中启用 source_ingestion.web_extraction.{extractor_type.value}.enabled。",
                details={"plugin_id": plugin_id, "policy": "web_extraction"},
            )

        try:
            extractor = plugin.create_extractor(
                self.settings,
                url_fetch_security=self.url_fetch_security,
            )
        except Exception as exc:
            return _ExtractorState(
                extractor=None,
                error_code="init_error",
                message="Extractor plugin failed to initialize",
                recovery_hint="检查插件依赖与配置是否正确。",
                details={"plugin_id": plugin_id, "error": type(exc).__name__},
            )

        return _ExtractorState(extractor=extractor)

    def get_extractor(self, extractor_type: ExtractorType) -> _ExtractorState:
        """
        Get a specific extractor by type.

        Args:
            extractor_type: The type of extractor to get.

        Returns:
            The extractor state (extractor instance + diagnostics).
        """
        self._ensure_initialized()
        return self._extractors.get(extractor_type, self._build_extractor_state(extractor_type))

    def get_fallback_order(self) -> list[ExtractorType]:
        """
        Get the configured fallback order.

        Returns:
            List of extractor types in priority order.
        """
        # Default order: trafilatura > jina > firecrawl > browserless
        # User can override via settings.fallback_order
        if self.web_settings.fallback_order:
            return [ExtractorType(t) for t in self.web_settings.fallback_order]

        return [
            ExtractorType.TRAFILATURA,
            ExtractorType.JINA,
            ExtractorType.FIRECRAWL,
            ExtractorType.BROWSERLESS,
        ]

    async def get_available_extractors(self) -> list[ExtractorInfo]:
        """
        Get information about all configured extractors.

        Returns:
            List of ExtractorInfo for each extractor.
        """
        self._ensure_initialized()

        infos: list[ExtractorInfo] = []
        fallback_order = self.get_fallback_order()
        priority_map = {ext_type: idx for idx, ext_type in enumerate(fallback_order)}

        ordered_types: list[ExtractorType] = []
        seen: set[ExtractorType] = set()
        for ext_type in fallback_order:
            if ext_type in seen:
                continue
            ordered_types.append(ext_type)
            seen.add(ext_type)
        for ext_type in ExtractorType:
            if ext_type in seen:
                continue
            ordered_types.append(ext_type)
            seen.add(ext_type)

        extra_priority = len(priority_map)
        for ext_type in ordered_types:
            priority = priority_map.get(ext_type)
            if priority is None:
                priority = extra_priority
                extra_priority += 1
            default_plugin_id = f"extractor-{ext_type.value}"
            plugin_id = self.plugins.get_web_extractor_plugin_id(ext_type.value) or default_plugin_id
            plugin = self.plugins.web_extractors.get(ext_type.value)

            state = self.get_extractor(ext_type)
            enabled = state.extractor is not None

            available = False
            if enabled and state.extractor is not None:
                try:
                    available = await state.extractor.is_available()
                except Exception:
                    available = False

            error_code = state.error_code
            message = state.message
            recovery_hint = state.recovery_hint
            details = state.details

            if enabled and not available and error_code is None:
                error_code = "unavailable"
                message = "Extractor is unavailable"
                recovery_hint = "检查网络连通性与提取器配置（API key / 服务地址），或稍后重试。"
                details = {"plugin_id": plugin_id}
                if ext_type == ExtractorType.FIRECRAWL and not self.web_settings.firecrawl.api_key:
                    error_code = "missing_config"
                    message = "Firecrawl API key is required"
                    recovery_hint = "在 config/app.yaml 中设置 source_ingestion.web_extraction.firecrawl.api_key。"
                if ext_type == ExtractorType.BROWSERLESS and not self.web_settings.browserless.endpoint:
                    error_code = "missing_config"
                    message = "Browserless endpoint is required"
                    recovery_hint = "在 config/app.yaml 中设置 source_ingestion.web_extraction.browserless.endpoint。"

            requires_api_key = bool(getattr(plugin, "requires_api_key", False)) if plugin is not None else False
            requires_service = bool(getattr(plugin, "requires_service", False)) if plugin is not None else False

            infos.append(
                ExtractorInfo(
                    type=ext_type,
                    enabled=enabled,
                    available=available,
                    display_name=_clean_optional_str(getattr(plugin, "display_name", None)) or ext_type.display_name,
                    description=_clean_optional_str(getattr(plugin, "description", None)) or ext_type.description,
                    priority=priority,
                    requires_api_key=requires_api_key,
                    requires_service=requires_service,
                    plugin_id=plugin_id,
                    error_code=error_code,
                    message=message,
                    recovery_hint=recovery_hint,
                    details=details,
                )
            )

        return infos

    async def extract(
        self,
        url: str,
        *,
        preferred_extractor: ExtractorType | None = None,
        html: str | None = None,
        enable_fallback: bool = True,
    ) -> ExtractedContent:
        """
        Extract content from a URL with automatic fallback.

        Args:
            url: The URL to extract content from.
            preferred_extractor: Preferred extractor type to try first.
            html: Optional pre-fetched HTML content.
            enable_fallback: Whether to try other extractors on failure.

        Returns:
            ExtractedContent with the extracted text and metadata.

        Raises:
            ExtractionError: If all extractors fail.
        """
        self._ensure_initialized()

        # Build extraction order
        extraction_order = self._build_extraction_order(preferred_extractor)

        if not extraction_order:
            raise ConfigurationError(
                "No extractors available. Install/enable an extractor plugin.",
                url=url,
            )

        errors: list[tuple[ExtractorType, Exception]] = []

        for ext_type in extraction_order:
            state = self.get_extractor(ext_type)
            extractor = state.extractor
            if extractor is None:
                continue

            try:
                if not await extractor.is_available():
                    errors.append((ext_type, ExtractionError("Extractor unavailable")))
                    if not enable_fallback:
                        break
                    continue

                logger.info(
                    "Attempting extraction",
                    extractor=ext_type.value,
                    url=url,
                )

                result = await extractor.extract(url, html=html)

                if not result.is_empty:
                    logger.info(
                        "Extraction successful",
                        extractor=ext_type.value,
                        url=url,
                        word_count=result.word_count,
                        time_ms=result.extraction_time_ms,
                    )
                    return result

                logger.warning(
                    "Extractor returned empty content",
                    extractor=ext_type.value,
                    url=url,
                )
                errors.append((ext_type, ExtractionError("Empty content")))

            except Exception as exc:
                logger.warning(
                    "Extraction failed",
                    extractor=ext_type.value,
                    url=url,
                    error=str(exc),
                )
                errors.append((ext_type, exc))

            # Stop if fallback is disabled
            if not enable_fallback:
                break

        # All extractors failed
        error_details = "; ".join(
            f"{ext_type.value}: {exc}"
            for ext_type, exc in errors
        )
        raise ExtractionError(
            f"All extractors failed. Errors: {error_details}",
            url=url,
        )

    def _build_extraction_order(
        self,
        preferred: ExtractorType | None,
    ) -> list[ExtractorType]:
        """Build the extraction order based on preference and availability."""
        fallback_order = self.get_fallback_order()

        # Filter to only available extractors
        available = [
            ext_type for ext_type in fallback_order
            if self.get_extractor(ext_type).extractor is not None
        ]

        if preferred and preferred in available:
            # Move preferred to front
            available.remove(preferred)
            available.insert(0, preferred)

        return available

    async def close(self) -> None:
        """Close all extractors and cleanup resources."""
        for state in self._extractors.values():
            try:
                if state.extractor is not None:
                    await state.extractor.close()
            except Exception:
                pass

        self._extractors.clear()
        self._initialized = False


def create_extractor(settings: Settings, *, plugins: PluginRegistry) -> ExtractorFactory:
    """
    Create an ExtractorFactory with the given settings and plugin registry.

    Args:
        settings: Host settings.
        plugins: Plugin registry.

    Returns:
        Configured ExtractorFactory instance.
    """
    return ExtractorFactory(settings, plugins=plugins)
