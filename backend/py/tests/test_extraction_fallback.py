"""Focused tests for extractor fallback behavior."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from crystalith.config.models import (
    BrowserlessSettings,
    FirecrawlSettings,
    JinaSettings,
    TrafilaturaSettings,
    WebExtractionSettings,
)
from crystalith.extraction.factory import ExtractorFactory
from crystalith.extraction.interfaces import ExtractionError, ParseError
from crystalith.extraction.types import ExtractedContent, ExtractorType


def build_settings(
    *,
    trafilatura_enabled: bool = True,
    jina_enabled: bool = True,
    firecrawl_enabled: bool = False,
    firecrawl_api_key: str | None = None,
    browserless_enabled: bool = False,
    browserless_endpoint: str = "ws://localhost:3000",
) -> WebExtractionSettings:
    return WebExtractionSettings(
        fallback_order=["trafilatura", "jina", "firecrawl", "browserless"],
        trafilatura=TrafilaturaSettings(enabled=trafilatura_enabled),
        jina=JinaSettings(enabled=jina_enabled),
        firecrawl=FirecrawlSettings(enabled=firecrawl_enabled, api_key=firecrawl_api_key),
        browserless=BrowserlessSettings(
            enabled=browserless_enabled,
            endpoint=browserless_endpoint,
        ),
    )


def test_available_extractors_follow_order() -> None:
    settings = build_settings(
        trafilatura_enabled=True,
        jina_enabled=True,
        firecrawl_enabled=True,
        firecrawl_api_key="fc-key",
        browserless_enabled=True,
    )
    factory = ExtractorFactory(settings)

    order = factory.get_fallback_order()
    assert order == [
        ExtractorType.TRAFILATURA,
        ExtractorType.JINA,
        ExtractorType.FIRECRAWL,
        ExtractorType.BROWSERLESS,
    ]

    infos = factory.get_available_extractors()
    assert [info.type for info in infos] == order
    assert [info.priority for info in infos] == list(range(len(order)))
    assert all(info.enabled for info in infos)


@pytest.mark.asyncio
@patch(
    "crystalith.extraction.trafilatura_extractor.TrafilaturaExtractor.extract",
    new_callable=AsyncMock,
)
@patch(
    "crystalith.extraction.jina_extractor.JinaReaderExtractor.extract",
    new_callable=AsyncMock,
)
async def test_fallback_uses_next_extractor(
    mock_jina_extract: AsyncMock,
    mock_trafilatura_extract: AsyncMock,
) -> None:
    mock_trafilatura_extract.side_effect = ParseError("empty content")
    mock_jina_extract.return_value = ExtractedContent(
        text="ok",
        url="https://example.com",
        extractor="jina",
    )

    factory = ExtractorFactory(
        build_settings(trafilatura_enabled=True, jina_enabled=True)
    )

    result = await factory.extract("https://example.com")

    assert result.extractor == "jina"
    assert mock_trafilatura_extract.call_count == 1
    assert mock_jina_extract.call_count == 1

    mock_trafilatura_extract.reset_mock(side_effect=True)
    mock_trafilatura_extract.side_effect = ParseError("empty content")
    mock_jina_extract.reset_mock()

    with pytest.raises(ExtractionError):
        await factory.extract("https://example.com", enable_fallback=False)

    assert mock_trafilatura_extract.call_count == 1
    assert mock_jina_extract.call_count == 0
