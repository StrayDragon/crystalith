from __future__ import annotations

from dataclasses import dataclass

import pytest

from crystalith.shared.config import Settings
from crystalith.shared.extraction.factory import ExtractorFactory
from crystalith.shared.extraction.interfaces import ConfigurationError, ExtractionError
from crystalith.shared.extraction.types import ExtractedContent, ExtractorType
from crystalith.shared.plugins import PluginRegistry


@dataclass(slots=True)
class _StubExtractor:
    kind: ExtractorType
    available: bool = True
    text: str = "ok"

    @property
    def extractor_type(self) -> ExtractorType:
        return self.kind

    async def is_available(self) -> bool:
        return self.available

    async def extract(self, url: str, html: str | None = None) -> ExtractedContent:
        return ExtractedContent(text=self.text, url=url, extractor=self.kind.value)

    async def close(self) -> None:
        return None


class _StubWebExtractorPlugin:
    api_version = "v1"

    def __init__(self, extractor: _StubExtractor) -> None:
        self.extractor_type = extractor.kind.value
        self.display_name = f"Stub {extractor.kind.value}"
        self.description = "Stub extractor"
        self.requires_api_key = False
        self.requires_service = False
        self._extractor = extractor

    def create_extractor(self, settings: Settings, *, url_fetch_security=None):
        return self._extractor


def _registry_with_plugins(*items: tuple[str, _StubWebExtractorPlugin]) -> PluginRegistry:
    registry = PluginRegistry()
    for plugin_id, plugin in items:
        registry.web_extractors[plugin.extractor_type] = plugin
        registry.plugins[plugin_id] = plugin
        registry._web_extractor_plugin_ids[plugin.extractor_type] = plugin_id
        registry._load_report.loaded.append(plugin_id)
    return registry


@pytest.mark.asyncio
async def test_extractor_factory_reports_enabled_and_available_for_loaded_plugin() -> None:
    settings = Settings.model_validate(
        {
            "source_ingestion": {
                "web_extraction": {
                    "trafilatura": {"enabled": True},
                    "jina": {"enabled": False},
                    "firecrawl": {"enabled": False},
                    "browserless": {"enabled": False},
                    "fallback_order": ["trafilatura"],
                }
            }
        }
    )
    registry = _registry_with_plugins(
        ("extractor-trafilatura", _StubWebExtractorPlugin(_StubExtractor(ExtractorType.TRAFILATURA))),
    )
    factory = ExtractorFactory(settings, plugins=registry)

    infos = await factory.get_available_extractors()
    traf = next(info for info in infos if info.type == ExtractorType.TRAFILATURA)
    assert traf.enabled is True
    assert traf.available is True
    assert traf.plugin_id == "extractor-trafilatura"


@pytest.mark.asyncio
async def test_extractor_factory_reports_not_installed_when_plugin_missing() -> None:
    settings = Settings.model_validate(
        {"source_ingestion": {"web_extraction": {"fallback_order": ["trafilatura"]}}}
    )
    registry = PluginRegistry()
    factory = ExtractorFactory(settings, plugins=registry)

    infos = await factory.get_available_extractors()
    traf = next(info for info in infos if info.type == ExtractorType.TRAFILATURA)
    assert traf.enabled is False
    assert traf.available is False
    assert traf.error_code == "not_installed"
    assert traf.recovery_hint
    assert "official-full" in traf.recovery_hint


@pytest.mark.asyncio
async def test_extractor_factory_falls_back_when_preferred_returns_empty() -> None:
    settings = Settings.model_validate(
        {
            "source_ingestion": {
                "web_extraction": {
                    "trafilatura": {"enabled": True},
                    "jina": {"enabled": True},
                    "fallback_order": ["trafilatura", "jina"],
                }
            }
        }
    )
    registry = _registry_with_plugins(
        (
            "extractor-trafilatura",
            _StubWebExtractorPlugin(_StubExtractor(ExtractorType.TRAFILATURA, text="")),
        ),
        ("extractor-jina", _StubWebExtractorPlugin(_StubExtractor(ExtractorType.JINA, text="Hello"))),
    )
    factory = ExtractorFactory(settings, plugins=registry)

    result = await factory.extract(
        "http://example.test",
        preferred_extractor=ExtractorType.TRAFILATURA,
        enable_fallback=True,
    )
    assert result.extractor == "jina"
    assert "Hello" in result.text


@pytest.mark.asyncio
async def test_extractor_factory_stops_when_fallback_disabled() -> None:
    settings = Settings.model_validate(
        {
            "source_ingestion": {
                "web_extraction": {
                    "trafilatura": {"enabled": True},
                    "jina": {"enabled": True},
                    "fallback_order": ["trafilatura", "jina"],
                }
            }
        }
    )
    registry = _registry_with_plugins(
        (
            "extractor-trafilatura",
            _StubWebExtractorPlugin(_StubExtractor(ExtractorType.TRAFILATURA, text="")),
        ),
        ("extractor-jina", _StubWebExtractorPlugin(_StubExtractor(ExtractorType.JINA, text="Hello"))),
    )
    factory = ExtractorFactory(settings, plugins=registry)

    with pytest.raises(ExtractionError, match="All extractors failed"):
        await factory.extract(
            "http://example.test",
            preferred_extractor=ExtractorType.TRAFILATURA,
            enable_fallback=False,
        )


@pytest.mark.asyncio
async def test_extractor_factory_custom_policy_can_disable_extractors() -> None:
    settings = Settings.model_validate(
        {
            "source_ingestion": {
                "web_extraction": {
                    "trafilatura": {"enabled": True},
                    "jina": {"enabled": True},
                    "fallback_order": ["trafilatura", "jina"],
                }
            }
        }
    )
    registry = _registry_with_plugins(
        ("extractor-trafilatura", _StubWebExtractorPlugin(_StubExtractor(ExtractorType.TRAFILATURA))),
        ("extractor-jina", _StubWebExtractorPlugin(_StubExtractor(ExtractorType.JINA))),
    )
    factory = ExtractorFactory(
        settings,
        plugins=registry,
        policy_mode="custom",
        enabled_extractors={"jina"},
    )

    infos = await factory.get_available_extractors()
    traf = next(info for info in infos if info.type == ExtractorType.TRAFILATURA)
    jina = next(info for info in infos if info.type == ExtractorType.JINA)

    assert traf.enabled is False
    assert traf.available is False
    assert traf.error_code == "disabled"

    assert jina.enabled is True
    assert jina.available is True

    with pytest.raises(ConfigurationError, match="No extractors available"):
        await ExtractorFactory(
            settings,
            plugins=PluginRegistry(),
            policy_mode="custom",
            enabled_extractors=set(),
        ).extract("http://example.test")


@pytest.mark.asyncio
async def test_extractor_factory_reports_missing_config_when_unavailable() -> None:
    settings = Settings.model_validate(
        {
            "source_ingestion": {
                "web_extraction": {
                    "trafilatura": {"enabled": False},
                    "jina": {"enabled": False},
                    "firecrawl": {"enabled": True, "api_key": None},
                    "browserless": {"enabled": True, "endpoint": ""},
                    "fallback_order": ["firecrawl", "browserless"],
                }
            }
        }
    )
    registry = _registry_with_plugins(
        (
            "extractor-firecrawl",
            _StubWebExtractorPlugin(_StubExtractor(ExtractorType.FIRECRAWL, available=False)),
        ),
        (
            "extractor-browserless",
            _StubWebExtractorPlugin(_StubExtractor(ExtractorType.BROWSERLESS, available=False)),
        ),
    )
    factory = ExtractorFactory(settings, plugins=registry)

    infos = await factory.get_available_extractors()
    firecrawl = next(info for info in infos if info.type == ExtractorType.FIRECRAWL)
    assert firecrawl.enabled is True
    assert firecrawl.available is False
    assert firecrawl.error_code == "missing_config"
    assert firecrawl.message == "Firecrawl API key is required"
    assert firecrawl.recovery_hint

    browserless = next(info for info in infos if info.type == ExtractorType.BROWSERLESS)
    assert browserless.enabled is True
    assert browserless.available is False
    assert browserless.error_code == "missing_config"
    assert browserless.message == "Browserless endpoint is required"
    assert browserless.recovery_hint
