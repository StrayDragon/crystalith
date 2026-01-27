"""Web content extraction module.

Provides multiple extraction strategies for converting web pages to text:
- TrafilaturaExtractor: Local extraction using trafilatura library
- JinaReaderExtractor: External API using Jina Reader (free, supports JS)
- FirecrawlExtractor: External API using Firecrawl service
- BrowserlessExtractor: Browser rendering using Browserless + Playwright
"""

from .types import ExtractedContent, ExtractorType, ExtractorInfo
from .interfaces import (
    Extractor,
    ExtractionError,
    NetworkError,
    ParseError,
    ConfigurationError,
    ServiceUnavailableError,
)
from .factory import ExtractorFactory, create_extractor

__all__ = [
    # Types
    "ExtractedContent",
    "ExtractorType",
    "ExtractorInfo",
    # Interfaces
    "Extractor",
    "ExtractionError",
    "NetworkError",
    "ParseError",
    "ConfigurationError",
    "ServiceUnavailableError",
    # Factory
    "ExtractorFactory",
    "create_extractor",
]
