"""Interfaces for web content extraction."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Protocol, runtime_checkable

from .types import ExtractedContent, ExtractorType


class ExtractionError(Exception):
    """Base exception for extraction errors."""

    def __init__(self, message: str, extractor: str | None = None, url: str | None = None):
        self.message = message
        self.extractor = extractor
        self.url = url
        super().__init__(message)

    def __str__(self) -> str:
        parts = [self.message]
        if self.extractor:
            parts.append(f"extractor={self.extractor}")
        if self.url:
            parts.append(f"url={self.url}")
        return " | ".join(parts)


class NetworkError(ExtractionError):
    """Network-related extraction error."""
    pass


class ParseError(ExtractionError):
    """Content parsing error."""
    pass


class ConfigurationError(ExtractionError):
    """Configuration error (e.g., missing API key)."""
    pass


class ServiceUnavailableError(ExtractionError):
    """External service unavailable."""
    pass


@runtime_checkable
class Extractor(Protocol):
    """Protocol for web content extractors."""

    @property
    def extractor_type(self) -> ExtractorType:
        """Return the extractor type identifier."""
        ...

    async def extract(self, url: str, html: str | None = None) -> ExtractedContent:
        """
        Extract content from a URL or HTML.

        Args:
            url: The URL to extract content from.
            html: Optional pre-fetched HTML content. If provided, the extractor
                  may skip fetching and use this directly.

        Returns:
            ExtractedContent with the extracted text and metadata.

        Raises:
            ExtractionError: If extraction fails.
        """
        ...

    async def is_available(self) -> bool:
        """
        Check if this extractor is available and ready to use.

        Returns:
            True if the extractor can be used, False otherwise.
        """
        ...


class BaseExtractor(ABC):
    """Base class for extractors with common functionality."""

    @property
    @abstractmethod
    def extractor_type(self) -> ExtractorType:
        """Return the extractor type identifier."""
        ...

    @abstractmethod
    async def extract(self, url: str, html: str | None = None) -> ExtractedContent:
        """Extract content from a URL or HTML."""
        ...

    async def is_available(self) -> bool:
        """Check if this extractor is available. Override in subclasses."""
        return True

    def _create_error(
        self,
        message: str,
        url: str | None = None,
        error_class: type[ExtractionError] = ExtractionError,
    ) -> ExtractionError:
        """Create an extraction error with context."""
        return error_class(
            message=message,
            extractor=self.extractor_type.value,
            url=url,
        )
