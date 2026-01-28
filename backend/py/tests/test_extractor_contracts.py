"""Contract tests for extractor configuration defaults and overrides."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import pytest

from crystalith.extraction.firecrawl_extractor import FirecrawlExtractor
from crystalith.extraction.jina_extractor import JinaReaderExtractor
from crystalith.extraction.trafilatura_extractor import TrafilaturaExtractor
from crystalith.extraction.types import ExtractedContent, ExtractorType


@dataclass(frozen=True)
class ExtractorContractCase:
    name: str
    factory: Callable[[], object]
    extractor_type: ExtractorType
    assert_defaults: Callable[[object], None]
    custom_factory: Callable[[], object]
    assert_custom: Callable[[object], None]


def assert_trafilatura_defaults(extractor: TrafilaturaExtractor) -> None:
    assert extractor.include_tables is True
    assert extractor.include_links is True
    assert extractor.include_images is False
    assert extractor.include_comments is False
    assert extractor.output_format == "markdown"
    assert extractor.timeout == 30
    assert extractor.proxy_url is None
    assert "Mozilla" in extractor.user_agent


def assert_trafilatura_custom(extractor: TrafilaturaExtractor) -> None:
    assert extractor.include_tables is False
    assert extractor.include_links is False
    assert extractor.include_images is True
    assert extractor.include_comments is True
    assert extractor.output_format == "txt"
    assert extractor.timeout == 60
    assert extractor.user_agent == "CustomAgent/1.0"
    assert extractor.proxy_url == "http://proxy:8080"


def assert_jina_defaults(extractor: JinaReaderExtractor) -> None:
    assert extractor.api_key is None
    assert extractor.timeout == 30
    assert extractor.proxy_url is None
    assert extractor.return_format == "markdown"


def assert_jina_custom(extractor: JinaReaderExtractor) -> None:
    assert extractor.api_key == "jina-test-key"
    assert extractor.timeout == 60
    assert extractor.proxy_url == "http://proxy:8080"
    assert extractor.return_format == "text"


def assert_firecrawl_defaults(extractor: FirecrawlExtractor) -> None:
    assert extractor.api_key is None
    assert extractor.timeout == 60
    assert extractor.formats == ["markdown"]
    assert extractor.only_main_content is True


def assert_firecrawl_custom(extractor: FirecrawlExtractor) -> None:
    assert extractor.api_key == "custom-key"
    assert extractor.timeout == 120
    assert extractor.formats == ["markdown", "html"]
    assert extractor.only_main_content is False


EXTRACTOR_CASES = [
    ExtractorContractCase(
        name="trafilatura",
        factory=TrafilaturaExtractor,
        extractor_type=ExtractorType.TRAFILATURA,
        assert_defaults=assert_trafilatura_defaults,
        custom_factory=lambda: TrafilaturaExtractor(
            include_tables=False,
            include_links=False,
            include_images=True,
            include_comments=True,
            output_format="txt",
            timeout=60,
            user_agent="CustomAgent/1.0",
            proxy_url="http://proxy:8080",
        ),
        assert_custom=assert_trafilatura_custom,
    ),
    ExtractorContractCase(
        name="jina",
        factory=JinaReaderExtractor,
        extractor_type=ExtractorType.JINA,
        assert_defaults=assert_jina_defaults,
        custom_factory=lambda: JinaReaderExtractor(
            api_key="jina-test-key",
            timeout=60,
            proxy_url="http://proxy:8080",
            return_format="text",
        ),
        assert_custom=assert_jina_custom,
    ),
    ExtractorContractCase(
        name="firecrawl",
        factory=FirecrawlExtractor,
        extractor_type=ExtractorType.FIRECRAWL,
        assert_defaults=assert_firecrawl_defaults,
        custom_factory=lambda: FirecrawlExtractor(
            api_key="custom-key",
            timeout=120,
            formats=["markdown", "html"],
            only_main_content=False,
        ),
        assert_custom=assert_firecrawl_custom,
    ),
]


@pytest.mark.parametrize("case", EXTRACTOR_CASES, ids=lambda case: case.name)
def test_extractor_contracts(case: ExtractorContractCase) -> None:
    extractor = case.factory()
    assert extractor.extractor_type == case.extractor_type
    case.assert_defaults(extractor)

    custom = case.custom_factory()
    assert custom.extractor_type == case.extractor_type
    case.assert_custom(custom)


def test_extracted_content_contract() -> None:
    content = ExtractedContent(
        text="One two three four.",
        title="Title",
        author="Author",
        date="2025-01-25",
        description="Description",
        language="en",
        url="https://example.com",
        extractor="trafilatura",
        extraction_time_ms=150,
    )

    assert content.word_count == 4
    assert content.is_empty is False

    metadata = content.to_metadata()
    assert metadata["extractor"] == "trafilatura"
    assert metadata["extraction_time_ms"] == 150
    assert metadata["original_url"] == "https://example.com"
    assert metadata["page_title"] == "Title"
    assert metadata["page_author"] == "Author"
    assert metadata["page_date"] == "2025-01-25"
    assert metadata["page_description"] == "Description"
    assert metadata["page_language"] == "en"
    assert metadata["word_count"] == 4
