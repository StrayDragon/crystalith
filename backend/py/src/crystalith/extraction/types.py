"""Type definitions for web content extraction."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class ExtractorType(str, Enum):
    """Available extractor types."""

    TRAFILATURA = "trafilatura"
    JINA = "jina"
    FIRECRAWL = "firecrawl"
    BROWSERLESS = "browserless"

    @property
    def display_name(self) -> str:
        """Human-readable display name."""
        names = {
            ExtractorType.TRAFILATURA: "本地提取 (Trafilatura)",
            ExtractorType.JINA: "Jina Reader API",
            ExtractorType.FIRECRAWL: "Firecrawl API",
            ExtractorType.BROWSERLESS: "浏览器渲染 (Browserless)",
        }
        return names.get(self, self.value)

    @property
    def description(self) -> str:
        """Description of the extractor."""
        descriptions = {
            ExtractorType.TRAFILATURA: "使用本地 trafilatura 库提取网页正文，速度快，无需外部服务",
            ExtractorType.JINA: "使用 Jina Reader API 提取网页内容，免费且支持 JS 渲染",
            ExtractorType.FIRECRAWL: "使用 Firecrawl API 提取网页内容，功能强大，需要 API 密钥",
            ExtractorType.BROWSERLESS: "使用 Browserless 服务渲染页面后提取，适合复杂动态页面",
        }
        return descriptions.get(self, "")


@dataclass
class ExtractedContent:
    """Unified result model for web content extraction."""

    # Core content
    text: str
    """Extracted main text content (Markdown format)."""

    # Metadata
    title: str | None = None
    """Page title."""

    author: str | None = None
    """Author name if available."""

    date: str | None = None
    """Publication date if available."""

    description: str | None = None
    """Page description/summary."""

    language: str | None = None
    """Detected language code."""

    url: str | None = None
    """Original URL."""

    # Extraction metadata
    extractor: str = "unknown"
    """Name of the extractor used."""

    extraction_time_ms: int = 0
    """Time taken for extraction in milliseconds."""

    raw_html: str | None = None
    """Raw HTML content (optional, for debugging)."""

    extra: dict[str, Any] = field(default_factory=dict)
    """Additional metadata from the extractor."""

    @property
    def word_count(self) -> int:
        """Approximate word count of the extracted text."""
        return len(self.text.split())

    @property
    def is_empty(self) -> bool:
        """Check if the extraction result is empty."""
        return not self.text or len(self.text.strip()) == 0

    def to_metadata(self) -> dict[str, Any]:
        """Convert to metadata dict for storage."""
        return {
            "extractor": self.extractor,
            "extraction_time_ms": self.extraction_time_ms,
            "original_url": self.url,
            "page_title": self.title,
            "page_author": self.author,
            "page_date": self.date,
            "page_description": self.description,
            "page_language": self.language,
            "word_count": self.word_count,
        }


@dataclass
class ExtractorInfo:
    """Information about an available extractor."""

    type: ExtractorType
    """Extractor type identifier."""

    enabled: bool
    """Whether this extractor is enabled in config."""

    available: bool
    """Whether this extractor is actually available (dependencies installed, service reachable)."""

    display_name: str
    """Human-readable name."""

    description: str
    """Description of the extractor."""

    priority: int
    """Priority order (lower = higher priority)."""

    requires_api_key: bool = False
    """Whether this extractor requires an API key."""

    requires_service: bool = False
    """Whether this extractor requires an external service."""

    def to_dict(self) -> dict[str, Any]:
        """Convert to dict for API response."""
        return {
            "type": self.type.value,
            "enabled": self.enabled,
            "available": self.available,
            "display_name": self.display_name,
            "description": self.description,
            "priority": self.priority,
            "requires_api_key": self.requires_api_key,
            "requires_service": self.requires_service,
        }
