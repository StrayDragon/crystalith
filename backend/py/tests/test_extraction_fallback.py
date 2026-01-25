"""Tests for ExtractorFactory and fallback logic."""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from crystalith.extraction.types import ExtractedContent, ExtractorType, ExtractorInfo
from crystalith.extraction.factory import ExtractorFactory, create_extractor
from crystalith.extraction.interfaces import (
    ExtractionError,
    NetworkError,
    ParseError,
)
from crystalith.config.models import (
    WebExtractionSettings,
    TrafilaturaSettings,
    FirecrawlSettings,
    BrowserlessSettings,
)


def create_test_settings(
    *,
    trafilatura_enabled: bool = True,
    firecrawl_enabled: bool = False,
    firecrawl_api_key: str | None = None,
    browserless_enabled: bool = False,
    browserless_endpoint: str = "ws://localhost:3000",
    fallback_order: list[str] | None = None,
    enable_fallback: bool = True,
) -> WebExtractionSettings:
    """Create test settings with specified configuration."""
    return WebExtractionSettings(
        fallback_order=fallback_order or ["trafilatura", "firecrawl", "browserless"],
        enable_fallback=enable_fallback,
        trafilatura=TrafilaturaSettings(enabled=trafilatura_enabled),
        firecrawl=FirecrawlSettings(
            enabled=firecrawl_enabled,
            api_key=firecrawl_api_key,
        ),
        browserless=BrowserlessSettings(
            enabled=browserless_enabled,
            endpoint=browserless_endpoint,
        ),
    )


class TestExtractorFactory:
    """Tests for ExtractorFactory."""

    def test_create_factory(self):
        """Test factory creation."""
        settings = create_test_settings()
        factory = ExtractorFactory(settings)

        assert factory.settings == settings
        assert factory._initialized is False

    def test_lazy_initialization(self):
        """Test that extractors are lazily initialized."""
        settings = create_test_settings()
        factory = ExtractorFactory(settings)

        assert factory._initialized is False
        assert len(factory._extractors) == 0

        # Trigger initialization
        factory._ensure_initialized()

        assert factory._initialized is True
        assert ExtractorType.TRAFILATURA in factory._extractors

    def test_get_extractor_trafilatura(self):
        """Test getting trafilatura extractor."""
        settings = create_test_settings(trafilatura_enabled=True)
        factory = ExtractorFactory(settings)

        extractor = factory.get_extractor(ExtractorType.TRAFILATURA)

        assert extractor is not None
        assert extractor.extractor_type == ExtractorType.TRAFILATURA

    def test_get_extractor_disabled(self):
        """Test getting disabled extractor returns None."""
        settings = create_test_settings(trafilatura_enabled=False)
        factory = ExtractorFactory(settings)

        extractor = factory.get_extractor(ExtractorType.TRAFILATURA)

        assert extractor is None

    def test_get_extractor_firecrawl_without_key(self):
        """Test firecrawl extractor not created without API key."""
        settings = create_test_settings(
            firecrawl_enabled=True,
            firecrawl_api_key=None,
        )
        factory = ExtractorFactory(settings)

        extractor = factory.get_extractor(ExtractorType.FIRECRAWL)

        assert extractor is None

    def test_get_extractor_firecrawl_with_key(self):
        """Test firecrawl extractor created with API key."""
        settings = create_test_settings(
            firecrawl_enabled=True,
            firecrawl_api_key="test-api-key",
        )
        factory = ExtractorFactory(settings)

        extractor = factory.get_extractor(ExtractorType.FIRECRAWL)

        assert extractor is not None
        assert extractor.extractor_type == ExtractorType.FIRECRAWL

    def test_get_fallback_order_default(self):
        """Test default fallback order."""
        settings = create_test_settings()
        factory = ExtractorFactory(settings)

        order = factory.get_fallback_order()

        assert order == [
            ExtractorType.TRAFILATURA,
            ExtractorType.FIRECRAWL,
            ExtractorType.BROWSERLESS,
        ]

    def test_get_fallback_order_custom(self):
        """Test custom fallback order."""
        settings = create_test_settings(
            fallback_order=["firecrawl", "trafilatura", "browserless"]
        )
        factory = ExtractorFactory(settings)

        order = factory.get_fallback_order()

        assert order == [
            ExtractorType.FIRECRAWL,
            ExtractorType.TRAFILATURA,
            ExtractorType.BROWSERLESS,
        ]

    def test_get_available_extractors(self):
        """Test getting available extractors info."""
        settings = create_test_settings(
            trafilatura_enabled=True,
            firecrawl_enabled=True,
            firecrawl_api_key="test-key",
        )
        factory = ExtractorFactory(settings)

        infos = factory.get_available_extractors()

        assert len(infos) == 3
        assert all(isinstance(info, ExtractorInfo) for info in infos)

        # Check trafilatura info
        traf_info = next(i for i in infos if i.type == ExtractorType.TRAFILATURA)
        assert traf_info.enabled is True
        assert traf_info.available is True
        assert traf_info.requires_api_key is False

        # Check firecrawl info
        fc_info = next(i for i in infos if i.type == ExtractorType.FIRECRAWL)
        assert fc_info.enabled is True
        assert fc_info.available is True
        assert fc_info.requires_api_key is True

    def test_get_available_extractors_priority(self):
        """Test that extractors have correct priority."""
        settings = create_test_settings()
        factory = ExtractorFactory(settings)

        infos = factory.get_available_extractors()

        # Check priorities match fallback order
        priorities = {info.type: info.priority for info in infos}
        assert priorities[ExtractorType.TRAFILATURA] < priorities[ExtractorType.FIRECRAWL]
        assert priorities[ExtractorType.FIRECRAWL] < priorities[ExtractorType.BROWSERLESS]


class TestExtractorFactoryExtraction:
    """Tests for ExtractorFactory extraction with fallback."""

    @patch("crystalith.extraction.trafilatura_extractor.TrafilaturaExtractor.extract")
    async def test_extract_success_first_try(self, mock_extract):
        """Test successful extraction on first try."""
        mock_extract.return_value = ExtractedContent(
            text="Extracted content",
            url="https://example.com",
            extractor="trafilatura",
        )

        settings = create_test_settings()
        factory = ExtractorFactory(settings)

        result = await factory.extract("https://example.com")

        assert result.text == "Extracted content"
        assert result.extractor == "trafilatura"
        mock_extract.assert_called_once()

    @patch("crystalith.extraction.trafilatura_extractor.TrafilaturaExtractor.extract")
    async def test_extract_with_preferred_extractor(self, mock_extract):
        """Test extraction with preferred extractor."""
        mock_extract.return_value = ExtractedContent(
            text="Content",
            url="https://example.com",
            extractor="trafilatura",
        )

        settings = create_test_settings()
        factory = ExtractorFactory(settings)

        result = await factory.extract(
            "https://example.com",
            preferred_extractor=ExtractorType.TRAFILATURA,
        )

        assert result.extractor == "trafilatura"

    @patch("crystalith.extraction.firecrawl_extractor.FirecrawlExtractor.extract")
    @patch("crystalith.extraction.trafilatura_extractor.TrafilaturaExtractor.extract")
    async def test_extract_fallback_on_failure(self, mock_traf_extract, mock_fc_extract):
        """Test fallback to next extractor on failure."""
        mock_traf_extract.side_effect = ParseError("Extraction failed", extractor="trafilatura")
        mock_fc_extract.return_value = ExtractedContent(
            text="Firecrawl content",
            url="https://example.com",
            extractor="firecrawl",
        )

        settings = create_test_settings(
            trafilatura_enabled=True,
            firecrawl_enabled=True,
            firecrawl_api_key="test-key",
        )
        factory = ExtractorFactory(settings)

        result = await factory.extract("https://example.com")

        assert result.extractor == "firecrawl"
        mock_traf_extract.assert_called_once()
        mock_fc_extract.assert_called_once()

    @patch("crystalith.extraction.trafilatura_extractor.TrafilaturaExtractor.extract")
    async def test_extract_no_fallback_when_disabled(self, mock_extract):
        """Test that fallback is skipped when disabled."""
        mock_extract.side_effect = ParseError("Extraction failed", extractor="trafilatura")

        settings = create_test_settings(
            trafilatura_enabled=True,
            firecrawl_enabled=True,
            firecrawl_api_key="test-key",
        )
        factory = ExtractorFactory(settings)

        with pytest.raises(ExtractionError):
            await factory.extract(
                "https://example.com",
                enable_fallback=False,
            )

    @patch("crystalith.extraction.trafilatura_extractor.TrafilaturaExtractor.extract")
    async def test_extract_all_fail_raises_error(self, mock_extract):
        """Test that error is raised when all extractors fail."""
        mock_extract.side_effect = ParseError("Extraction failed", extractor="trafilatura")

        settings = create_test_settings(trafilatura_enabled=True)
        factory = ExtractorFactory(settings)

        with pytest.raises(ExtractionError) as exc_info:
            await factory.extract("https://example.com")

        assert "all extractors failed" in str(exc_info.value).lower()

    async def test_extract_no_extractors_available(self):
        """Test error when no extractors are available."""
        settings = create_test_settings(
            trafilatura_enabled=False,
            firecrawl_enabled=False,
            browserless_enabled=False,
        )
        factory = ExtractorFactory(settings)

        with pytest.raises(ExtractionError) as exc_info:
            await factory.extract("https://example.com")

        assert "no extractors available" in str(exc_info.value).lower()

    @patch("crystalith.extraction.trafilatura_extractor.TrafilaturaExtractor.extract")
    async def test_extract_empty_content_triggers_fallback(self, mock_extract):
        """Test that empty content triggers fallback."""
        mock_extract.return_value = ExtractedContent(
            text="",  # Empty content
            url="https://example.com",
            extractor="trafilatura",
        )

        settings = create_test_settings(trafilatura_enabled=True)
        factory = ExtractorFactory(settings)

        # Should fail because trafilatura returns empty and no other extractors
        with pytest.raises(ExtractionError):
            await factory.extract("https://example.com")

    @patch("crystalith.extraction.trafilatura_extractor.TrafilaturaExtractor.extract")
    async def test_extract_with_html_provided(self, mock_extract):
        """Test extraction with pre-fetched HTML."""
        mock_extract.return_value = ExtractedContent(
            text="Content from HTML",
            url="https://example.com",
            extractor="trafilatura",
        )

        settings = create_test_settings()
        factory = ExtractorFactory(settings)

        html = "<html><body>Test content</body></html>"
        result = await factory.extract("https://example.com", html=html)

        mock_extract.assert_called_once_with("https://example.com", html=html)
        assert result.text == "Content from HTML"


class TestExtractorFactoryBuildOrder:
    """Tests for extraction order building."""

    def test_build_extraction_order_default(self):
        """Test default extraction order."""
        settings = create_test_settings(
            trafilatura_enabled=True,
            firecrawl_enabled=True,
            firecrawl_api_key="key",
        )
        factory = ExtractorFactory(settings)
        factory._ensure_initialized()

        order = factory._build_extraction_order(None)

        assert order[0] == ExtractorType.TRAFILATURA
        assert ExtractorType.FIRECRAWL in order

    def test_build_extraction_order_with_preferred(self):
        """Test extraction order with preferred extractor."""
        settings = create_test_settings(
            trafilatura_enabled=True,
            firecrawl_enabled=True,
            firecrawl_api_key="key",
        )
        factory = ExtractorFactory(settings)
        factory._ensure_initialized()

        order = factory._build_extraction_order(ExtractorType.FIRECRAWL)

        assert order[0] == ExtractorType.FIRECRAWL
        assert ExtractorType.TRAFILATURA in order

    def test_build_extraction_order_unavailable_preferred(self):
        """Test extraction order when preferred is unavailable."""
        settings = create_test_settings(
            trafilatura_enabled=True,
            firecrawl_enabled=False,
        )
        factory = ExtractorFactory(settings)
        factory._ensure_initialized()

        # Firecrawl is not available, should not affect order
        order = factory._build_extraction_order(ExtractorType.FIRECRAWL)

        assert ExtractorType.FIRECRAWL not in order
        assert order[0] == ExtractorType.TRAFILATURA


class TestExtractorFactoryClose:
    """Tests for factory cleanup."""

    async def test_close_cleans_up(self):
        """Test that close cleans up resources."""
        settings = create_test_settings()
        factory = ExtractorFactory(settings)
        factory._ensure_initialized()

        assert factory._initialized is True

        await factory.close()

        assert factory._initialized is False
        assert len(factory._extractors) == 0

    async def test_close_handles_extractor_errors(self):
        """Test that close handles errors gracefully."""
        settings = create_test_settings(
            browserless_enabled=True,
        )
        factory = ExtractorFactory(settings)
        factory._ensure_initialized()

        # Should not raise even if close fails
        await factory.close()


class TestCreateExtractor:
    """Tests for create_extractor helper function."""

    def test_create_extractor(self):
        """Test create_extractor helper."""
        settings = create_test_settings()
        factory = create_extractor(settings)

        assert isinstance(factory, ExtractorFactory)
        assert factory.settings == settings


class TestExtractorInfo:
    """Tests for ExtractorInfo dataclass."""

    def test_to_dict(self):
        """Test ExtractorInfo to_dict conversion."""
        info = ExtractorInfo(
            type=ExtractorType.TRAFILATURA,
            enabled=True,
            available=True,
            display_name="本地提取 (Trafilatura)",
            description="使用本地 trafilatura 库提取网页正文",
            priority=0,
            requires_api_key=False,
            requires_service=False,
        )

        result = info.to_dict()

        assert result["type"] == "trafilatura"
        assert result["enabled"] is True
        assert result["available"] is True
        assert result["display_name"] == "本地提取 (Trafilatura)"
        assert result["priority"] == 0
        assert result["requires_api_key"] is False
        assert result["requires_service"] is False
