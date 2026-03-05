from __future__ import annotations

from crystalith.shared.plugins.compliance import check_plugin
from crystalith.shared.plugins.interfaces import PLUGIN_API_VERSION


def test_check_plugin_reports_when_no_supported_interface() -> None:
    issues = check_plugin("noop", object())
    assert "plugin does not implement any supported plugin interfaces" in issues


def test_check_plugin_reports_api_version_mismatch() -> None:
    class Plugin:
        api_version = "v0"

    issues = check_plugin("bad-version", Plugin())
    assert any("api_version mismatch" in issue for issue in issues)
    assert "plugin does not implement any supported plugin interfaces" in issues


def test_check_plugin_validates_ai_provider_callables() -> None:
    class Plugin:
        api_version = PLUGIN_API_VERSION
        create_chat_provider = 123

        def create_embedding_provider(self, *_args, **_kwargs):  # noqa: ANN002, ANN003
            raise AssertionError("should not be called")

    issues = check_plugin("ai", Plugin())
    assert "AIProviderPlugin missing callable: create_chat_provider" in issues


def test_check_plugin_validates_ai_provider_embedding_callable() -> None:
    class Plugin:
        api_version = PLUGIN_API_VERSION
        create_embedding_provider = 123

        def create_chat_provider(self, *_args, **_kwargs):  # noqa: ANN002, ANN003
            raise AssertionError("should not be called")

    issues = check_plugin("ai", Plugin())
    assert "AIProviderPlugin missing callable: create_embedding_provider" in issues


def test_check_plugin_validates_parser_plugin_fields() -> None:
    class Plugin:
        api_version = PLUGIN_API_VERSION
        parser_type = ""
        supported_mime_types = []
        supported_extensions = []
        create_parser = 123

    issues = check_plugin("parser", Plugin())
    assert "ParserPlugin.parser_type must be a non-empty string" in issues
    assert "ParserPlugin.supported_mime_types must be a set[str]" in issues
    assert "ParserPlugin.supported_extensions must be a set[str]" in issues
    assert "ParserPlugin missing callable: create_parser" in issues


def test_check_plugin_validates_output_type_plugin_fields() -> None:
    class Plugin:
        api_version = PLUGIN_API_VERSION
        output_type = ""
        schema = object  # not a BaseModel subclass
        default_prompt = None
        metadata = "bad"
        render_descriptor = "bad"
        config_schema = "bad"

    issues = check_plugin("output", Plugin())
    assert "OutputTypePlugin.output_type must be a non-empty string" in issues
    assert "OutputTypePlugin.schema must be a pydantic BaseModel subclass" in issues
    assert "OutputTypePlugin.metadata must be an OutputTypePluginMeta instance" in issues
    assert "OutputTypePlugin.render_descriptor must be a RenderDescriptor instance" in issues
    assert "OutputTypePlugin.config_schema must be a PluginConfigSchema instance" in issues


def test_check_plugin_validates_web_extractor_plugin_fields() -> None:
    class Plugin:
        api_version = PLUGIN_API_VERSION
        extractor_type = ""
        display_name = 123
        description = 123
        requires_api_key = "no"
        requires_service = "no"
        create_extractor = 123

    issues = check_plugin("extractor", Plugin())
    assert "WebExtractorPlugin.extractor_type must be a non-empty string" in issues
    assert "WebExtractorPlugin.display_name must be a string or None" in issues
    assert "WebExtractorPlugin.description must be a string or None" in issues
    assert "WebExtractorPlugin.requires_api_key must be a bool" in issues
    assert "WebExtractorPlugin.requires_service must be a bool" in issues
    assert "WebExtractorPlugin missing callable: create_extractor" in issues
