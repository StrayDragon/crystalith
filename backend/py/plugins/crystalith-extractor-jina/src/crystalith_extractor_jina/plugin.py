from __future__ import annotations

from crystalith.shared.extraction.jina_extractor import JinaReaderExtractor
from crystalith.shared.extraction.types import ExtractorType


class JinaWebExtractorPlugin:
    api_version = "v1"

    extractor_type = ExtractorType.JINA.value
    display_name = ExtractorType.JINA.display_name
    description = ExtractorType.JINA.description
    requires_api_key = False
    requires_service = True

    def create_extractor(self, settings, *, url_fetch_security=None):  # noqa: ANN001, ARG002
        jina_settings = settings.source_ingestion.web_extraction.jina
        proxy_url = None
        if jina_settings.proxy and jina_settings.proxy.enabled:
            proxy_url = jina_settings.proxy.get_proxy_url()

        return JinaReaderExtractor(
            api_key=jina_settings.api_key,
            timeout=jina_settings.timeout,
            proxy_url=proxy_url,
        )


plugin = JinaWebExtractorPlugin()
