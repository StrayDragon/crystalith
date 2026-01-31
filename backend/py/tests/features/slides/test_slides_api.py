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
