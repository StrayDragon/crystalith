"""Extractor factory with fallback logic."""

from __future__ import annotations

from typing import TYPE_CHECKING

from cl_logs import get_logger

from .interfaces import BaseExtractor, ExtractionError, Extractor
from .types import ExtractedContent, ExtractorInfo, ExtractorType

if TYPE_CHECKING:
    from crystalith.shared.config.models import WebExtractionSettings
    from crystalith.shared.config.models import UrlFetchSecuritySettings

logger = get_logger(__name__)


class ExtractorFactory:
    """
    Factory for creating and managing web content extractors.

    Supports multiple extraction strategies with automatic fallback:
    - trafilatura: Local extraction (default, always available)
    - jina: Jina Reader API (free, supports JS rendering)
    - firecrawl: External API (requires API key)
    - browserless: Browser rendering (requires service)
    """

    def __init__(
        self,
        settings: "WebExtractionSettings",
        *,
        url_fetch_security: "UrlFetchSecuritySettings | None" = None,
    ):
        """
        Initialize the factory with configuration.

        Args:
            settings: Web extraction configuration.
            url_fetch_security: URL fetch SSRF 安全策略（用于本地抓取器逐跳重定向重验）。
        """
        self.settings = settings
        self.url_fetch_security = url_fetch_security
        self._extractors: dict[ExtractorType, Extractor] = {}
        self._initialized = False

    def _ensure_initialized(self) -> None:
        """Lazily initialize extractors based on configuration."""
        if self._initialized:
            return

        # Initialize Trafilatura (always available)
        if self.settings.trafilatura.enabled:
            from .trafilatura_extractor import TrafilaturaExtractor

            traf_settings = self.settings.trafilatura
            proxy_url = None
            if traf_settings.proxy and traf_settings.proxy.enabled:
                proxy_url = traf_settings.proxy.get_proxy_url()

            self._extractors[ExtractorType.TRAFILATURA] = TrafilaturaExtractor(
                include_tables=traf_settings.include_tables,
                include_links=traf_settings.include_links,
                output_format=traf_settings.output_format,
                timeout=traf_settings.timeout,
                proxy_url=proxy_url,
                url_fetch_security=self.url_fetch_security,
            )

        # Initialize Jina Reader (if enabled)
        if self.settings.jina.enabled:
            from .jina_extractor import JinaReaderExtractor

            jina_settings = self.settings.jina
            proxy_url = None
            if jina_settings.proxy and jina_settings.proxy.enabled:
                proxy_url = jina_settings.proxy.get_proxy_url()

            self._extractors[ExtractorType.JINA] = JinaReaderExtractor(
                api_key=jina_settings.api_key,
                timeout=jina_settings.timeout,
                proxy_url=proxy_url,
            )

        # Initialize Firecrawl (if configured)
        if self.settings.firecrawl.enabled and self.settings.firecrawl.api_key:
            from .firecrawl_extractor import FirecrawlExtractor

            fc_settings = self.settings.firecrawl
            self._extractors[ExtractorType.FIRECRAWL] = FirecrawlExtractor(
                api_key=fc_settings.api_key,
                timeout=fc_settings.timeout,
            )

        # Initialize Browserless (if configured)
        if self.settings.browserless.enabled and self.settings.browserless.endpoint:
            from .browserless_extractor import BrowserlessExtractor

            bl_settings = self.settings.browserless
            self._extractors[ExtractorType.BROWSERLESS] = BrowserlessExtractor(
                endpoint=bl_settings.endpoint,
                token=bl_settings.token,
                timeout=bl_settings.timeout,
                wait_until=bl_settings.wait_until,
            )

        self._initialized = True

    def get_extractor(self, extractor_type: ExtractorType) -> Extractor | None:
        """
        Get a specific extractor by type.

        Args:
            extractor_type: The type of extractor to get.

        Returns:
            The extractor instance or None if not available.
        """
        self._ensure_initialized()
        return self._extractors.get(extractor_type)

    def get_fallback_order(self) -> list[ExtractorType]:
        """
        Get the configured fallback order.

        Returns:
            List of extractor types in priority order.
        """
        # Default order: trafilatura > jina > firecrawl > browserless
        # User can override via settings.fallback_order
        if self.settings.fallback_order:
            return [ExtractorType(t) for t in self.settings.fallback_order]

        return [
            ExtractorType.TRAFILATURA,
            ExtractorType.JINA,
            ExtractorType.FIRECRAWL,
            ExtractorType.BROWSERLESS,
        ]

    def get_available_extractors(self) -> list[ExtractorInfo]:
        """
        Get information about all configured extractors.

        Returns:
            List of ExtractorInfo for each extractor.
        """
        self._ensure_initialized()

        infos: list[ExtractorInfo] = []
        fallback_order = self.get_fallback_order()

        for priority, ext_type in enumerate(fallback_order):
            extractor = self._extractors.get(ext_type)
            enabled = extractor is not None

            # Determine availability based on type
            if ext_type == ExtractorType.TRAFILATURA:
                available = enabled
                requires_api_key = False
                requires_service = False
            elif ext_type == ExtractorType.JINA:
                available = enabled
                requires_api_key = False  # API key is optional for Jina
                requires_service = True  # Uses external service
            elif ext_type == ExtractorType.FIRECRAWL:
                available = enabled and bool(self.settings.firecrawl.api_key)
                requires_api_key = True
                requires_service = False
            elif ext_type == ExtractorType.BROWSERLESS:
                available = enabled and bool(self.settings.browserless.endpoint)
                requires_api_key = False
                requires_service = True
            else:
                available = enabled
                requires_api_key = False
                requires_service = False

            infos.append(ExtractorInfo(
                type=ext_type,
                enabled=enabled,
                available=available,
                display_name=ext_type.display_name,
                description=ext_type.description,
                priority=priority,
                requires_api_key=requires_api_key,
                requires_service=requires_service,
            ))

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
            raise ExtractionError(
                "No extractors available. Please configure at least one extractor.",
                url=url,
            )

        errors: list[tuple[ExtractorType, Exception]] = []

        for ext_type in extraction_order:
            extractor = self._extractors.get(ext_type)
            if extractor is None:
                continue

            try:
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
            if ext_type in self._extractors
        ]

        if preferred and preferred in available:
            # Move preferred to front
            available.remove(preferred)
            available.insert(0, preferred)

        return available

    async def close(self) -> None:
        """Close all extractors and cleanup resources."""
        for extractor in self._extractors.values():
            try:
                await extractor.close()
            except Exception:
                pass

        self._extractors.clear()
        self._initialized = False


def create_extractor(settings: "WebExtractionSettings") -> ExtractorFactory:
    """
    Create an ExtractorFactory with the given settings.

    Args:
        settings: Web extraction configuration.

    Returns:
        Configured ExtractorFactory instance.
    """
    return ExtractorFactory(settings)
