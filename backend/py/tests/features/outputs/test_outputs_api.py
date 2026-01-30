from __future__ import annotations

import pytest

from crystalith.shared.db import Source
from crystalith.shared.types import SourceStatus


@pytest.mark.asyncio
async def test_outputs_crud(client, db_session):
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Notebook"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    source = Source(
        notebook_id=notebook_id,
        filename="Doc.md",
        status=SourceStatus.READY,
    )
    db_session.add(source)
    await db_session.commit()
    await db_session.refresh(source)

    create_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/outputs/BULLETS",
        json={"prompt": "Summarize", "source_ids": [source.id]},
    )
    if create_resp.status_code == 503:
        pytest.skip("Model configuration not available")
    assert create_resp.status_code == 201
    output_id = create_resp.json()["id"]

    list_resp = await client.get(f"/v1/notebooks/{notebook_id}/outputs")
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1

    get_resp = await client.get(
        f"/v1/notebooks/{notebook_id}/outputs/{output_id}"
    )
    assert get_resp.status_code == 200

    delete_resp = await client.delete(
        f"/v1/notebooks/{notebook_id}/outputs/{output_id}"
    )
    assert delete_resp.status_code == 204

    missing_resp = await client.get(
        f"/v1/notebooks/{notebook_id}/outputs/{output_id}"
    )
    assert missing_resp.status_code == 404
