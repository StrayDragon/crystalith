"""Trafilatura-based local web content extractor."""

from __future__ import annotations

import time

import httpx
import trafilatura
from trafilatura.settings import use_config
from urllib.parse import urljoin

from .interfaces import BaseExtractor, ExtractionError, NetworkError, ParseError
from .types import ExtractedContent, ExtractorType

from crystalith.shared.config.models import UrlFetchSecuritySettings


class TrafilaturaExtractor(BaseExtractor):
    """
    Local web content extractor using trafilatura library.

    Trafilatura is optimized for extracting main text content from web pages,
    with good support for metadata extraction and noise filtering.
    """

    def __init__(
        self,
        *,
        include_tables: bool = True,
        include_links: bool = True,
        include_images: bool = False,
        include_comments: bool = False,
        output_format: str = "markdown",
        timeout: int = 30,
        user_agent: str | None = None,
        proxy_url: str | None = None,
        url_fetch_security: UrlFetchSecuritySettings | None = None,
    ):
        """
        Initialize the Trafilatura extractor.

        Args:
            include_tables: Include tables in extraction.
            include_links: Include links in extraction.
            include_images: Include image references.
            include_comments: Include comments section.
            output_format: Output format (markdown, txt, xml, json).
            timeout: HTTP request timeout in seconds.
            user_agent: Custom User-Agent header.
            proxy_url: HTTP proxy URL.
        """
        self.include_tables = include_tables
        self.include_links = include_links
        self.include_images = include_images
        self.include_comments = include_comments
        self.output_format = output_format
        self.timeout = timeout
        self.proxy_url = proxy_url
        self.url_fetch_security = url_fetch_security

        # Default browser-like User-Agent
        self.user_agent = user_agent or (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )

        # Configure trafilatura
        self._config = use_config()
        self._config.set("DEFAULT", "EXTRACTION_TIMEOUT", "30")

    @property
    def extractor_type(self) -> ExtractorType:
        return ExtractorType.TRAFILATURA

    async def extract(self, url: str, html: str | None = None) -> ExtractedContent:
        """
        Extract content from a URL or HTML using trafilatura.

        Args:
            url: The URL to extract content from.
            html: Optional pre-fetched HTML content.

        Returns:
            ExtractedContent with the extracted text and metadata.
        """
        start_time = time.perf_counter()

        # Fetch HTML if not provided
        if html is None:
            html = await self._fetch_html(url)

        # Extract content
        try:
            result = trafilatura.extract(
                html,
                url=url,
                include_tables=self.include_tables,
                include_links=self.include_links,
                include_images=self.include_images,
                include_comments=self.include_comments,
                output_format=self.output_format,
                with_metadata=True,
                config=self._config,
            )
        except Exception as exc:
            raise self._create_error(
                f"Trafilatura extraction failed: {exc}",
                url=url,
                error_class=ParseError,
            ) from exc

        if result is None or (isinstance(result, str) and not result.strip()):
            raise self._create_error(
                "Trafilatura returned empty content",
                url=url,
                error_class=ParseError,
            )

        # Extract metadata separately
        metadata = self._extract_metadata(html, url)

        extraction_time_ms = int((time.perf_counter() - start_time) * 1000)

        title = metadata.get("title")
        author = metadata.get("author")
        date = metadata.get("date")
        description = metadata.get("description")
        language = metadata.get("language")

        return ExtractedContent(
            text=result if isinstance(result, str) else str(result),
            title=title if isinstance(title, str) else None,
            author=author if isinstance(author, str) else None,
            date=date if isinstance(date, str) else None,
            description=description if isinstance(description, str) else None,
            language=language if isinstance(language, str) else None,
            url=url,
            extractor=self.extractor_type.value,
            extraction_time_ms=extraction_time_ms,
            extra=metadata,
        )

    async def is_available(self) -> bool:
        """Trafilatura is always available as it's a local library."""
        return True

    async def _fetch_html(self, url: str) -> str:
        """Fetch HTML content from URL."""
        headers = {
            "User-Agent": self.user_agent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
            "Cache-Control": "no-cache",
        }

        max_redirects = self.url_fetch_security.max_redirects if self.url_fetch_security is not None else 5
        try:
            async with httpx.AsyncClient(
                timeout=float(self.timeout),
                follow_redirects=False,
                proxy=self.proxy_url,
            ) as client:
                current_url = url
                if self.url_fetch_security is not None:
                    from crystalith.shared.net import UrlSafetyError, validate_url_for_fetch

                    try:
                        await validate_url_for_fetch(current_url, policy=self.url_fetch_security)
                    except UrlSafetyError as exc:
                        raise self._create_error(
                            f"Blocked URL by SSRF policy: {exc}",
                            url=current_url,
                            error_class=ExtractionError,
                        ) from exc

                for _ in range(max_redirects + 1):
                    response = await client.get(current_url, headers=headers)

                    if response.status_code in {301, 302, 303, 307, 308}:
                        location = response.headers.get("Location")
                        if not location:
                            raise self._create_error(
                                "Redirect response missing Location header",
                                url=current_url,
                                error_class=NetworkError,
                            )
                        next_url = urljoin(current_url, location)

                        if self.url_fetch_security is not None:
                            from crystalith.shared.net import UrlSafetyError, validate_url_for_fetch

                            try:
                                await validate_url_for_fetch(next_url, policy=self.url_fetch_security)
                            except UrlSafetyError as exc:
                                raise self._create_error(
                                    f"Blocked redirect target by SSRF policy: {exc}",
                                    url=next_url,
                                    error_class=ExtractionError,
                                ) from exc

                        current_url = next_url
                        continue

                    response.raise_for_status()
                    return response.text

                raise self._create_error(
                    f"Too many redirects (>{max_redirects})",
                    url=url,
                    error_class=NetworkError,
                )
        except httpx.HTTPStatusError as exc:
            raise self._create_error(
                f"HTTP {exc.response.status_code}: Failed to fetch URL",
                url=url,
                error_class=NetworkError,
            ) from exc
        except httpx.RequestError as exc:
            raise self._create_error(
                f"Network error: {exc}",
                url=url,
                error_class=NetworkError,
            ) from exc

    def _extract_metadata(self, html: str, url: str) -> dict[str, object]:
        """Extract metadata from HTML using trafilatura."""
        try:
            metadata = trafilatura.extract_metadata(html, default_url=url)
            if metadata is None:
                return {}

            return {
                "title": metadata.title,
                "author": metadata.author,
                "date": metadata.date,
                "description": metadata.description,
                "language": metadata.language,
                "sitename": metadata.sitename,
                "categories": metadata.categories,
                "tags": metadata.tags,
            }
        except Exception:
            return {}
