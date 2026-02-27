"""Firecrawl API-based web content extractor."""

from __future__ import annotations

import time
from collections.abc import Mapping
from typing import Protocol, TypedDict, cast, runtime_checkable

from .interfaces import (
    BaseExtractor,
    ConfigurationError,
    ExtractionError,
    NetworkError,
    ParseError,
    ServiceUnavailableError,
)
from .types import ExtractedContent, ExtractorType


class _FirecrawlResultDict(TypedDict, total=False):
    markdown: str
    html: str
    metadata: dict[str, object]


@runtime_checkable
class _FirecrawlResultObject(Protocol):
    markdown: str
    html: str | None
    metadata: dict[str, object] | None


class _FirecrawlClient(Protocol):
    def scrape(
        self,
        url: str,
        *,
        formats: list[str],
        only_main_content: bool,
        timeout: int,
    ) -> object: ...


class FirecrawlExtractor(BaseExtractor):
    """
    Web content extractor using Firecrawl API.

    Firecrawl is a powerful web scraping API that handles JavaScript rendering,
    anti-bot measures, and returns clean markdown content.

    Requires an API key from https://firecrawl.dev
    """

    def __init__(
        self,
        *,
        api_key: str | None = None,
        timeout: int = 60,
        formats: list[str] | None = None,
        only_main_content: bool = True,
    ):
        """
        Initialize the Firecrawl extractor.

        Args:
            api_key: Firecrawl API key. Required for API calls.
            timeout: Request timeout in seconds.
            formats: Output formats to request (default: ["markdown"]).
            only_main_content: Extract only main content, excluding headers/footers.
        """
        self.api_key = api_key
        self.timeout = timeout
        self.formats = formats or ["markdown"]
        self.only_main_content = only_main_content
        self._client: object | None = None

    @property
    def extractor_type(self) -> ExtractorType:
        return ExtractorType.FIRECRAWL

    def _get_client(self) -> _FirecrawlClient:
        """Get or create the Firecrawl client."""
        if self._client is None:
            if not self.api_key:
                raise self._create_error(
                    "Firecrawl API key is required",
                    error_class=ConfigurationError,
                )

            try:
                from firecrawl import Firecrawl
                self._client = Firecrawl(api_key=self.api_key)
            except ImportError as exc:
                raise self._create_error(
                    "firecrawl-py package is not installed. "
                    "Install it with: pip install firecrawl-py",
                    error_class=ConfigurationError,
                ) from exc

        return cast(_FirecrawlClient, self._client)

    async def extract(self, url: str, html: str | None = None) -> ExtractedContent:
        """
        Extract content from a URL using Firecrawl API.

        Args:
            url: The URL to extract content from.
            html: Ignored - Firecrawl fetches content directly.

        Returns:
            ExtractedContent with the extracted text and metadata.
        """
        start_time = time.perf_counter()

        client = self._get_client()

        try:
            # Firecrawl scrape is synchronous, run in thread pool
            import asyncio
            result = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: client.scrape(
                    url,
                    formats=self.formats,
                    only_main_content=self.only_main_content,
                    timeout=self.timeout,
                ),
            )
        except Exception as exc:
            error_msg = str(exc)
            if "401" in error_msg or "unauthorized" in error_msg.lower():
                raise self._create_error(
                    "Invalid Firecrawl API key",
                    url=url,
                    error_class=ConfigurationError,
                ) from exc
            if "429" in error_msg or "rate limit" in error_msg.lower():
                raise self._create_error(
                    "Firecrawl rate limit exceeded",
                    url=url,
                    error_class=ServiceUnavailableError,
                ) from exc
            if "timeout" in error_msg.lower():
                raise self._create_error(
                    "Firecrawl request timed out",
                    url=url,
                    error_class=NetworkError,
                ) from exc
            raise self._create_error(
                f"Firecrawl extraction failed: {exc}",
                url=url,
                error_class=ExtractionError,
            ) from exc

        # Parse the result
        content = self._parse_result(result, url)

        extraction_time_ms = int((time.perf_counter() - start_time) * 1000)
        content.extraction_time_ms = extraction_time_ms

        return content

    def _parse_result(self, result: object, url: str) -> ExtractedContent:
        """Parse Firecrawl API result into ExtractedContent."""
        if result is None:
            raise self._create_error(
                "Firecrawl returned empty result",
                url=url,
                error_class=ParseError,
            )

        markdown = ""
        html_content = ""
        metadata: dict[str, object] = {}

        # Handle different result formats.
        if isinstance(result, Mapping):
            parsed = cast(Mapping[str, object], result)
            markdown_value = parsed.get("markdown")
            if isinstance(markdown_value, str):
                markdown = markdown_value

            html_value = parsed.get("html")
            if isinstance(html_value, str):
                html_content = html_value

            metadata_value = parsed.get("metadata")
            if isinstance(metadata_value, Mapping):
                metadata = dict(cast(Mapping[str, object], metadata_value))
        elif isinstance(result, _FirecrawlResultObject):
            markdown = result.markdown or ""
            html_content = result.html or ""
            metadata = result.metadata or {}
        else:
            # Fallback: treat as string.
            markdown = str(result)

        if not markdown or not markdown.strip():
            raise self._create_error(
                "Firecrawl returned empty content",
                url=url,
                error_class=ParseError,
            )

        # Extract metadata fields
        title_raw = metadata.get("title") or metadata.get("ogTitle")
        description_raw = metadata.get("description") or metadata.get("ogDescription")
        language_raw = metadata.get("language")

        title = title_raw if isinstance(title_raw, str) else None
        description = description_raw if isinstance(description_raw, str) else None
        language = language_raw if isinstance(language_raw, str) else None

        return ExtractedContent(
            text=markdown,
            title=title,
            description=description,
            language=language,
            url=url,
            extractor=self.extractor_type.value,
            raw_html=html_content if html_content else None,
            extra={
                "firecrawl_metadata": metadata,
            },
        )

    async def is_available(self) -> bool:
        """Check if Firecrawl is available (API key configured)."""
        if not self.api_key:
            return False

        try:
            # Just check if we can import and create client
            from firecrawl import Firecrawl
            return True
        except ImportError:
            return False
