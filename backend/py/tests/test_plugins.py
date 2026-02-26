from __future__ import annotations

from dataclasses import dataclass
import tempfile
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import BaseModel

from crystalith.shared.config import ModelConfig, ModelsSettings, Settings
from crystalith.shared.db import create_db_manager
from crystalith.shared.db.migrations import upgrade_head
from crystalith.shared.plugins import PluginRegistry
from crystalith.shared.plugins.render_types import (
    ConfigOption,
    ItemSchema,
    FieldDescriptor,
    OutputTypePluginMeta,
    PluginConfigSchema,
    RenderDescriptor,
)
from crystalith.shared.vector_storage import InMemoryVectorStore


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


class _MockOutputSchema(BaseModel):
    value: str


class MockOutputTypePlugin:
    api_version = "v1"

    output_type = "QUIZ"
    schema = _MockOutputSchema
    default_prompt = "plugin prompt"

    metadata = OutputTypePluginMeta(
        description="Quiz plugin",
        display_text="Quiz",
        tone="teal",
    )

    render_descriptor = RenderDescriptor(
        layout="cards",
        item_schema=ItemSchema(
            fields=[
                FieldDescriptor(key="value", type="text", label="Value"),
            ]
        ),
        options={"items_key": "items"},
    )

    config_schema = PluginConfigSchema(
        quantity_options=[
            ConfigOption(id="standard", label="Standard", is_default=True),
        ],
        difficulty_options=[],
        topic_placeholder="Topic",
        supports_topic=True,
    )


def test_plugin_registry_loads_ai_provider_plugin(monkeypatch: pytest.MonkeyPatch) -> None:
    from crystalith.shared.plugins import registry as registry_mod

    plugin = MockProviderPlugin()
    # Mock reason: entry point discovery must be deterministic in tests and cannot depend on host environment.
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


def test_plugin_registry_loads_output_type_plugin_and_extension_attributes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from crystalith.shared.plugins import registry as registry_mod

    plugin = MockOutputTypePlugin()
    # Mock reason: entry point discovery must be deterministic in tests and cannot depend on host environment.
    monkeypatch.setattr(
        registry_mod,
        "_iter_entry_points",
        lambda group: [StubEntryPoint(name="mock-output", value="x:y", plugin=plugin)],
    )

    settings = Settings()
    registry = PluginRegistry()
    report = registry.load_from_entry_points(settings)

    assert report.loaded == ["mock-output"]
    assert registry.output_types["QUIZ"] is plugin
    assert registry.output_types["QUIZ"].schema is _MockOutputSchema
    assert registry.output_types["QUIZ"].default_prompt == "plugin prompt"
    assert registry.get_output_type_metadata("QUIZ") == plugin.metadata
    assert registry.get_render_descriptor("QUIZ") == plugin.render_descriptor
    assert registry.get_config_schema("QUIZ") == plugin.config_schema


def test_plugin_registry_output_type_conflict_overwrites_and_logs_warning(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from crystalith.shared.plugins import registry as registry_mod

    warnings: list[tuple[str, dict[str, Any]]] = []

    def _warning(message: str, **kwargs: Any) -> None:
        warnings.append((message, kwargs))

    # Mock reason: capture warning side effects without relying on global logging sinks.
    monkeypatch.setattr(registry_mod.log, "warning", _warning)

    plugin_a = MockOutputTypePlugin()

    class _SchemaB(BaseModel):
        other: str

    plugin_b = MockOutputTypePlugin()
    plugin_b.schema = _SchemaB

    # Mock reason: entry point ordering drives conflict behavior and must be deterministic in tests.
    monkeypatch.setattr(
        registry_mod,
        "_iter_entry_points",
        lambda group: [
            StubEntryPoint(name="plugin-a", value="x:a", plugin=plugin_a),
            StubEntryPoint(name="plugin-b", value="x:b", plugin=plugin_b),
        ],
    )

    settings = Settings()
    registry = PluginRegistry()
    registry.load_from_entry_points(settings)

    assert registry.output_types["QUIZ"] is plugin_b
    assert any(message == "output type plugin conflict; overwriting" for message, _ in warnings)


def test_plugin_registry_output_type_plugin_without_extensions_is_ok(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from crystalith.shared.plugins import registry as registry_mod

    class MinimalOutputTypePlugin:
        api_version = "v1"

        output_type = "QUIZ"
        schema = _MockOutputSchema
        default_prompt = None

    plugin = MinimalOutputTypePlugin()
    # Mock reason: entry point discovery must be deterministic in tests and cannot depend on host environment.
    monkeypatch.setattr(
        registry_mod,
        "_iter_entry_points",
        lambda group: [StubEntryPoint(name="mock-output", value="x:y", plugin=plugin)],
    )

    settings = Settings()
    registry = PluginRegistry()
    registry.load_from_entry_points(settings)

    assert registry.output_types["QUIZ"] is plugin
    assert registry.get_output_type_metadata("QUIZ") is None
    assert registry.get_render_descriptor("QUIZ") is None
    assert registry.get_config_schema("QUIZ") is None


def test_workspace_tools_endpoint_includes_render_descriptor_when_plugin_available(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from crystalith.shared.plugins import registry as registry_mod
    from crystalith.web.app import create_app

    plugin = MockOutputTypePlugin()
    # Mock reason: entry point discovery must be deterministic in tests and cannot depend on host environment.
    monkeypatch.setattr(
        registry_mod,
        "_iter_entry_points",
        lambda group: [StubEntryPoint(name="mock-output", value="x:y", plugin=plugin)],
    )

    settings = Settings()

    with tempfile.TemporaryDirectory() as tempdir:
        db_path = Path(tempdir) / "test.db"
        db_url = f"sqlite+aiosqlite:///{db_path}"
        upgrade_head(db_url)
        manager = create_db_manager(db_url)
        vector_store = InMemoryVectorStore()
        app = create_app(settings=settings, db_manager=manager, vector_store=vector_store)
        with TestClient(app) as client:
            payload = client.get("/v1/workspace/tools").json()

    tools = payload["tools"]
    quiz_tool = next(tool for tool in tools if tool["output_type"] == "QUIZ")
    faq_tool = next(tool for tool in tools if tool["output_type"] == "FAQ")

    assert quiz_tool["render_descriptor"]["layout"] == "cards"
    assert quiz_tool["config_schema"]["topic_placeholder"] == "Topic"
    assert faq_tool["render_descriptor"] is None


def test_plugin_registry_respects_disabled_list(monkeypatch: pytest.MonkeyPatch) -> None:
    from crystalith.shared.plugins import registry as registry_mod

    plugin = MockProviderPlugin()
    # Mock reason: entry point discovery must be deterministic in tests and cannot depend on host environment.
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
    # Mock reason: entry point discovery must be deterministic in tests and cannot depend on host environment.
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

    with tempfile.TemporaryDirectory() as tempdir:
        db_path = Path(tempdir) / "test.db"
        db_url = f"sqlite+aiosqlite:///{db_path}"
        upgrade_head(db_url)
        manager = create_db_manager(db_url)
        vector_store = InMemoryVectorStore()
        app = create_app(settings=settings, db_manager=manager, vector_store=vector_store)
        with TestClient(app) as client:
            payload = client.get("/v1/models").json()

    assert "mock" in payload["providers"]
    assert any(model["id"] == "mock-chat" for model in payload["models"])


def test_models_endpoint_hides_disabled_plugin_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    from crystalith.shared.plugins import registry as registry_mod
    from crystalith.web.app import create_app

    plugin = MockProviderPlugin()
    # Mock reason: entry point discovery must be deterministic in tests and cannot depend on host environment.
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

    with tempfile.TemporaryDirectory() as tempdir:
        db_path = Path(tempdir) / "test.db"
        db_url = f"sqlite+aiosqlite:///{db_path}"
        upgrade_head(db_url)
        manager = create_db_manager(db_url)
        vector_store = InMemoryVectorStore()
        app = create_app(settings=settings, db_manager=manager, vector_store=vector_store)
        with TestClient(app) as client:
            payload = client.get("/v1/models").json()

    assert "mock" not in payload["providers"]
    assert payload["models"] == []
