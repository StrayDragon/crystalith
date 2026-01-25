"""Tests for JinaReaderExtractor (Jina Reader API web content extraction)."""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from crystalith.extraction.types import ExtractedContent, ExtractorType
from crystalith.extraction.jina_extractor import JinaReaderExtractor
from crystalith.extraction.interfaces import (
    NetworkError,
    ParseError,
    ServiceUnavailableError,
)


class TestJinaReaderExtractor:
    """Tests for JinaReaderExtractor."""

    def test_extractor_type(self):
        """Test that extractor type is correct."""
        extractor = JinaReaderExtractor()
        assert extractor.extractor_type == ExtractorType.JINA

    def test_default_configuration(self):
        """Test default configuration values."""
        extractor = JinaReaderExtractor()
        assert extractor.api_key is None
        assert extractor.timeout == 30
        assert extractor.proxy_url is None
        assert extractor.return_format == "markdown"

    def test_custom_configuration(self):
        """Test custom configuration values."""
        extractor = JinaReaderExtractor(
            api_key="jina-test-key",
            timeout=60,
            proxy_url="http://proxy:8080",
            return_format="text",
        )
        assert extractor.api_key == "jina-test-key"
        assert extractor.timeout == 60
        assert extractor.proxy_url == "http://proxy:8080"
        assert extractor.return_format == "text"

    def test_base_url(self):
        """Test that base URL is correct."""
        assert JinaReaderExtractor.BASE_URL == "https://r.jina.ai/"

    @patch("crystalith.extraction.jina_extractor.httpx.AsyncClient")
    async def test_extract_success(self, mock_client_class):
        """Test successful extraction."""
        mock_response = MagicMock()
        mock_response.text = """# Test Article

This is the main content of the test article.

## Section 1

Some content here with multiple paragraphs.

## Section 2

More content for testing purposes.
"""
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client_class.return_value = mock_client

        extractor = JinaReaderExtractor()
        result = await extractor.extract("https://example.com/article")

        assert isinstance(result, ExtractedContent)
        assert result.extractor == "jina"
        assert result.url == "https://example.com/article"
        assert "Test Article" in result.text
        assert result.title == "Test Article"
        assert result.extraction_time_ms >= 0

    @patch("crystalith.extraction.jina_extractor.httpx.AsyncClient")
    async def test_extract_builds_correct_url(self, mock_client_class):
        """Test that the correct Jina Reader URL is built."""
        mock_response = MagicMock()
        mock_response.text = "# Content"
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client_class.return_value = mock_client

        extractor = JinaReaderExtractor()
        await extractor.extract("https://example.com/page")

        # Check the URL passed to get()
        call_args = mock_client.get.call_args
        assert call_args[0][0] == "https://r.jina.ai/https://example.com/page"

    @patch("crystalith.extraction.jina_extractor.httpx.AsyncClient")
    async def test_extract_with_api_key(self, mock_client_class):
        """Test that API key is included in headers."""
        mock_response = MagicMock()
        mock_response.text = "# Content"
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client_class.return_value = mock_client

        extractor = JinaReaderExtractor(api_key="test-api-key")
        await extractor.extract("https://example.com")

        # Check headers include Authorization
        call_args = mock_client.get.call_args
        headers = call_args[1]["headers"]
        assert headers["Authorization"] == "Bearer test-api-key"

    @patch("crystalith.extraction.jina_extractor.httpx.AsyncClient")
    async def test_extract_empty_content_raises_error(self, mock_client_class):
        """Test that empty content raises ParseError."""
        mock_response = MagicMock()
        mock_response.text = ""
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client_class.return_value = mock_client

        extractor = JinaReaderExtractor()

        with pytest.raises(ParseError) as exc_info:
            await extractor.extract("https://example.com")

        assert "empty" in str(exc_info.value).lower()

    @patch("crystalith.extraction.jina_extractor.httpx.AsyncClient")
    async def test_extract_rate_limit_error(self, mock_client_class):
        """Test that 429 error raises ServiceUnavailableError."""
        import httpx

        mock_response = MagicMock()
        mock_response.status_code = 429

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(
            side_effect=httpx.HTTPStatusError(
                "Rate limit",
                request=MagicMock(),
                response=mock_response,
            )
        )
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client_class.return_value = mock_client

        extractor = JinaReaderExtractor()

        with pytest.raises(ServiceUnavailableError) as exc_info:
            await extractor.extract("https://example.com")

        assert "rate limit" in str(exc_info.value).lower()

    @patch("crystalith.extraction.jina_extractor.httpx.AsyncClient")
    async def test_extract_quota_exceeded_error(self, mock_client_class):
        """Test that 402 error raises ServiceUnavailableError."""
        import httpx

        mock_response = MagicMock()
        mock_response.status_code = 402

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(
            side_effect=httpx.HTTPStatusError(
                "Payment required",
                request=MagicMock(),
                response=mock_response,
            )
        )
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client_class.return_value = mock_client

        extractor = JinaReaderExtractor()

        with pytest.raises(ServiceUnavailableError) as exc_info:
            await extractor.extract("https://example.com")

        assert "quota" in str(exc_info.value).lower()

    @patch("crystalith.extraction.jina_extractor.httpx.AsyncClient")
    async def test_extract_server_error(self, mock_client_class):
        """Test that 5xx error raises ServiceUnavailableError."""
        import httpx

        mock_response = MagicMock()
        mock_response.status_code = 503

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(
            side_effect=httpx.HTTPStatusError(
                "Service unavailable",
                request=MagicMock(),
                response=mock_response,
            )
        )
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client_class.return_value = mock_client

        extractor = JinaReaderExtractor()

        with pytest.raises(ServiceUnavailableError) as exc_info:
            await extractor.extract("https://example.com")

        assert "503" in str(exc_info.value)

    @patch("crystalith.extraction.jina_extractor.httpx.AsyncClient")
    async def test_extract_timeout_error(self, mock_client_class):
        """Test that timeout raises NetworkError."""
        import httpx

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=httpx.TimeoutException("Timeout"))
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client_class.return_value = mock_client

        extractor = JinaReaderExtractor(timeout=10)

        with pytest.raises(NetworkError) as exc_info:
            await extractor.extract("https://example.com")

        assert "timed out" in str(exc_info.value).lower()

    @patch("crystalith.extraction.jina_extractor.httpx.AsyncClient")
    async def test_extract_network_error(self, mock_client_class):
        """Test that network errors raise NetworkError."""
        import httpx

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=httpx.RequestError("Connection refused"))
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client_class.return_value = mock_client

        extractor = JinaReaderExtractor()

        with pytest.raises(NetworkError) as exc_info:
            await extractor.extract("https://example.com")

        assert "network error" in str(exc_info.value).lower()

    def test_extract_metadata_from_markdown_with_title(self):
        """Test metadata extraction from Markdown with H1 title."""
        extractor = JinaReaderExtractor()

        content = """# My Article Title

This is the first paragraph that should be used as description.

## Section 1

More content here.
"""

        title, description = extractor._extract_metadata_from_markdown(content)

        assert title == "My Article Title"
        assert description == "This is the first paragraph that should be used as description."

    def test_extract_metadata_from_markdown_no_title(self):
        """Test metadata extraction when no H1 title exists."""
        extractor = JinaReaderExtractor()

        content = """Just some content without a title.

More paragraphs here.
"""

        title, description = extractor._extract_metadata_from_markdown(content)

        assert title is None

    def test_extract_metadata_from_markdown_skips_links(self):
        """Test that links are skipped when looking for description."""
        extractor = JinaReaderExtractor()

        content = """# Title

[Link to something](https://example.com)

*Some italic text*

This is the actual description paragraph.
"""

        title, description = extractor._extract_metadata_from_markdown(content)

        assert title == "Title"
        assert description == "This is the actual description paragraph."


class TestJinaReaderExtractorAvailability:
    """Tests for JinaReaderExtractor availability check."""

    @patch("crystalith.extraction.jina_extractor.httpx.AsyncClient")
    async def test_is_available_success(self, mock_client_class):
        """Test is_available returns True when service is reachable."""
        mock_response = MagicMock()

        mock_client = AsyncMock()
        mock_client.head = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client_class.return_value = mock_client

        extractor = JinaReaderExtractor()
        result = await extractor.is_available()

        assert result is True

    @patch("crystalith.extraction.jina_extractor.httpx.AsyncClient")
    async def test_is_available_failure(self, mock_client_class):
        """Test is_available returns False when service is unreachable."""
        mock_client = AsyncMock()
        mock_client.head = AsyncMock(side_effect=Exception("Connection failed"))
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client_class.return_value = mock_client

        extractor = JinaReaderExtractor()
        result = await extractor.is_available()

        assert result is False


class TestJinaReaderExtractorIntegration:
    """Integration-style tests for JinaReaderExtractor (mocked)."""

    @patch("crystalith.extraction.jina_extractor.httpx.AsyncClient")
    async def test_full_extraction_flow(self, mock_client_class):
        """Test complete extraction flow with realistic data."""
        realistic_content = """# Understanding Machine Learning

Machine learning is a subset of artificial intelligence that enables systems to learn from data.

## Key Concepts

- **Supervised Learning**: Learning from labeled data
- **Unsupervised Learning**: Finding patterns in unlabeled data
- **Reinforcement Learning**: Learning through trial and error

## Applications

1. Image recognition
2. Natural language processing
3. Recommendation systems

## Conclusion

Machine learning continues to transform various industries.
"""

        mock_response = MagicMock()
        mock_response.text = realistic_content
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client_class.return_value = mock_client

        extractor = JinaReaderExtractor()
        result = await extractor.extract("https://example.com/ml-guide")

        assert isinstance(result, ExtractedContent)
        assert "Machine Learning" in result.text
        assert result.title == "Understanding Machine Learning"
        assert result.extractor == "jina"
        assert result.word_count > 0
        assert result.is_empty is False
        assert "jina_url" in result.extra
        assert result.extra["jina_url"] == "https://r.jina.ai/https://example.com/ml-guide"
