from __future__ import annotations

from crystalith.shared.extraction.trafilatura_extractor import TrafilaturaExtractor
from crystalith.shared.extraction.types import ExtractorType


class TrafilaturaWebExtractorPlugin:
    api_version = "v1"

    extractor_type = ExtractorType.TRAFILATURA.value
    display_name = ExtractorType.TRAFILATURA.display_name
    description = ExtractorType.TRAFILATURA.description
    requires_api_key = False
    requires_service = False

    def create_extractor(self, settings, *, url_fetch_security=None):
        traf_settings = settings.source_ingestion.web_extraction.trafilatura
        proxy_url = None
        if traf_settings.proxy and traf_settings.proxy.enabled:
            proxy_url = traf_settings.proxy.get_proxy_url()

        return TrafilaturaExtractor(
            include_tables=traf_settings.include_tables,
            include_links=traf_settings.include_links,
            output_format=traf_settings.output_format,
            timeout=traf_settings.timeout,
            proxy_url=proxy_url,
            url_fetch_security=url_fetch_security,
        )


plugin = TrafilaturaWebExtractorPlugin()
