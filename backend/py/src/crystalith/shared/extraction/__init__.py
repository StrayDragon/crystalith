"""Web content extraction module.

Provides multiple extraction strategies for converting web pages to text:
- TrafilaturaExtractor: Local extraction using trafilatura library
- JinaReaderExtractor: External API using Jina Reader (free, supports JS)
- FirecrawlExtractor: External API using Firecrawl service
- BrowserlessExtractor: Browser rendering using Browserless + Playwright
"""

from .factory import ExtractorFactory, create_extractor
from .interfaces import (
    ConfigurationError,
    ExtractionError,
    Extractor,
    NetworkError,
    ParseError,
    ServiceUnavailableError,
)
from .types import ExtractedContent, ExtractorInfo, ExtractorType

__all__ = [
    "ConfigurationError",
    # Types
    "ExtractedContent",
    "ExtractionError",
    # Interfaces
    "Extractor",
    # Factory
    "ExtractorFactory",
    "ExtractorInfo",
    "ExtractorType",
    "NetworkError",
    "ParseError",
    "ServiceUnavailableError",
    "create_extractor",
]
