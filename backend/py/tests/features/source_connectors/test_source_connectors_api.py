from __future__ import annotations

import asyncio
from pathlib import Path

import pytest


def _write_markdown(path: Path, body: str) -> None:
    path.write_text(body, encoding="utf-8")


@pytest.mark.asyncio
async def test_source_connectors_list_includes_official_connectors(client):
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Connector List"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    resp = await client.get(f"/v1/notebooks/{notebook_id}/source-connectors")
    assert resp.status_code == 200
    payload = resp.json()
    connector_ids = {item["connector_id"] for item in payload["connectors"]}

    assert "connector-obsidian" in connector_ids
    assert "connector-local-directory" in connector_ids


@pytest.mark.asyncio
async def test_source_connectors_list_returns_404_for_missing_notebook(client):
    resp = await client.get("/v1/notebooks/999999/source-connectors")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_connector_binding_returns_expected_errors(client):
    # Missing notebook returns early.
    resp = await client.post(
        "/v1/notebooks/999999/source-connectors/connector-local-directory/bindings",
        json={},
    )
    assert resp.status_code == 404

    notebook_resp = await client.post("/v1/notebooks", json={"name": "Connector Binding Errors"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    # Connector id is required (strip + empty check).
    empty_id_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/source-connectors/%20/bindings",
        json={},
    )
    assert empty_id_resp.status_code == 400

    # Unknown connector id returns 404.
    unknown_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/source-connectors/connector-does-not-exist/bindings",
        json={},
    )
    assert unknown_resp.status_code == 404

    # Invalid connector config is validated with jsonschema.
    invalid_config_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/source-connectors/connector-local-directory/bindings",
        json={"connection_config": {"root_path": 123}},
    )
    assert invalid_config_resp.status_code == 400
    payload = invalid_config_resp.json()
    assert payload["error_code"] == "CONNECTOR_CONFIG_INVALID"
    assert isinstance(payload.get("details", {}).get("errors"), list)


@pytest.mark.asyncio
async def test_sync_check_does_not_import_sources_until_apply(client, tmp_path: Path):
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Connector Sync Check"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    notes_dir = tmp_path / "notes"
    notes_dir.mkdir(parents=True, exist_ok=True)
    _write_markdown(notes_dir / "note.md", "---\n---\n\nv1\n")

    binding_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/source-connectors/connector-local-directory/bindings",
        json={"connection_config": {"root_path": str(tmp_path)}},
    )
    assert binding_resp.status_code == 201
    binding_id = binding_resp.json()["id"]

    import_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/source-connector-bindings/{binding_id}/import-scope",
        json={"include_directories": ["notes"]},
    )
    assert import_resp.status_code == 200

    sources_before = await client.get(f"/v1/notebooks/{notebook_id}/sources")
    assert sources_before.status_code == 200
    assert len(sources_before.json()) == 1

    await asyncio.sleep(0.02)
    _write_markdown(notes_dir / "note.md", "---\n---\n\nv2 updated\n")

    sync_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/source-connector-bindings/{binding_id}/sync-check",
    )
    assert sync_resp.status_code == 200
    sync_payload = sync_resp.json()
    assert any(item["relative_path"] == "notes/note.md" for item in sync_payload["candidates"]["updated"])

    sources_after_sync = await client.get(f"/v1/notebooks/{notebook_id}/sources")
    assert sources_after_sync.status_code == 200
    assert len(sources_after_sync.json()) == 1

    apply_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/source-connector-bindings/{binding_id}/sync-check/apply",
        json={"sync_check_id": sync_payload["id"]},
    )
    assert apply_resp.status_code == 200

    sources_after_apply = await client.get(f"/v1/notebooks/{notebook_id}/sources")
    assert sources_after_apply.status_code == 200
    assert len(sources_after_apply.json()) == 2


@pytest.mark.asyncio
async def test_sync_check_reports_added_updated_missing_candidates(client, tmp_path: Path):
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Connector Candidates"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    notes_dir = tmp_path / "notes"
    notes_dir.mkdir(parents=True, exist_ok=True)
    _write_markdown(notes_dir / "a.md", "---\n---\n\na\n")
    _write_markdown(notes_dir / "b.md", "---\n---\n\nb\n")

    binding_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/source-connectors/connector-local-directory/bindings",
        json={"connection_config": {"root_path": str(tmp_path)}},
    )
    assert binding_resp.status_code == 201
    binding_id = binding_resp.json()["id"]

    import_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/source-connector-bindings/{binding_id}/import-scope",
        json={"include_directories": ["notes"]},
    )
    assert import_resp.status_code == 200

    await asyncio.sleep(0.02)
    _write_markdown(notes_dir / "a.md", "---\n---\n\na updated\n")
    (notes_dir / "b.md").unlink()
    _write_markdown(notes_dir / "c.md", "---\n---\n\nc\n")

    sync_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/source-connector-bindings/{binding_id}/sync-check",
    )
    assert sync_resp.status_code == 200
    payload = sync_resp.json()

    added = {item["relative_path"] for item in payload["candidates"]["added"]}
    updated = {item["relative_path"] for item in payload["candidates"]["updated"]}
    missing = {item["relative_path"] for item in payload["candidates"]["missing"]}

    assert added == {"notes/c.md"}
    assert updated == {"notes/a.md"}
    assert missing == {"notes/b.md"}


@pytest.mark.asyncio
async def test_import_scope_skips_unsupported_files_without_creating_sources(client, tmp_path: Path, monkeypatch):
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Connector Unsupported Import"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    notes_dir = tmp_path / "notes"
    notes_dir.mkdir(parents=True, exist_ok=True)
    (notes_dir / "note.txt").write_bytes(b"some bytes")

    from crystalith.shared.parsers import UnsupportedDocumentError
    from crystalith.shared.parsers.factory import ParserFactory

    def _unsupported_parser_factory(  # noqa: ANN001
        cls,
        *,
        filename,
        mime_type,
        transcriber=None,
        media_fetcher=None,
        plugins=None,
    ):
        raise UnsupportedDocumentError(
            "Unsupported file type",
            required_plugin_id=None,
            details={"filename": filename, "mime_type": mime_type},
        )

    # Mock reason: force parser resolution to return UNSUPPORTED_FILE_TYPE to cover import-scope skip semantics.
    monkeypatch.setattr(ParserFactory, "resolve_from_file", classmethod(_unsupported_parser_factory))

    binding_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/source-connectors/connector-local-directory/bindings",
        json={"connection_config": {"root_path": str(tmp_path)}},
    )
    assert binding_resp.status_code == 201
    binding_id = binding_resp.json()["id"]

    import_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/source-connector-bindings/{binding_id}/import-scope",
        json={"include_directories": ["notes"]},
    )
    assert import_resp.status_code == 200
    payload = import_resp.json()

    result_by_path = {item["relative_path"]: item for item in payload["results"]}
    item = result_by_path["notes/note.txt"]
    assert item["status"] == "skipped"
    assert item["diagnostic"]["error_code"] == "UNSUPPORTED_FILE_TYPE"

    sources_resp = await client.get(f"/v1/notebooks/{notebook_id}/sources")
    assert sources_resp.status_code == 200
    assert sources_resp.json() == []
