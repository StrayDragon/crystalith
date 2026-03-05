"""Browserless-based web content extractor with JavaScript rendering."""

from __future__ import annotations

import importlib
import time
from collections.abc import Callable
from typing import Protocol, cast

from .interfaces import (
    BaseExtractor,
    ConfigurationError,
    ExtractionError,
    NetworkError,
    ParseError,
    ServiceUnavailableError,
)
from .types import ExtractedContent, ExtractorType


class _Chromium(Protocol):
    async def connect_over_cdp(self, connection_url: str, *, timeout: int) -> _Browser: ...


class _Playwright(Protocol):
    chromium: _Chromium

    async def stop(self) -> None: ...


class _PlaywrightManager(Protocol):
    async def start(self) -> _Playwright: ...


type AsyncPlaywrightFactory = Callable[[], _PlaywrightManager]


def _load_async_playwright() -> AsyncPlaywrightFactory:
    module = importlib.import_module("playwright.async_api")
    factory = getattr(module, "async_playwright", None)
    if not callable(factory):
        raise RuntimeError("playwright.async_api.async_playwright is missing")
    return cast(AsyncPlaywrightFactory, factory)


class _TrafilaturaMetadata(Protocol):
    title: str | None
    author: str | None
    date: str | None
    description: str | None
    language: str | None
    sitename: str | None


class _TrafilaturaModule(Protocol):
    def extract(
        self,
        html: str,
        *,
        url: str,
        include_tables: bool,
        include_links: bool,
        include_images: bool,
        include_comments: bool,
        output_format: str,
        with_metadata: bool,
    ) -> str | None: ...

    def extract_metadata(self, html: str, *, default_url: str) -> _TrafilaturaMetadata | None: ...


def _load_trafilatura() -> _TrafilaturaModule:
    try:
        return cast(_TrafilaturaModule, importlib.import_module("trafilatura"))
    except ImportError as exc:
        raise ConfigurationError(
            "trafilatura package is not installed. Install it with: pip install trafilatura",
            extractor="browserless",
        ) from exc


class _Page(Protocol):
    async def goto(self, url: str, *, wait_until: str, timeout: int) -> object: ...

    async def content(self) -> str: ...

    async def title(self) -> str: ...

    async def close(self) -> None: ...


class _BrowserContext(Protocol):
    async def new_page(self) -> _Page: ...

    async def close(self) -> None: ...


class _Browser(Protocol):
    def is_connected(self) -> bool: ...

    async def new_context(self, *, user_agent: str) -> _BrowserContext: ...

    async def close(self) -> None: ...


class BrowserlessExtractor(BaseExtractor):
    """
    Web content extractor using Browserless service for JavaScript rendering.

    Browserless provides a headless browser service that can render JavaScript-heavy
    pages. This extractor connects via Playwright CDP and uses trafilatura for
    content extraction from the rendered HTML.

    Requires:
    - Browserless service running (self-hosted or cloud)
    - playwright package installed (optional dependency)
    """

    def __init__(
        self,
        *,
        endpoint: str = "ws://localhost:3000",
        token: str | None = None,
        timeout: int = 60,
        wait_until: str = "networkidle",
        include_tables: bool = True,
        include_links: bool = True,
    ):
        """
        Initialize the Browserless extractor.

        Args:
            endpoint: Browserless WebSocket endpoint (ws:// or wss://).
            token: Authentication token for Browserless.
            timeout: Page load timeout in seconds.
            wait_until: Playwright wait condition (load, domcontentloaded, networkidle).
            include_tables: Include tables in extraction.
            include_links: Include links in extraction.
        """
        self.endpoint = endpoint
        self.token = token
        self.timeout = timeout
        self.wait_until = wait_until
        self.include_tables = include_tables
        self.include_links = include_links

        self._playwright: _Playwright | None = None
        self._browser: _Browser | None = None

    @property
    def extractor_type(self) -> ExtractorType:
        return ExtractorType.BROWSERLESS

    def _get_connection_url(self) -> str:
        """Build the Browserless connection URL with token."""
        url = self.endpoint
        if self.token:
            separator = "&" if "?" in url else "?"
            url = f"{url}{separator}token={self.token}"
        return url

    async def _ensure_browser(self) -> _Browser:
        """Ensure browser connection is established."""
        if self._browser is not None and self._browser.is_connected():
            return self._browser

        try:
            async_playwright = _load_async_playwright()
        except ImportError as exc:
            raise self._create_error(
                "playwright package is not installed. "
                "Install it with: pip install playwright",
                error_class=ConfigurationError,
            ) from exc

        try:
            if self._playwright is None:
                self._playwright = await async_playwright().start()
            playwright = self._playwright
            if playwright is None:  # pragma: no cover - defensive
                raise RuntimeError("Playwright failed to start")

            connection_url = self._get_connection_url()
            self._browser = await playwright.chromium.connect_over_cdp(
                connection_url,
                timeout=self.timeout * 1000,  # Convert to ms
            )
            return self._browser
        except Exception as exc:
            error_msg = str(exc).lower()
            if "timeout" in error_msg:
                raise self._create_error(
                    f"Connection to Browserless timed out: {self.endpoint}",
                    error_class=NetworkError,
                ) from exc
            if "refused" in error_msg or "connect" in error_msg:
                raise self._create_error(
                    f"Cannot connect to Browserless service: {self.endpoint}",
                    error_class=ServiceUnavailableError,
                ) from exc
            raise self._create_error(
                f"Failed to connect to Browserless: {exc}",
                error_class=ExtractionError,
            ) from exc

    async def extract(self, url: str, html: str | None = None) -> ExtractedContent:
        """
        Extract content from a URL using Browserless for JavaScript rendering.

        Args:
            url: The URL to extract content from.
            html: Ignored - Browserless fetches and renders the page directly.

        Returns:
            ExtractedContent with the extracted text and metadata.
        """
        start_time = time.perf_counter()

        browser = await self._ensure_browser()

        # Create new context and page
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
        )
        try:
            page = await context.new_page()
            try:
                # Navigate to URL
                try:
                    await page.goto(
                        url,
                        wait_until=self.wait_until,
                        timeout=self.timeout * 1000,
                    )
                except Exception as exc:
                    error_msg = str(exc).lower()
                    if "timeout" in error_msg:
                        raise self._create_error(
                            f"Page load timed out after {self.timeout}s",
                            url=url,
                            error_class=NetworkError,
                        ) from exc
                    raise self._create_error(
                        f"Failed to load page: {exc}",
                        url=url,
                        error_class=NetworkError,
                    ) from exc

                # Get rendered HTML
                rendered_html = await page.content()

                # Get page title from browser
                page_title = await page.title()
            finally:
                await page.close()
        finally:
            await context.close()

        trafilatura = _load_trafilatura()

        # Extract content using trafilatura
        try:
            result = trafilatura.extract(
                rendered_html,
                url=url,
                include_tables=self.include_tables,
                include_links=self.include_links,
                include_images=False,
                include_comments=False,
                output_format="markdown",
                with_metadata=True,
            )
        except Exception as exc:
            raise self._create_error(
                f"Content extraction failed: {exc}",
                url=url,
                error_class=ParseError,
            ) from exc

        if result is None or (isinstance(result, str) and not result.strip()):
            raise self._create_error(
                "Extraction returned empty content after rendering",
                url=url,
                error_class=ParseError,
            )

        # Extract metadata
        metadata = self._extract_metadata(trafilatura, rendered_html, url)

        extraction_time_ms = int((time.perf_counter() - start_time) * 1000)

        return ExtractedContent(
            text=result if isinstance(result, str) else str(result),
            title=page_title or metadata.get("title"),
            author=metadata.get("author"),
            date=metadata.get("date"),
            description=metadata.get("description"),
            language=metadata.get("language"),
            url=url,
            extractor=self.extractor_type.value,
            extraction_time_ms=extraction_time_ms,
            extra={
                "rendered": True,
                "wait_until": self.wait_until,
                **metadata,
            },
        )

    def _extract_metadata(self, trafilatura: _TrafilaturaModule, html: str, url: str) -> dict[str, str | None]:
        """Extract metadata from rendered HTML."""
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
            }
        except Exception:
            return {}

    async def is_available(self) -> bool:
        """Check if Browserless service is available."""
        # Check if playwright is installed
        try:
            _ = _load_async_playwright()
        except ImportError:  # pragma: no cover - depends on optional dependency
            return False
        except Exception:  # pragma: no cover - defensive
            return False

        # Check if endpoint is configured
        if not self.endpoint:
            return False

        # Try to connect (with short timeout)
        try:
            browser = await self._ensure_browser()
            return browser.is_connected()
        except Exception:
            return False

    async def close(self) -> None:
        """Close browser connection and cleanup resources."""
        if self._browser:
            try:
                await self._browser.close()
            except Exception:
                pass
            self._browser = None

        if self._playwright:
            try:
                await self._playwright.stop()
            except Exception:
                pass
            self._playwright = None
