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

