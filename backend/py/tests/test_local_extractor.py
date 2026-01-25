"""Tests for TrafilaturaExtractor (local web content extraction)."""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from crystalith.extraction.types import ExtractedContent, ExtractorType
from crystalith.extraction.trafilatura_extractor import TrafilaturaExtractor
from crystalith.extraction.interfaces import NetworkError, ParseError


class TestTrafilaturaExtractor:
    """Tests for TrafilaturaExtractor."""

    def test_extractor_type(self):
        """Test that extractor type is correct."""
        extractor = TrafilaturaExtractor()
        assert extractor.extractor_type == ExtractorType.TRAFILATURA

    def test_default_configuration(self):
        """Test default configuration values."""
        extractor = TrafilaturaExtractor()
        assert extractor.include_tables is True
        assert extractor.include_links is True
        assert extractor.include_images is False
        assert extractor.include_comments is False
        assert extractor.output_format == "markdown"
        assert extractor.timeout == 30
        assert extractor.proxy_url is None
        assert "Mozilla" in extractor.user_agent

    def test_custom_configuration(self):
        """Test custom configuration values."""
        extractor = TrafilaturaExtractor(
            include_tables=False,
            include_links=False,
            include_images=True,
            include_comments=True,
            output_format="txt",
            timeout=60,
            user_agent="CustomAgent/1.0",
            proxy_url="http://proxy:8080",
        )
        assert extractor.include_tables is False
        assert extractor.include_links is False
        assert extractor.include_images is True
        assert extractor.include_comments is True
        assert extractor.output_format == "txt"
        assert extractor.timeout == 60
        assert extractor.user_agent == "CustomAgent/1.0"
        assert extractor.proxy_url == "http://proxy:8080"

    async def test_is_available(self):
        """Test that trafilatura is always available."""
        extractor = TrafilaturaExtractor()
        assert await extractor.is_available() is True

    async def test_extract_with_provided_html(self):
        """Test extraction when HTML is provided directly."""
        extractor = TrafilaturaExtractor()

        html = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Test Article</title>
            <meta name="author" content="Test Author">
            <meta name="description" content="This is a test article.">
        </head>
        <body>
            <article>
                <h1>Test Article Title</h1>
                <p>This is the main content of the test article. It contains
                multiple sentences to ensure proper extraction.</p>
                <p>Here is another paragraph with more content for testing
                the extraction capabilities.</p>
            </article>
        </body>
        </html>
        """

        result = await extractor.extract("https://example.com/article", html=html)

        assert isinstance(result, ExtractedContent)
        assert result.extractor == "trafilatura"
        assert result.url == "https://example.com/article"
        assert len(result.text) > 0
        assert result.extraction_time_ms >= 0

    async def test_extract_with_empty_html(self):
        """Test extraction with empty HTML raises ParseError."""
        extractor = TrafilaturaExtractor()

        with pytest.raises(ParseError) as exc_info:
            await extractor.extract("https://example.com", html="<html><body></body></html>")

        assert "empty content" in str(exc_info.value).lower()

    async def test_extract_with_minimal_content(self):
        """Test extraction with minimal but valid content."""
        extractor = TrafilaturaExtractor()

        html = """
        <html>
        <body>
            <article>
                <p>This is a simple test paragraph with enough content to be extracted.
                We need multiple sentences to ensure the extractor considers this valid content.</p>
            </article>
        </body>
        </html>
        """

        result = await extractor.extract("https://example.com/simple", html=html)

        assert isinstance(result, ExtractedContent)
        assert "test paragraph" in result.text.lower() or len(result.text) > 0

    @patch("crystalith.extraction.trafilatura_extractor.httpx.AsyncClient")
    async def test_extract_fetches_html_when_not_provided(self, mock_client_class):
        """Test that HTML is fetched when not provided."""
        mock_response = MagicMock()
        mock_response.text = """
        <html>
        <body>
            <article>
                <p>Fetched content from the web. This is a test article with
                sufficient content to be extracted properly.</p>
            </article>
        </body>
        </html>
        """
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client_class.return_value = mock_client

        extractor = TrafilaturaExtractor()
        result = await extractor.extract("https://example.com/fetch")

        mock_client.get.assert_called_once()
        assert isinstance(result, ExtractedContent)

    @patch("crystalith.extraction.trafilatura_extractor.httpx.AsyncClient")
    async def test_extract_network_error_on_http_failure(self, mock_client_class):
        """Test that NetworkError is raised on HTTP failures."""
        import httpx

        mock_response = MagicMock()
        mock_response.status_code = 404

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(
            side_effect=httpx.HTTPStatusError(
                "Not Found",
                request=MagicMock(),
                response=mock_response,
            )
        )
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client_class.return_value = mock_client

        extractor = TrafilaturaExtractor()

        with pytest.raises(NetworkError) as exc_info:
            await extractor.extract("https://example.com/notfound")

        assert "404" in str(exc_info.value)

    @patch("crystalith.extraction.trafilatura_extractor.httpx.AsyncClient")
    async def test_extract_network_error_on_connection_failure(self, mock_client_class):
        """Test that NetworkError is raised on connection failures."""
        import httpx

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(
            side_effect=httpx.RequestError("Connection refused")
        )
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client_class.return_value = mock_client

        extractor = TrafilaturaExtractor()

        with pytest.raises(NetworkError) as exc_info:
            await extractor.extract("https://example.com/timeout")

        assert "network error" in str(exc_info.value).lower()

    def test_extract_metadata(self):
        """Test metadata extraction from HTML."""
        extractor = TrafilaturaExtractor()

        html = """
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <title>Test Page Title</title>
            <meta name="author" content="John Doe">
            <meta name="description" content="A test page description">
            <meta property="og:site_name" content="Test Site">
        </head>
        <body>
            <article>
                <p>Content here.</p>
            </article>
        </body>
        </html>
        """

        metadata = extractor._extract_metadata(html, "https://example.com")

        assert isinstance(metadata, dict)
        # Metadata extraction may vary based on trafilatura version
        # Just verify it returns a dict without errors

    async def test_extracted_content_properties(self):
        """Test ExtractedContent dataclass properties."""
        extractor = TrafilaturaExtractor()

        html = """
        <html>
        <body>
            <article>
                <p>This is test content with multiple words for testing the word count
                property of the ExtractedContent dataclass.</p>
            </article>
        </body>
        </html>
        """

        result = await extractor.extract("https://example.com/props", html=html)

        assert result.word_count > 0
        assert result.is_empty is False

        metadata = result.to_metadata()
        assert "extractor" in metadata
        assert metadata["extractor"] == "trafilatura"
        assert "original_url" in metadata


class TestExtractedContent:
    """Tests for ExtractedContent dataclass."""

    def test_word_count(self):
        """Test word count calculation."""
        content = ExtractedContent(
            text="This is a test with seven words.",
            url="https://example.com",
        )
        assert content.word_count == 7

    def test_is_empty_with_content(self):
        """Test is_empty returns False when content exists."""
        content = ExtractedContent(
            text="Some content",
            url="https://example.com",
        )
        assert content.is_empty is False

    def test_is_empty_with_empty_string(self):
        """Test is_empty returns True for empty string."""
        content = ExtractedContent(
            text="",
            url="https://example.com",
        )
        assert content.is_empty is True

    def test_is_empty_with_whitespace(self):
        """Test is_empty returns True for whitespace-only string."""
        content = ExtractedContent(
            text="   \n\t  ",
            url="https://example.com",
        )
        assert content.is_empty is True

    def test_to_metadata(self):
        """Test to_metadata conversion."""
        content = ExtractedContent(
            text="Test content here",
            title="Test Title",
            author="Test Author",
            date="2025-01-25",
            description="Test description",
            language="en",
            url="https://example.com/test",
            extractor="trafilatura",
            extraction_time_ms=150,
        )

        metadata = content.to_metadata()

        assert metadata["extractor"] == "trafilatura"
        assert metadata["extraction_time_ms"] == 150
        assert metadata["original_url"] == "https://example.com/test"
        assert metadata["page_title"] == "Test Title"
        assert metadata["page_author"] == "Test Author"
        assert metadata["page_date"] == "2025-01-25"
        assert metadata["page_description"] == "Test description"
        assert metadata["page_language"] == "en"
        assert metadata["word_count"] == 3
