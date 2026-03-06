from __future__ import annotations

from crystalith.shared.extraction.firecrawl_extractor import FirecrawlExtractor
from crystalith.shared.extraction.types import ExtractorType


class FirecrawlWebExtractorPlugin:
    api_version = "v1"

    extractor_type = ExtractorType.FIRECRAWL.value
    display_name = ExtractorType.FIRECRAWL.display_name
    description = ExtractorType.FIRECRAWL.description
    requires_api_key = True
    requires_service = False

    def create_extractor(self, settings, *, url_fetch_security=None):  # noqa: ANN001, ARG002
        fc_settings = settings.source_ingestion.web_extraction.firecrawl
        return FirecrawlExtractor(
            api_key=fc_settings.api_key,
            timeout=fc_settings.timeout,
        )


plugin = FirecrawlWebExtractorPlugin()
