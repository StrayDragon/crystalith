from __future__ import annotations

from typing import Any

import pytest
from fastapi import HTTPException

from crystalith.features.source_connectors import api as source_connectors_api
from crystalith.features.source_connectors.schemas import ImportScope
from crystalith.shared.parsers import DisabledTranscriber, ParserFactory
from crystalith.shared.plugins import PluginRegistry
from crystalith.shared.plugins.registry import PluginSkipDetail


def test_make_jsonschema_validator_raises_http_exception_for_invalid_schema():
    with pytest.raises(HTTPException) as excinfo:
        source_connectors_api._make_jsonschema_validator(  # pyright: ignore[reportPrivateUsage]
            {
                "type": "object",
                "properties": {"root_path": {"type": "not-a-real-jsonschema-type"}},
            }
        )

    exc = excinfo.value
    assert exc.status_code == 500
    assert isinstance(exc.detail, dict)
    assert exc.detail["error_code"] == "CONNECTOR_SCHEMA_INVALID"


def test_validate_with_jsonschema_returns_user_facing_paths():
    schema: dict[str, Any] = {
        "type": "object",
        "additionalProperties": False,
        "properties": {"root_path": {"type": "string"}},
        "required": ["root_path"],
    }

    errors = source_connectors_api._validate_with_jsonschema(  # pyright: ignore[reportPrivateUsage]
        schema, {"root_path": 123, "extra": "nope"}
    )

    assert len(errors) >= 2
    assert any(item.startswith("[root]") for item in errors)
    assert any("root_path" in item for item in errors)


def test_parse_diagnostic_returns_none_for_non_dict():
    parsed = source_connectors_api._parse_diagnostic("nope")  # pyright: ignore[reportPrivateUsage]
    assert parsed is None


def test_parse_diagnostic_coerces_common_fields():
    parsed = source_connectors_api._parse_diagnostic(  # pyright: ignore[reportPrivateUsage]
        {
            "code": "CONNECTOR_WARNING",
            "message": "Something happened",
            "hint": 123,
            "details": {"a": 1},
        }
    )
    assert parsed is not None
    assert parsed.error_code == "CONNECTOR_WARNING"
    assert parsed.message == "Something happened"
    assert parsed.hint == "123"
    assert parsed.details == {"a": 1}


def test_get_connector_plugin_or_409_returns_install_hint_and_diagnostics():
    plugins = PluginRegistry()
    plugins.get_load_report().skipped["connector-missing"] = PluginSkipDetail(
        error_code="PLUGIN_SKIPPED",
        message="Connector plugin was skipped",
        hint="Install connector-missing to enable it.",
    )

    with pytest.raises(HTTPException) as excinfo:
        source_connectors_api._get_connector_plugin_or_409(  # pyright: ignore[reportPrivateUsage]
            "connector-missing",
            plugins=plugins,
        )

    exc = excinfo.value
    assert exc.status_code == 409
    assert isinstance(exc.detail, dict)
    assert exc.detail["error_code"] == "CONNECTOR_UNAVAILABLE"
    assert exc.detail["hint"] == "Install connector-missing to enable it."
    assert exc.detail["details"]["connector_id"] == "connector-missing"
    assert "plugin_diagnostic" in exc.detail["details"]


def test_get_connector_plugin_or_409_falls_back_to_catalog_hint_when_missing_hint():
    plugins = PluginRegistry()
    plugins.get_load_report().skipped["connector-local-directory"] = PluginSkipDetail(
        error_code="PLUGIN_SKIPPED",
        message="Connector plugin was skipped",
        hint=None,
    )

    with pytest.raises(HTTPException) as excinfo:
        source_connectors_api._get_connector_plugin_or_409(  # pyright: ignore[reportPrivateUsage]
            "connector-local-directory",
            plugins=plugins,
        )

    exc = excinfo.value
    assert exc.status_code == 409
    assert isinstance(exc.detail, dict)
    assert exc.detail["error_code"] == "CONNECTOR_UNAVAILABLE"
    assert isinstance(exc.detail.get("hint"), str)


@pytest.mark.asyncio
async def test_get_connector_diagnostics_returns_failure_detail_on_exception():
    class BrokenPlugin:
        async def get_diagnostics(self, settings, connection_config=None):
            raise RuntimeError("boom")

    diagnostics = await source_connectors_api._get_connector_diagnostics(  # pyright: ignore[reportPrivateUsage]
        BrokenPlugin(),
        settings=object(),  # only forwarded to plugin boundary
    )
    assert diagnostics is not None
    assert diagnostics[0].error_code == "CONNECTOR_DIAGNOSTICS_FAILED"


@pytest.mark.asyncio
async def test_get_connector_diagnostics_filters_invalid_items():
    class PluginWithDiagnostics:
        async def get_diagnostics(self, settings, connection_config=None):
            return [
                {"error_code": "D1", "message": "m1"},
                "not-a-dict",
            ]

    diagnostics = await source_connectors_api._get_connector_diagnostics(  # pyright: ignore[reportPrivateUsage]
        PluginWithDiagnostics(),
        settings=object(),  # only forwarded to plugin boundary
    )
    assert diagnostics is not None
    assert [item.error_code for item in diagnostics] == ["D1"]


def test_normalize_snapshot_entry_rejects_non_dict():
    with pytest.raises(HTTPException) as excinfo:
        source_connectors_api._normalize_snapshot_entry("nope")  # pyright: ignore[reportPrivateUsage]

    exc = excinfo.value
    assert exc.status_code == 500
    assert isinstance(exc.detail, dict)
    assert exc.detail["error_code"] == "CONNECTOR_SNAPSHOT_ENTRY_INVALID"


def test_normalize_snapshot_entry_rejects_missing_relative_path():
    with pytest.raises(HTTPException) as excinfo:
        source_connectors_api._normalize_snapshot_entry(  # pyright: ignore[reportPrivateUsage]
            {
                "size_bytes": 0,
                "modified_at": "2026-03-14T00:00:00Z",
            }
        )

    exc = excinfo.value
    assert exc.status_code == 500
    assert isinstance(exc.detail, dict)
    assert exc.detail["error_code"] == "CONNECTOR_SNAPSHOT_ENTRY_INVALID"


def test_normalize_snapshot_entry_rejects_invalid_relative_path():
    with pytest.raises(HTTPException) as excinfo:
        source_connectors_api._normalize_snapshot_entry(  # pyright: ignore[reportPrivateUsage]
            {
                "relative_path": "../note.md",
                "size_bytes": 1,
                "modified_at": "2026-03-14T00:00:00Z",
            }
        )

    exc = excinfo.value
    assert exc.status_code == 500
    assert isinstance(exc.detail, dict)
    assert exc.detail["error_code"] == "CONNECTOR_SNAPSHOT_ENTRY_INVALID_PATH"


def test_normalize_snapshot_entry_coerces_modified_at_and_validates_fields():
    entry = source_connectors_api._normalize_snapshot_entry(  # pyright: ignore[reportPrivateUsage]
        {
            "relative_path": "notes/note.md",
            "size_bytes": 0,
            "modified_at": 123,
        }
    )
    assert entry.modified_at == "123"

    with pytest.raises(HTTPException) as excinfo:
        source_connectors_api._normalize_snapshot_entry(  # pyright: ignore[reportPrivateUsage]
            {
                "relative_path": "notes/bad.md",
                "size_bytes": -1,
                "modified_at": "2026-03-14T00:00:00Z",
            }
        )

    exc = excinfo.value
    assert exc.status_code == 500
    assert isinstance(exc.detail, dict)
    assert exc.detail["error_code"] == "CONNECTOR_SNAPSHOT_ENTRY_INVALID"


@pytest.mark.asyncio
async def test_build_snapshot_surfaces_plugin_and_payload_errors():
    class BrokenPlugin:
        async def list_snapshot_entries(self, settings, *, connection_config):
            raise RuntimeError("boom")

    with pytest.raises(HTTPException) as excinfo:
        await source_connectors_api._build_snapshot(  # pyright: ignore[reportPrivateUsage]
            BrokenPlugin(),
            settings=object(),  # only forwarded to plugin boundary
            connection_config={},
        )
    exc = excinfo.value
    assert exc.status_code == 500
    assert isinstance(exc.detail, dict)
    assert exc.detail["error_code"] == "CONNECTOR_SNAPSHOT_FAILED"

    class InvalidPayloadPlugin:
        async def list_snapshot_entries(self, settings, *, connection_config):
            return {"not": "a list"}

    with pytest.raises(HTTPException) as excinfo:
        await source_connectors_api._build_snapshot(  # pyright: ignore[reportPrivateUsage]
            InvalidPayloadPlugin(),
            settings=object(),  # only forwarded to plugin boundary
            connection_config={},
        )
    exc = excinfo.value
    assert exc.status_code == 500
    assert isinstance(exc.detail, dict)
    assert exc.detail["error_code"] == "CONNECTOR_SNAPSHOT_INVALID"

    class DuplicatePayloadPlugin:
        async def list_snapshot_entries(self, settings, *, connection_config):
            return [
                {"relative_path": "notes/a.md", "size_bytes": 1, "modified_at": "t1"},
                {"relative_path": "notes/a.md", "size_bytes": 2, "modified_at": "t2"},
            ]

    with pytest.raises(HTTPException) as excinfo:
        await source_connectors_api._build_snapshot(  # pyright: ignore[reportPrivateUsage]
            DuplicatePayloadPlugin(),
            settings=object(),  # only forwarded to plugin boundary
            connection_config={},
        )
    exc = excinfo.value
    assert exc.status_code == 500
    assert isinstance(exc.detail, dict)
    assert exc.detail["error_code"] == "CONNECTOR_SNAPSHOT_DUPLICATE_PATH"


def test_normalize_import_scope_validates_paths_and_rejects_empty_scope():
    with pytest.raises(HTTPException) as excinfo:
        source_connectors_api._normalize_import_scope(  # pyright: ignore[reportPrivateUsage]
            ImportScope()
        )
    exc = excinfo.value
    assert exc.status_code == 400
    assert isinstance(exc.detail, dict)
    assert exc.detail["error_code"] == "IMPORT_SCOPE_EMPTY"

    with pytest.raises(HTTPException) as excinfo:
        source_connectors_api._normalize_import_scope(  # pyright: ignore[reportPrivateUsage]
            ImportScope(include_directories=["  "], include_files=[""])
        )
    exc = excinfo.value
    assert exc.status_code == 400
    assert isinstance(exc.detail, dict)
    assert exc.detail["error_code"] == "IMPORT_SCOPE_EMPTY"

    with pytest.raises(HTTPException) as excinfo:
        source_connectors_api._normalize_import_scope(  # pyright: ignore[reportPrivateUsage]
            ImportScope(include_directories=["../bad"])
        )
    exc = excinfo.value
    assert exc.status_code == 400
    assert isinstance(exc.detail, dict)
    assert exc.detail["error_code"] == "IMPORT_SCOPE_INVALID_PATH"

    with pytest.raises(HTTPException) as excinfo:
        source_connectors_api._normalize_import_scope(  # pyright: ignore[reportPrivateUsage]
            ImportScope(include_files=["../bad.md"])
        )
    exc = excinfo.value
    assert exc.status_code == 400
    assert isinstance(exc.detail, dict)
    assert exc.detail["error_code"] == "IMPORT_SCOPE_INVALID_PATH"


def test_resolve_parser_for_file_reports_missing_parser_plugin():
    plugins = PluginRegistry()
    plugins.get_load_report().skipped["parser-pdf"] = PluginSkipDetail(
        error_code="PLUGIN_SKIPPED",
        message="PDF parser plugin is missing",
        hint="Install parser-pdf to enable PDF parsing.",
    )

    parser, parser_plugin_id, diagnostic = source_connectors_api._resolve_parser_for_file(  # pyright: ignore[reportPrivateUsage]
        filename="note.pdf",
        mime_type="application/pdf",
        transcriber=DisabledTranscriber(),
        plugins=plugins,
    )

    assert parser is None
    assert parser_plugin_id is None
    assert diagnostic is not None
    assert diagnostic.error_code == "PARSER_PLUGIN_REQUIRED"
    assert diagnostic.hint == "Install parser-pdf to enable PDF parsing."
    assert isinstance(diagnostic.details, dict)
    assert diagnostic.details.get("required_plugin_id") == "parser-pdf"
    assert "plugin_diagnostic" in diagnostic.details
    assert "parser_details" in diagnostic.details


def test_resolve_parser_for_file_reports_unsupported_type_without_plugin():
    parser, parser_plugin_id, diagnostic = source_connectors_api._resolve_parser_for_file(  # pyright: ignore[reportPrivateUsage]
        filename="note.xyz",
        mime_type="application/octet-stream",
        transcriber=DisabledTranscriber(),
        plugins=PluginRegistry(),
    )

    assert parser is None
    assert parser_plugin_id is None
    assert diagnostic is not None
    assert diagnostic.error_code == "UNSUPPORTED_FILE_TYPE"
    assert isinstance(diagnostic.details, dict)
    assert "required_plugin_id" not in diagnostic.details


def test_resolve_parser_for_file_falls_back_for_legacy_parser_factory(monkeypatch):
    original_resolve = ParserFactory.resolve_from_file

    def legacy_resolve_from_file(
        cls,
        *,
        filename,
        mime_type,
        transcriber,
        plugins=None,
        **kwargs,
    ):
        if plugins is not None:
            raise TypeError("resolve_from_file() got an unexpected keyword argument 'plugins'")
        return original_resolve(
            filename=filename,
            mime_type=mime_type,
            transcriber=transcriber,
            **kwargs,
        )

    # Mock reason: simulate older ParserFactory signature to ensure backward-compat fallback path.
    monkeypatch.setattr(ParserFactory, "resolve_from_file", classmethod(legacy_resolve_from_file))

    parser, parser_plugin_id, diagnostic = source_connectors_api._resolve_parser_for_file(  # pyright: ignore[reportPrivateUsage]
        filename="note.md",
        mime_type="text/markdown",
        transcriber=DisabledTranscriber(),
        plugins=PluginRegistry(),
    )

    assert diagnostic is None
    assert parser is not None
    assert parser_plugin_id is None


def test_resolve_parser_for_file_reraises_unexpected_type_error(monkeypatch):
    def _raise_type_error(
        cls,
        *,
        filename,
        mime_type,
        transcriber,
        plugins=None,
        **kwargs,
    ):
        raise TypeError("unexpected failure")

    # Mock reason: force ParserFactory to raise to validate error surfacing behavior.
    monkeypatch.setattr(ParserFactory, "resolve_from_file", classmethod(_raise_type_error))

    with pytest.raises(TypeError):
        source_connectors_api._resolve_parser_for_file(  # pyright: ignore[reportPrivateUsage]
            filename="note.txt",
            mime_type="text/plain",
            transcriber=DisabledTranscriber(),
            plugins=PluginRegistry(),
        )
