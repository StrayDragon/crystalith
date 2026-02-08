from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pytest
from fastapi.testclient import TestClient

from crystalith.shared.config import ModelConfig, ModelsSettings, Settings
from crystalith.shared.plugins import PluginRegistry


@dataclass(slots=True)
class StubEntryPoint:
    name: str
    value: str
    plugin: Any

    def load(self) -> Any:
        return self.plugin


class MockProviderPlugin:
    api_version = "v1"

    def create_chat_provider(self, settings: Any, model_config: Any) -> Any:  # pragma: no cover
        raise NotImplementedError

    def create_embedding_provider(self, settings: Any, model_config: Any) -> Any:  # pragma: no cover
        raise NotImplementedError


def test_plugin_registry_loads_ai_provider_plugin(monkeypatch: pytest.MonkeyPatch) -> None:
    from crystalith.shared.plugins import registry as registry_mod

    plugin = MockProviderPlugin()
    monkeypatch.setattr(
        registry_mod,
        "_iter_entry_points",
        lambda group: [StubEntryPoint(name="mock", value="x:y", plugin=plugin)],
    )

    settings = Settings()
    registry = PluginRegistry()
    report = registry.load_from_entry_points(settings)

    assert report.loaded == ["mock"]
    assert registry.ai_providers["mock"] is plugin


def test_plugin_registry_respects_disabled_list(monkeypatch: pytest.MonkeyPatch) -> None:
    from crystalith.shared.plugins import registry as registry_mod

    plugin = MockProviderPlugin()
    monkeypatch.setattr(
        registry_mod,
        "_iter_entry_points",
        lambda group: [StubEntryPoint(name="mock", value="x:y", plugin=plugin)],
    )

    settings = Settings(plugins={"disabled": ["mock"]})
    registry = PluginRegistry()
    report = registry.load_from_entry_points(settings)

    assert report.loaded == []
    assert report.skipped["mock"] == "disabled"
    assert "mock" not in registry.ai_providers


def test_models_endpoint_includes_plugin_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    from crystalith.shared.plugins import registry as registry_mod
    from crystalith.web.app import create_app

    plugin = MockProviderPlugin()
    monkeypatch.setattr(
        registry_mod,
        "_iter_entry_points",
        lambda group: [StubEntryPoint(name="mock", value="x:y", plugin=plugin)],
    )

    settings = Settings(
        models=ModelsSettings(
            available=[
                ModelConfig(
                    id="mock-chat",
                    provider="mock",
                    model="mock-1",
                    display_name="Mock",
                    description="",
                    roles=["chat"],
                )
            ]
        )
    )

    app = create_app(settings=settings)
    with TestClient(app) as client:
        payload = client.get("/v1/models").json()

    assert "mock" in payload["providers"]
    assert any(model["id"] == "mock-chat" for model in payload["models"])


def test_models_endpoint_hides_disabled_plugin_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    from crystalith.shared.plugins import registry as registry_mod
    from crystalith.web.app import create_app

    plugin = MockProviderPlugin()
    monkeypatch.setattr(
        registry_mod,
        "_iter_entry_points",
        lambda group: [StubEntryPoint(name="mock", value="x:y", plugin=plugin)],
    )

    settings = Settings(
        plugins={"disabled": ["mock"]},
        models=ModelsSettings(
            available=[
                ModelConfig(
                    id="mock-chat",
                    provider="mock",
                    model="mock-1",
                    display_name="Mock",
                    description="",
                    roles=["chat"],
                )
            ]
        ),
    )

    app = create_app(settings=settings)
    with TestClient(app) as client:
        payload = client.get("/v1/models").json()

    assert "mock" not in payload["providers"]
    assert payload["models"] == []
