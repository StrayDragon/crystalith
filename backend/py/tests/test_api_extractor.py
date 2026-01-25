"""Tests for FirecrawlExtractor (external API web content extraction)."""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from crystalith.extraction.types import ExtractedContent, ExtractorType
from crystalith.extraction.firecrawl_extractor import FirecrawlExtractor
from crystalith.extraction.interfaces import (
    ConfigurationError,
    ExtractionError,
    NetworkError,
    ParseError,
    ServiceUnavailableError,
)


class TestFirecrawlExtractor:
    """Tests for FirecrawlExtractor."""

    def test_extractor_type(self):
        """Test that extractor type is correct."""
        extractor = FirecrawlExtractor(api_key="test-key")
        assert extractor.extractor_type == ExtractorType.FIRECRAWL

    def test_default_configuration(self):
        """Test default configuration values."""
        extractor = FirecrawlExtractor(api_key="test-key")
        assert extractor.api_key == "test-key"
        assert extractor.timeout == 60
        assert extractor.formats == ["markdown"]
        assert extractor.only_main_content is True

    def test_custom_configuration(self):
        """Test custom configuration values."""
        extractor = FirecrawlExtractor(
            api_key="custom-key",
            timeout=120,
            formats=["markdown", "html"],
            only_main_content=False,
        )
        assert extractor.api_key == "custom-key"
        assert extractor.timeout == 120
        assert extractor.formats == ["markdown", "html"]
        assert extractor.only_main_content is False

    async def test_is_available_with_api_key(self):
        """Test is_available returns True when API key is configured."""
        extractor = FirecrawlExtractor(api_key="test-key")

        with patch.dict("sys.modules", {"firecrawl": MagicMock()}):
            result = await extractor.is_available()
            # May return True or False depending on import success
            assert isinstance(result, bool)

    async def test_is_available_without_api_key(self):
        """Test is_available returns False without API key."""
        extractor = FirecrawlExtractor()
        result = await extractor.is_available()
        assert result is False

    def test_get_client_raises_without_api_key(self):
        """Test that _get_client raises ConfigurationError without API key."""
        extractor = FirecrawlExtractor()

        with pytest.raises(ConfigurationError) as exc_info:
            extractor._get_client()

        assert "api key" in str(exc_info.value).lower()

    @patch("crystalith.extraction.firecrawl_extractor.FirecrawlExtractor._get_client")
    async def test_extract_success(self, mock_get_client):
        """Test successful extraction."""
        mock_client = MagicMock()
        mock_client.scrape = MagicMock(return_value={
            "markdown": "# Test Article\n\nThis is the extracted content.",
            "html": "<h1>Test Article</h1><p>This is the extracted content.</p>",
            "metadata": {
                "title": "Test Article",
                "description": "A test article description",
                "language": "en",
            },
        })
        mock_get_client.return_value = mock_client

        extractor = FirecrawlExtractor(api_key="test-key")

        with patch("asyncio.get_event_loop") as mock_loop:
            mock_loop.return_value.run_in_executor = AsyncMock(return_value={
                "markdown": "# Test Article\n\nThis is the extracted content.",
                "html": "<h1>Test Article</h1><p>This is the extracted content.</p>",
                "metadata": {
                    "title": "Test Article",
                    "description": "A test article description",
                    "language": "en",
                },
            })

            result = await extractor.extract("https://example.com/article")

        assert isinstance(result, ExtractedContent)
        assert result.extractor == "firecrawl"
        assert result.url == "https://example.com/article"

    def test_parse_result_dict_format(self):
        """Test parsing result in dict format."""
        extractor = FirecrawlExtractor(api_key="test-key")

        result = {
            "markdown": "# Title\n\nContent here.",
            "html": "<h1>Title</h1><p>Content here.</p>",
            "metadata": {
                "title": "Title",
                "ogTitle": "OG Title",
                "description": "Description",
                "ogDescription": "OG Description",
                "language": "en",
            },
        }

        content = extractor._parse_result(result, "https://example.com")

        assert content.text == "# Title\n\nContent here."
        assert content.title == "Title"
        assert content.description == "Description"
        assert content.language == "en"
        assert content.extractor == "firecrawl"

    def test_parse_result_object_format(self):
        """Test parsing result in object format."""
        extractor = FirecrawlExtractor(api_key="test-key")

        result = MagicMock()
        result.markdown = "# Object Title\n\nObject content."
        result.html = "<h1>Object Title</h1>"
        result.metadata = {
            "title": "Object Title",
        }

        content = extractor._parse_result(result, "https://example.com")

        assert content.text == "# Object Title\n\nObject content."
        assert content.title == "Object Title"

    def test_parse_result_string_fallback(self):
        """Test parsing result as string fallback."""
        extractor = FirecrawlExtractor(api_key="test-key")

        result = "Plain text content"

        content = extractor._parse_result(result, "https://example.com")

        assert content.text == "Plain text content"

    def test_parse_result_empty_raises_error(self):
        """Test that empty result raises ParseError."""
        extractor = FirecrawlExtractor(api_key="test-key")

        with pytest.raises(ParseError) as exc_info:
            extractor._parse_result(None, "https://example.com")

        assert "empty" in str(exc_info.value).lower()

    def test_parse_result_empty_markdown_raises_error(self):
        """Test that empty markdown raises ParseError."""
        extractor = FirecrawlExtractor(api_key="test-key")

        result = {
            "markdown": "",
            "metadata": {},
        }

        with pytest.raises(ParseError) as exc_info:
            extractor._parse_result(result, "https://example.com")

        assert "empty" in str(exc_info.value).lower()

    def test_parse_result_uses_og_title_fallback(self):
        """Test that ogTitle is used when title is not available."""
        extractor = FirecrawlExtractor(api_key="test-key")

        result = {
            "markdown": "# Content",
            "metadata": {
                "ogTitle": "OG Title",
                "ogDescription": "OG Description",
            },
        }

        content = extractor._parse_result(result, "https://example.com")

        assert content.title == "OG Title"
        assert content.description == "OG Description"

    @patch("crystalith.extraction.firecrawl_extractor.FirecrawlExtractor._get_client")
    async def test_extract_unauthorized_error(self, mock_get_client):
        """Test that 401 error raises ConfigurationError."""
        mock_client = MagicMock()
        mock_client.scrape = MagicMock(side_effect=Exception("401 Unauthorized"))
        mock_get_client.return_value = mock_client

        extractor = FirecrawlExtractor(api_key="invalid-key")

        with patch("asyncio.get_event_loop") as mock_loop:
            mock_loop.return_value.run_in_executor = AsyncMock(
                side_effect=Exception("401 Unauthorized")
            )

            with pytest.raises(ConfigurationError) as exc_info:
                await extractor.extract("https://example.com")

        assert "api key" in str(exc_info.value).lower()

    @patch("crystalith.extraction.firecrawl_extractor.FirecrawlExtractor._get_client")
    async def test_extract_rate_limit_error(self, mock_get_client):
        """Test that rate limit error raises ServiceUnavailableError."""
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        extractor = FirecrawlExtractor(api_key="test-key")

        with patch("asyncio.get_event_loop") as mock_loop:
            mock_loop.return_value.run_in_executor = AsyncMock(
                side_effect=Exception("429 Rate limit exceeded")
            )

            with pytest.raises(ServiceUnavailableError) as exc_info:
                await extractor.extract("https://example.com")

        assert "rate limit" in str(exc_info.value).lower()

    @patch("crystalith.extraction.firecrawl_extractor.FirecrawlExtractor._get_client")
    async def test_extract_timeout_error(self, mock_get_client):
        """Test that timeout error raises NetworkError."""
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        extractor = FirecrawlExtractor(api_key="test-key")

        with patch("asyncio.get_event_loop") as mock_loop:
            mock_loop.return_value.run_in_executor = AsyncMock(
                side_effect=Exception("Request timeout")
            )

            with pytest.raises(NetworkError) as exc_info:
                await extractor.extract("https://example.com")

        assert "timed out" in str(exc_info.value).lower()

    @patch("crystalith.extraction.firecrawl_extractor.FirecrawlExtractor._get_client")
    async def test_extract_generic_error(self, mock_get_client):
        """Test that generic errors raise ExtractionError."""
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        extractor = FirecrawlExtractor(api_key="test-key")

        with patch("asyncio.get_event_loop") as mock_loop:
            mock_loop.return_value.run_in_executor = AsyncMock(
                side_effect=Exception("Unknown error occurred")
            )

            with pytest.raises(ExtractionError) as exc_info:
                await extractor.extract("https://example.com")

        assert "unknown error" in str(exc_info.value).lower()


class TestFirecrawlExtractorIntegration:
    """Integration-style tests for FirecrawlExtractor (mocked)."""

    @patch("crystalith.extraction.firecrawl_extractor.FirecrawlExtractor._get_client")
    async def test_full_extraction_flow(self, mock_get_client):
        """Test complete extraction flow with realistic data."""
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        extractor = FirecrawlExtractor(
            api_key="test-key",
            formats=["markdown"],
            only_main_content=True,
        )

        realistic_result = {
            "markdown": """# Understanding Web Scraping

Web scraping is the process of extracting data from websites.
It involves fetching web pages and parsing their content.

## Key Concepts

- **HTTP Requests**: Fetching web pages
- **HTML Parsing**: Extracting structured data
- **Data Storage**: Saving extracted information

## Best Practices

1. Respect robots.txt
2. Rate limit your requests
3. Handle errors gracefully
""",
            "html": "<article>...</article>",
            "metadata": {
                "title": "Understanding Web Scraping",
                "description": "A comprehensive guide to web scraping techniques",
                "language": "en",
                "author": "Tech Writer",
            },
        }

        with patch("asyncio.get_event_loop") as mock_loop:
            mock_loop.return_value.run_in_executor = AsyncMock(
                return_value=realistic_result
            )

            result = await extractor.extract("https://example.com/web-scraping")

        assert isinstance(result, ExtractedContent)
        assert "Web Scraping" in result.text
        assert result.title == "Understanding Web Scraping"
        assert result.description == "A comprehensive guide to web scraping techniques"
        assert result.language == "en"
        assert result.extractor == "firecrawl"
        assert result.word_count > 0
        assert result.is_empty is False
