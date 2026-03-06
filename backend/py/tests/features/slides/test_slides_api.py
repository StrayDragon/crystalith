from __future__ import annotations

import pytest

from crystalith.shared.db import Source
from crystalith.shared.types import SourceStatus


@pytest.mark.asyncio
async def test_slides_crud(client, db_session):
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Notebook"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    source = Source(
        notebook_id=notebook_id,
        filename="Slides Doc.md",
        status=SourceStatus.READY,
    )
    db_session.add(source)
    await db_session.commit()
    await db_session.refresh(source)

    create_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/slides/drafts",
        json={"title": "Deck", "source_ids": [source.id]},
    )
    assert create_resp.status_code == 201
    slide_id = create_resp.json()["id"]

    latest_resp = await client.get(f"/v1/notebooks/{notebook_id}/slides/drafts/latest")
    assert latest_resp.status_code == 200

    get_resp = await client.get(f"/v1/notebooks/{notebook_id}/slides/drafts/{slide_id}")
    assert get_resp.status_code == 200

    update_resp = await client.patch(
        f"/v1/notebooks/{notebook_id}/slides/drafts/{slide_id}",
        json={"title": "Updated"},
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["title"] == "Updated"


@pytest.mark.asyncio
async def test_slides_latest_missing_and_outline_markdown_put_syncs_output(client, db_session) -> None:
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Slides Put"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    missing_latest = await client.get(f"/v1/notebooks/{notebook_id}/slides/drafts/latest")
    assert missing_latest.status_code == 404

    source = Source(
        notebook_id=notebook_id,
        filename="Slides Doc.md",
        status=SourceStatus.READY,
    )
    db_session.add(source)
    await db_session.commit()
    await db_session.refresh(source)

    create_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/slides/drafts",
        json={"title": "Deck", "source_ids": [source.id]},
    )
    assert create_resp.status_code == 201
    slide_id = create_resp.json()["id"]

    outline_resp = await client.put(
        f"/v1/notebooks/{notebook_id}/slides/drafts/{slide_id}/outline",
        json={"outline": {"title": "Deck", "slides": [{"title": "S1", "bullets": ["b1"]}]}},
    )
    assert outline_resp.status_code == 200
    assert outline_resp.json()["outline"]["slides"][0]["title"] == "S1"

    markdown_resp = await client.put(
        f"/v1/notebooks/{notebook_id}/slides/drafts/{slide_id}/markdown",
        json={"markdown": "# Deck\\n\\n---\\n\\n## S1\\n- b1"},
    )
    assert markdown_resp.status_code == 200
    output_id = markdown_resp.json()["output_id"]
    assert output_id

    # Second PUT should update the existing output rather than creating a new one.
    markdown_resp2 = await client.put(
        f"/v1/notebooks/{notebook_id}/slides/drafts/{slide_id}/markdown",
        json={"markdown": "# Deck\\n\\n## S1\\n- b1\\n- b2"},
    )
    assert markdown_resp2.status_code == 200
    assert markdown_resp2.json()["output_id"] == output_id

    out = await client.get(f"/v1/notebooks/{notebook_id}/outputs/{output_id}")
    assert out.status_code == 200
    assert out.json()["type"] == "SLIDES"
    assert "- b2" in out.json()["content"]["markdown"]


@pytest.mark.asyncio
async def test_slides_create_rejects_empty_and_invalid_source_ids(client) -> None:
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Slides Errors"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    empty = await client.post(
        f"/v1/notebooks/{notebook_id}/slides/drafts",
        json={"title": "Deck", "source_ids": []},
    )
    assert empty.status_code == 400

    invalid = await client.post(
        f"/v1/notebooks/{notebook_id}/slides/drafts",
        json={"title": "Deck", "source_ids": [0]},
    )
    assert invalid.status_code == 400



@pytest.mark.asyncio
async def test_slides_create_returns_structured_unavailable_detail_when_plugin_missing(client, app, db_session) -> None:
    from crystalith.shared.plugins import PluginRegistry

    notebook_resp = await client.post("/v1/notebooks", json={"name": "Slides Missing Plugin"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    source = Source(
        notebook_id=notebook_id,
        filename="Slides Doc.md",
        status=SourceStatus.READY,
    )
    db_session.add(source)
    await db_session.commit()
    await db_session.refresh(source)

    original_plugins = app.state.plugins
    app.state.plugins = PluginRegistry()
    try:
        create_resp = await client.post(
            f"/v1/notebooks/{notebook_id}/slides/drafts",
            json={"title": "Deck", "source_ids": [source.id]},
        )
    finally:
        app.state.plugins = original_plugins

    assert create_resp.status_code == 409
    detail = create_resp.json(); detail = detail.get("detail", detail)
    assert detail["error_code"] == "slides_plugin_required"
    assert "hint" in detail
    assert detail["details"]["available_plugin_ids"] == []
