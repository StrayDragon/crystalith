"""Jina Reader API-based web content extractor."""

from __future__ import annotations

import time

import httpx

from .interfaces import (
    BaseExtractor,
    NetworkError,
    ParseError,
    ServiceUnavailableError,
)
from .types import ExtractedContent, ExtractorType


class JinaReaderExtractor(BaseExtractor):
    """
    Web content extractor using Jina Reader API.

    Jina Reader (r.jina.ai) is a free service that converts web pages to
    clean Markdown content. It handles JavaScript rendering and returns
    well-formatted text suitable for LLM consumption.

    Usage:
        Simply prefix any URL with https://r.jina.ai/ to get Markdown output.
        Example: https://r.jina.ai/https://example.com

    Features:
        - Free tier with generous limits
        - Returns clean Markdown
        - Handles JavaScript rendering
        - No API key required for basic usage
    """

    BASE_URL = "https://r.jina.ai/"

    def __init__(
        self,
        *,
        api_key: str | None = None,
        timeout: int = 30,
        proxy_url: str | None = None,
        return_format: str = "markdown",
    ):
        """
        Initialize the Jina Reader extractor.

        Args:
            api_key: Optional API key for higher rate limits.
            timeout: Request timeout in seconds.
            proxy_url: HTTP proxy URL.
            return_format: Output format (markdown, text, html).
        """
        self.api_key = api_key
        self.timeout = timeout
        self.proxy_url = proxy_url
        self.return_format = return_format

    @property
    def extractor_type(self) -> ExtractorType:
        return ExtractorType.JINA

    async def extract(self, url: str, html: str | None = None) -> ExtractedContent:
        """
        Extract content from a URL using Jina Reader API.

        Args:
            url: The URL to extract content from.
            html: Ignored - Jina Reader fetches content directly.

        Returns:
            ExtractedContent with the extracted text and metadata.
        """
        start_time = time.perf_counter()

        # Build the Jina Reader URL
        jina_url = f"{self.BASE_URL}{url}"

        # Build headers
        headers = {
            "Accept": "text/plain",
            "User-Agent": "Crystalith/1.0",
        }

        # Add API key if provided
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        # Add format header
        if self.return_format == "html":
            headers["X-Return-Format"] = "html"
        elif self.return_format == "text":
            headers["X-Return-Format"] = "text"
        # Default is markdown, no header needed

        try:
            async with httpx.AsyncClient(
                timeout=float(self.timeout),
                follow_redirects=True,
                proxy=self.proxy_url,
            ) as client:
                response = await client.get(jina_url, headers=headers)
                response.raise_for_status()
                content = response.text
        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code
            if status_code == 429:
                raise self._create_error(
                    "Jina Reader rate limit exceeded",
                    url=url,
                    error_class=ServiceUnavailableError,
                ) from exc
            if status_code == 402:
                raise self._create_error(
                    "Jina Reader quota exceeded, API key may be required",
                    url=url,
                    error_class=ServiceUnavailableError,
                ) from exc
            if status_code >= 500:
                raise self._create_error(
                    f"Jina Reader service error: HTTP {status_code}",
                    url=url,
                    error_class=ServiceUnavailableError,
                ) from exc
            raise self._create_error(
                f"Jina Reader request failed: HTTP {status_code}",
                url=url,
                error_class=NetworkError,
            ) from exc
        except httpx.TimeoutException as exc:
            raise self._create_error(
                f"Jina Reader request timed out after {self.timeout}s",
                url=url,
                error_class=NetworkError,
            ) from exc
        except httpx.RequestError as exc:
            raise self._create_error(
                f"Network error: {exc}",
                url=url,
                error_class=NetworkError,
            ) from exc

        # Parse the response
        if not content or not content.strip():
            raise self._create_error(
                "Jina Reader returned empty content",
                url=url,
                error_class=ParseError,
            )

        # Extract metadata from the Markdown content
        title, description = self._extract_metadata_from_markdown(content)

        extraction_time_ms = int((time.perf_counter() - start_time) * 1000)

        return ExtractedContent(
            text=content,
            title=title,
            description=description,
            url=url,
            extractor=self.extractor_type.value,
            extraction_time_ms=extraction_time_ms,
            extra={
                "jina_url": jina_url,
                "return_format": self.return_format,
            },
        )

    def _extract_metadata_from_markdown(self, content: str) -> tuple[str | None, str | None]:
        """
        Extract title and description from Markdown content.

        Jina Reader typically returns content with the title as the first H1.
        """
        title: str | None = None
        description: str | None = None

        lines = content.strip().split("\n")

        for line in lines:
            line = line.strip()

            # Look for H1 title
            if line.startswith("# ") and title is None:
                title = line[2:].strip()
                continue

            # Look for first non-empty paragraph as description
            if (
                title
                and line
                and not line.startswith("#")
                and description is None
                and not line.startswith("[")
                and not line.startswith("*")
            ):
                description = line[:200]  # Truncate long descriptions
                break

        return title, description

    async def is_available(self) -> bool:
        """
        Check if Jina Reader service is available.

        Jina Reader is a public service, so we just check basic connectivity.
        """
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                # Use a simple test URL
                await client.head(
                    f"{self.BASE_URL}https://example.com",
                    follow_redirects=True,
                )
                # Any response (even error) means the service is reachable
                return True
        except Exception:
            return False
