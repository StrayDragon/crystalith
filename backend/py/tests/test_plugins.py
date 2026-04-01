from __future__ import annotations

import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, ClassVar

import pytest
from fastapi.testclient import TestClient
from pydantic import BaseModel

from crystalith.shared.config import ModelConfig, ModelsSettings, PluginsSettings, Settings
from crystalith.shared.db import create_db_manager
from crystalith.shared.db.migrations import upgrade_head
from crystalith.shared.plugins import PluginRegistry
from crystalith.shared.plugins.render_types import (
    ConfigOption,
    FieldDescriptor,
    FrontendBundleDescriptor,
    ItemSchema,
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


def _make_entry_points_provider(entry_points: list[Any]):
    def _provider(_group: str):
        return entry_points

    return _provider


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

    output_type: str = "QUIZ"
    schema: type[BaseModel] = _MockOutputSchema
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

    frontend_bundle = FrontendBundleDescriptor(id="output-quiz-custom", export="render")



class MockSlidesWorkflowPlugin:
    api_version = "v1"

    def __init__(self, engine: str = "slidev") -> None:
        self.engine = engine
        self.default_prompt = "slides prompt"
        self.metadata = OutputTypePluginMeta(
            description="Slides plugin",
            display_text="Slides",
            tone="indigo",
        )
        self.config_schema = PluginConfigSchema(
            defaults={"quantity": "standard", "language": "zh"},
            quantity_options=[ConfigOption(id="standard", label="Standard", is_default=True)],
            engine=engine,
        )
        self.preview_descriptor = None
        self.frontend_bundle = FrontendBundleDescriptor(id="output-slides", export="render")

    async def generate_outline(self, *_args, **_kwargs):
        raise AssertionError("should not be called")

    async def generate_markdown(self, *_args, **_kwargs):
        raise AssertionError("should not be called")


class MockSourceConnectorPlugin:
    api_version = "v1"

    display_name = "Mock Connector"
    description = "Mock connector plugin"
    connection_config_schema: ClassVar[dict[str, object]] = {
        "type": "object",
        "properties": {"path": {"type": "string", "minLength": 1}},
        "required": ["path"],
        "additionalProperties": False,
    }

    supports_snapshot = True
    supports_sync_check = True

    async def get_diagnostics(self, _settings: Any, *, connection_config: Any | None = None) -> Any:
        return None

    async def list_snapshot_entries(self, _settings: Any, *, connection_config: Any) -> Any:
        return []

    async def read_file_bytes(
        self,
        _settings: Any,
        *,
        connection_config: Any,
        relative_path: str,
    ) -> bytes:
        return relative_path.encode()


def test_plugin_registry_loads_ai_provider_plugin() -> None:
    plugin = MockProviderPlugin()

    settings = Settings()
    registry = PluginRegistry()
    report = registry.load_from_entry_points(
        settings,
        entry_points_provider=_make_entry_points_provider(
            [StubEntryPoint(name="mock", value="x:y", plugin=plugin)],
        ),
    )

    assert report.loaded == ["mock"]
    assert registry.ai_providers["mock"] is plugin


def test_plugin_registry_loads_ai_provider_plugin_from_class_entry_point(
) -> None:
    settings = Settings()
    registry = PluginRegistry()
    report = registry.load_from_entry_points(
        settings,
        entry_points_provider=_make_entry_points_provider(
            [StubEntryPoint(name="mock", value="x:y", plugin=MockProviderPlugin)],
        ),
    )

    assert report.loaded == ["mock"]
    assert isinstance(registry.ai_providers["mock"], MockProviderPlugin)


def test_plugin_registry_loads_parser_plugin() -> None:
    class MockParserPlugin:
        api_version = "v1"
        parser_type = "mock-parser"
        supported_mime_types: ClassVar[set[str]] = {"text/plain"}
        supported_extensions: ClassVar[set[str]] = {".txt"}

        def create_parser(self, *_args, **_kwargs):
            raise AssertionError("should not be called")

    plugin = MockParserPlugin()

    settings = Settings()
    registry = PluginRegistry()
    report = registry.load_from_entry_points(
        settings,
        entry_points_provider=_make_entry_points_provider(
            [StubEntryPoint(name="mock-parser-plugin", value="x:y", plugin=plugin)],
        ),
    )

    assert report.loaded == ["mock-parser-plugin"]
    assert registry.parsers["mock-parser"] is plugin
    assert registry.list_parsers() == ["mock-parser"]


def test_plugin_registry_loads_web_extractor_plugin() -> None:
    class MockWebExtractorPlugin:
        api_version = "v1"
        extractor_type = "jina"
        display_name = "Jina"
        description = "Jina Reader"
        requires_api_key = False
        requires_service = True

        def create_extractor(self, *_args, **_kwargs):
            raise AssertionError("should not be called")

    plugin = MockWebExtractorPlugin()

    settings = Settings()
    registry = PluginRegistry()
    report = registry.load_from_entry_points(
        settings,
        entry_points_provider=_make_entry_points_provider(
            [StubEntryPoint(name="extractor-jina", value="x:y", plugin=plugin)],
        ),
    )

    assert report.loaded == ["extractor-jina"]
    assert registry.web_extractors["jina"] is plugin
    assert registry.get_web_extractor_plugin_id("jina") == "extractor-jina"
    assert registry.list_web_extractors() == ["jina"]


def test_plugin_registry_loads_output_type_plugin_and_extension_attributes() -> None:
    plugin = MockOutputTypePlugin()

    settings = Settings()
    registry = PluginRegistry()
    report = registry.load_from_entry_points(
        settings,
        entry_points_provider=_make_entry_points_provider(
            [StubEntryPoint(name="mock-output", value="x:y", plugin=plugin)],
        ),
    )

    assert report.loaded == ["mock-output"]
    assert registry.output_types["QUIZ"] is plugin
    assert registry.output_types["QUIZ"].schema is _MockOutputSchema
    assert registry.output_types["QUIZ"].default_prompt == "plugin prompt"
    assert registry.get_output_type_metadata("QUIZ") == plugin.metadata
    assert registry.get_render_descriptor("QUIZ") == plugin.render_descriptor
    assert registry.get_config_schema("QUIZ") == plugin.config_schema
    assert registry.get_frontend_bundle("QUIZ") == plugin.frontend_bundle


def test_plugin_registry_loads_source_connector_plugin() -> None:
    plugin = MockSourceConnectorPlugin()

    settings = Settings()
    registry = PluginRegistry()
    report = registry.load_from_entry_points(
        settings,
        entry_points_provider=_make_entry_points_provider(
            [StubEntryPoint(name="mock-connector", value="x:y", plugin=plugin)],
        ),
    )

    assert report.loaded == ["mock-connector"]
    assert registry.source_connectors["mock-connector"] is plugin
    assert registry.list_source_connectors() == ["mock-connector"]


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

    settings = Settings()
    registry = PluginRegistry()
    registry.load_from_entry_points(
        settings,
        entry_points_provider=_make_entry_points_provider(
            [
                StubEntryPoint(name="plugin-a", value="x:a", plugin=plugin_a),
                StubEntryPoint(name="plugin-b", value="x:b", plugin=plugin_b),
            ],
        ),
    )

    assert registry.output_types["QUIZ"] is plugin_b
    assert any(message == "output type plugin conflict; overwriting" for message, _ in warnings)


def test_plugin_registry_output_type_plugin_without_extensions_is_ok() -> None:
    class MinimalOutputTypePlugin:
        api_version = "v1"

        output_type = "QUIZ"
        schema = _MockOutputSchema
        default_prompt = None
        metadata = None
        render_descriptor = None
        config_schema = None

    plugin = MinimalOutputTypePlugin()

    settings = Settings()
    registry = PluginRegistry()
    registry.load_from_entry_points(
        settings,
        entry_points_provider=_make_entry_points_provider(
            [StubEntryPoint(name="mock-output", value="x:y", plugin=plugin)],
        ),
    )

    assert registry.output_types["QUIZ"] is plugin
    assert registry.get_output_type_metadata("QUIZ") is None
    assert registry.get_render_descriptor("QUIZ") is None
    assert registry.get_config_schema("QUIZ") is None
    assert registry.get_frontend_bundle("QUIZ") is None


def test_workspace_tools_endpoint_includes_render_descriptor_when_plugin_available() -> None:
    from crystalith.web.app import create_app

    plugin = MockOutputTypePlugin()

    settings = Settings()

    with tempfile.TemporaryDirectory() as tempdir:
        db_path = Path(tempdir) / "test.db"
        db_url = f"sqlite+aiosqlite:///{db_path}"
        upgrade_head(db_url)
        manager = create_db_manager(db_url)
        vector_store = InMemoryVectorStore()
        app = create_app(
            settings=settings,
            db_manager=manager,
            vector_store=vector_store,
            plugins_entry_points_provider=_make_entry_points_provider(
                [StubEntryPoint(name="mock-output", value="x:y", plugin=plugin)],
            ),
        )
        with TestClient(app) as client:
            payload = client.get("/v1/workspace/tools").json()
            config_payload = client.get("/v1/workspace/tools/quiz/config").json()

    tools = payload["tools"]
    quiz_tool = next(tool for tool in tools if tool["output_type"] == "QUIZ")

    assert quiz_tool["render_descriptor"]["layout"] == "cards"
    assert quiz_tool["config_schema"]["topic_placeholder"] == "Topic"
    assert quiz_tool["frontend_bundle"]["id"] == "output-quiz-custom"
    assert config_payload["tool_id"] == "quiz"
    assert config_payload["topic_placeholder"] == "Topic"
    assert config_payload["quantity_options"] == quiz_tool["config_schema"]["quantity_options"]
    assert all(tool["output_type"] != "FAQ" for tool in tools)
    assert all(tool["output_type"] != "SLIDES" for tool in tools)
    assert payload["diagnostics"]["slides"]["error_code"] == "slides_plugin_required"
    assert payload["diagnostics"]["official"]["slides-slidev"]["status"] == "not_installed"
    assert "diagnostics" in payload
    assert "plugins" in payload["diagnostics"]
    assert "official" in payload["diagnostics"]


def test_workspace_tools_endpoint_omits_frontend_bundle_when_feature_disabled() -> None:
    from crystalith.web.app import create_app

    plugin = MockOutputTypePlugin()

    settings = Settings.model_validate(
        {"app": {"features": {"workspace_frontend_bundles_enabled": False}}},
    )

    with tempfile.TemporaryDirectory() as tempdir:
        db_path = Path(tempdir) / "test.db"
        db_url = f"sqlite+aiosqlite:///{db_path}"
        upgrade_head(db_url)
        manager = create_db_manager(db_url)
        vector_store = InMemoryVectorStore()
        app = create_app(
            settings=settings,
            db_manager=manager,
            vector_store=vector_store,
            plugins_entry_points_provider=_make_entry_points_provider(
                [StubEntryPoint(name="mock-output", value="x:y", plugin=plugin)],
            ),
        )
        with TestClient(app) as client:
            payload = client.get("/v1/workspace/tools").json()

    tools = payload["tools"]
    quiz_tool = next(tool for tool in tools if tool["output_type"] == "QUIZ")

    assert quiz_tool["render_descriptor"]["layout"] == "cards"
    assert quiz_tool["frontend_bundle"] is None
    assert all(tool["output_type"] != "SLIDES" for tool in tools)
    assert payload["diagnostics"]["slides"]["error_code"] == "slides_plugin_required"


def test_plugin_registry_respects_disabled_list() -> None:
    plugin = MockProviderPlugin()

    settings = Settings(plugins=PluginsSettings(enabled=None, disabled=["mock"]))
    registry = PluginRegistry()
    report = registry.load_from_entry_points(
        settings,
        entry_points_provider=_make_entry_points_provider(
            [StubEntryPoint(name="mock", value="x:y", plugin=plugin)],
        ),
    )

    assert report.loaded == []
    skipped = report.skipped["mock"]
    assert skipped.error_code == "disabled"
    assert skipped.details["policy"] == "denylist"
    assert skipped.details["entry_point"] == "x:y"
    assert "mock" not in registry.ai_providers


def test_plugin_registry_skips_incompatible_api_version() -> None:
    class BadVersionPlugin(MockProviderPlugin):
        api_version = "v0"

    plugin = BadVersionPlugin()

    settings = Settings()
    registry = PluginRegistry()
    report = registry.load_from_entry_points(
        settings,
        entry_points_provider=_make_entry_points_provider(
            [StubEntryPoint(name="mock", value="x:y", plugin=plugin)],
        ),
    )

    assert report.loaded == []
    skipped = report.skipped["mock"]
    assert skipped.error_code == "incompatible_version"
    assert skipped.details["api_version"] == "v0"
    assert skipped.details["supported"] == ["v1"]
    assert skipped.details["entry_point"] == "x:y"
    assert "mock" not in registry.ai_providers


def test_plugin_registry_disables_plugin_not_in_allowlist() -> None:
    plugin = MockProviderPlugin()

    settings = Settings(plugins=PluginsSettings(enabled=["some-other-plugin"], disabled=[]))
    registry = PluginRegistry()
    report = registry.load_from_entry_points(
        settings,
        entry_points_provider=_make_entry_points_provider(
            [StubEntryPoint(name="mock", value="x:y", plugin=plugin)],
        ),
    )

    assert report.loaded == []
    skipped = report.skipped["mock"]
    assert skipped.error_code == "disabled"
    assert skipped.details["policy"] == "allowlist"
    assert skipped.details["entry_point"] == "x:y"
    assert skipped.to_dict()["error_code"] == "disabled"


def test_plugin_registry_reports_missing_dependency() -> None:
    @dataclass(slots=True)
    class _FailingEntryPoint:
        name: str
        value: str

        def load(self) -> Any:
            raise ModuleNotFoundError("No module named 'missing_pkg'", name="missing_pkg")

    settings = Settings()
    registry = PluginRegistry()
    report = registry.load_from_entry_points(
        settings,
        entry_points_provider=_make_entry_points_provider(
            [_FailingEntryPoint(name="missing", value="missing:plugin")],
        ),
    )

    assert report.loaded == []
    skipped = report.skipped["missing"]
    assert skipped.error_code == "missing_dependency"
    assert skipped.details["missing_module"] == "missing_pkg"
    assert skipped.details["entry_point"] == "missing:plugin"
    assert skipped.to_dict()["error_code"] == "missing_dependency"


def test_plugin_registry_reports_generic_load_error() -> None:
    @dataclass(slots=True)
    class _FailingEntryPoint:
        name: str
        value: str

        def load(self) -> Any:
            raise RuntimeError("boom")

    settings = Settings()
    registry = PluginRegistry()
    report = registry.load_from_entry_points(
        settings,
        entry_points_provider=_make_entry_points_provider(
            [_FailingEntryPoint(name="broken", value="broken:plugin")],
        ),
    )

    assert report.loaded == []
    skipped = report.skipped["broken"]
    assert skipped.error_code == "load_error"
    assert skipped.details["error"] == "RuntimeError"
    assert skipped.details["entry_point"] == "broken:plugin"


def test_plugin_registry_reports_init_error_when_entry_point_returns_non_noarg_class(
) -> None:
    class PluginClass:
        api_version = "v1"

        def __init__(self, required: str) -> None:
            self.required = required

    settings = Settings()
    registry = PluginRegistry()
    report = registry.load_from_entry_points(
        settings,
        entry_points_provider=_make_entry_points_provider(
            [StubEntryPoint(name="needs-args", value="x:y", plugin=PluginClass)],
        ),
    )

    assert report.loaded == []
    skipped = report.skipped["needs-args"]
    assert skipped.error_code == "init_error"
    assert skipped.details["entry_point"] == "x:y"


def test_plugin_registry_reports_no_compatible_interfaces() -> None:
    settings = Settings()
    registry = PluginRegistry()
    report = registry.load_from_entry_points(
        settings,
        entry_points_provider=_make_entry_points_provider(
            [StubEntryPoint(name="noop", value="x:y", plugin=object())],
        ),
    )

    assert report.loaded == []
    skipped = report.skipped["noop"]
    assert skipped.error_code == "no_compatible_interfaces"
    assert skipped.details["entry_point"] == "x:y"


def test_plugin_registry_honors_plugins_load_order() -> None:
    plugin_a = MockProviderPlugin()
    plugin_b = MockProviderPlugin()
    plugin_c = MockProviderPlugin()

    settings = Settings(plugins=PluginsSettings(enabled=None, disabled=[], load_order=["a"]))
    registry = PluginRegistry()
    report = registry.load_from_entry_points(
        settings,
        entry_points_provider=_make_entry_points_provider(
            [
                StubEntryPoint(name="b", value="x:b", plugin=plugin_b),
                StubEntryPoint(name="a", value="x:a", plugin=plugin_a),
                StubEntryPoint(name="c", value="x:c", plugin=plugin_c),
            ],
        ),
    )

    assert report.loaded == ["b", "c", "a"]

def test_plugin_registry_reports_invalid_api_version_type() -> None:
    class BadVersionPlugin:
        api_version = 123

        def create_chat_provider(self, *_args, **_kwargs):
            raise AssertionError("should not be called")

        def create_embedding_provider(self, *_args, **_kwargs):
            raise AssertionError("should not be called")

    plugin = BadVersionPlugin()

    settings = Settings()
    registry = PluginRegistry()
    report = registry.load_from_entry_points(
        settings,
        entry_points_provider=_make_entry_points_provider(
            [StubEntryPoint(name="bad-version", value="x:y", plugin=plugin)],
        ),
    )

    assert report.loaded == []
    skipped = report.skipped["bad-version"]
    assert skipped.error_code == "invalid_api_version"
    assert skipped.details["api_version_type"] == "int"
    assert skipped.details["entry_point"] == "x:y"


def test_plugin_skip_detail_to_dict_omits_empty_fields() -> None:
    from crystalith.shared.plugins.registry import PluginSkipDetail

    detail = PluginSkipDetail(error_code="code", message="message")
    assert detail.to_dict() == {"error_code": "code", "message": "message"}


def test_iter_entry_points_uses_group_kwarg_when_supported(monkeypatch: pytest.MonkeyPatch) -> None:
    from crystalith.shared.plugins import registry as registry_mod

    sentinel = object()

    def fake_entry_points(*_args: Any, **kwargs: Any):
        assert kwargs == {"group": "crystalith.plugins"}
        return [sentinel]

    monkeypatch.setattr(registry_mod.metadata, "entry_points", fake_entry_points)

    assert registry_mod._iter_entry_points("crystalith.plugins") == [sentinel]


def test_output_type_plugin_wrong_extension_attribute_types_are_ignored(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from crystalith.shared.plugins import registry as registry_mod

    warnings: list[tuple[str, dict[str, Any]]] = []

    def _warning(message: str, **kwargs: Any) -> None:
        warnings.append((message, kwargs))

    # Mock reason: capture warning side effects without relying on global logging sinks.
    monkeypatch.setattr(registry_mod.log, "warning", _warning)

    class _Schema(BaseModel):
        value: str

    class BadExtensionsOutputTypePlugin:
        api_version = "v1"
        output_type = "FAQ"
        schema = _Schema
        default_prompt = None
        metadata = "bad"
        render_descriptor = "bad"
        config_schema = "bad"

    plugin = BadExtensionsOutputTypePlugin()

    settings = Settings()
    registry = PluginRegistry()
    report = registry.load_from_entry_points(
        settings,
        entry_points_provider=_make_entry_points_provider(
            [StubEntryPoint(name="bad-output", value="x:y", plugin=plugin)],
        ),
    )

    assert report.loaded == ["bad-output"]
    assert registry.get_output_type_metadata("FAQ") is None
    assert registry.get_render_descriptor("FAQ") is None
    assert registry.get_config_schema("FAQ") is None
    assert any(
        message == "OutputTypePlugin.metadata must be OutputTypePluginMeta; ignoring" for message, _ in warnings
    )
    assert any(
        message == "OutputTypePlugin.render_descriptor must be RenderDescriptor; ignoring" for message, _ in warnings
    )
    assert any(
        message == "OutputTypePlugin.config_schema must be PluginConfigSchema; ignoring" for message, _ in warnings
    )


def test_plugin_registry_query_helpers_list_loaded_plugins() -> None:
    plugin = MockProviderPlugin()

    settings = Settings()
    registry = PluginRegistry()
    registry.load_from_entry_points(
        settings,
        entry_points_provider=_make_entry_points_provider(
            [StubEntryPoint(name="mock", value="x:y", plugin=plugin)],
        ),
    )

    assert registry.is_provider_available("openai") is True
    assert registry.is_provider_available("mock") is True
    assert registry.list_ai_providers() == ["mock"]
    assert registry.list_parsers() == []
    assert registry.list_output_types() == []


def test_models_endpoint_includes_plugin_provider() -> None:
    from crystalith.web.app import create_app

    plugin = MockProviderPlugin()

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
        app = create_app(
            settings=settings,
            db_manager=manager,
            vector_store=vector_store,
            plugins_entry_points_provider=_make_entry_points_provider(
                [StubEntryPoint(name="mock", value="x:y", plugin=plugin)],
            ),
        )
        with TestClient(app) as client:
            payload = client.get("/v1/models").json()

    assert "mock" in payload["providers"]
    assert any(model["id"] == "mock-chat" for model in payload["models"])


def test_models_endpoint_hides_disabled_plugin_provider() -> None:
    from crystalith.web.app import create_app

    plugin = MockProviderPlugin()

    settings = Settings(
        plugins=PluginsSettings(enabled=None, disabled=["mock"]),
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
        app = create_app(
            settings=settings,
            db_manager=manager,
            vector_store=vector_store,
            plugins_entry_points_provider=_make_entry_points_provider(
                [StubEntryPoint(name="mock", value="x:y", plugin=plugin)],
            ),
        )
        with TestClient(app) as client:
            payload = client.get("/v1/models").json()

    assert "mock" not in payload["providers"]
    assert payload["models"] == []


def test_plugin_registry_resolves_single_active_slides_workflow() -> None:
    plugin = MockSlidesWorkflowPlugin()

    settings = Settings()
    registry = PluginRegistry()
    registry.load_from_entry_points(
        settings,
        entry_points_provider=_make_entry_points_provider(
            [StubEntryPoint(name="slides-slidev", value="x:y", plugin=plugin)],
        ),
    )

    selection = registry.resolve_active_slides_workflow(settings)
    assert selection.available is True
    assert selection.plugin_id == "slides-slidev"
    assert selection.plugin is plugin


def test_plugin_registry_reports_ambiguous_slides_workflow_selection() -> None:
    settings = Settings()
    registry = PluginRegistry()
    registry.load_from_entry_points(
        settings,
        entry_points_provider=_make_entry_points_provider(
            [
                StubEntryPoint(
                    name="slides-slidev",
                    value="x:y",
                    plugin=MockSlidesWorkflowPlugin("slidev"),
                ),
                StubEntryPoint(
                    name="slides-marp",
                    value="x:z",
                    plugin=MockSlidesWorkflowPlugin("marp"),
                ),
            ],
        ),
    )

    selection = registry.resolve_active_slides_workflow(settings)
    assert selection.available is False
    assert selection.error_code == "ambiguous_slides_plugin"
    assert selection.details["available_plugin_ids"] == ["slides-marp", "slides-slidev"]


def test_plugin_registry_reports_configured_slides_plugin_unavailable() -> None:
    settings = Settings.model_validate({"slides": {"default_plugin": "slides-slidev"}})
    registry = PluginRegistry()
    registry.load_from_entry_points(settings, entry_points_provider=_make_entry_points_provider([]))

    selection = registry.resolve_active_slides_workflow(settings)
    assert selection.available is False
    assert selection.error_code == "configured_plugin_unavailable"
    assert selection.details["configured_plugin_id"] == "slides-slidev"
    assert selection.to_error_detail()["error_code"] == "configured_plugin_unavailable"
