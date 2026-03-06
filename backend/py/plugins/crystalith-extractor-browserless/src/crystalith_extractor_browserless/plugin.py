from __future__ import annotations

from crystalith.shared.extraction.browserless_extractor import BrowserlessExtractor
from crystalith.shared.extraction.types import ExtractorType


class BrowserlessWebExtractorPlugin:
    api_version = "v1"

    extractor_type = ExtractorType.BROWSERLESS.value
    display_name = ExtractorType.BROWSERLESS.display_name
    description = ExtractorType.BROWSERLESS.description
    requires_api_key = False
    requires_service = True

    def create_extractor(self, settings, *, url_fetch_security=None):  # noqa: ANN001, ARG002
        bl_settings = settings.source_ingestion.web_extraction.browserless
        return BrowserlessExtractor(
            endpoint=bl_settings.endpoint,
            token=bl_settings.token,
            timeout=bl_settings.timeout,
            wait_until=bl_settings.wait_until,
        )


plugin = BrowserlessWebExtractorPlugin()
