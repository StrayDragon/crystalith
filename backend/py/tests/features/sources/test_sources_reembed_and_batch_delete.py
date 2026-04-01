from __future__ import annotations

import pytest

from crystalith.shared.db import Chunk, Source
from crystalith.shared.types import SourceStatus


@pytest.mark.asyncio
async def test_sources_reembed_single_and_batch_delete(client, app, db_session) -> None:
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Sources Reembed"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    ready = Source(
        notebook_id=notebook_id,
        filename="ready.txt",
        mime_type="text/plain",
        parser_type="text",
        status=SourceStatus.READY,
    )
    failed = Source(
        notebook_id=notebook_id,
        filename="failed.txt",
        mime_type="text/plain",
        parser_type="text",
        status=SourceStatus.FAILED,
    )
    db_session.add_all([ready, failed])
    await db_session.flush()

    ready_chunk = Chunk(source_id=ready.id, chunk_index=0, text="ready chunk")
    failed_chunk = Chunk(source_id=failed.id, chunk_index=0, text="failed chunk")
    db_session.add_all([ready_chunk, failed_chunk])
    await db_session.commit()

    # Single re-embed requires FAILED status.
    bad = await client.post(
        f"/v1/notebooks/{notebook_id}/sources/{ready.id}/re-embed",
    )
    assert bad.status_code == 400

    before = tuple(await app.state.vector_store.entries())
    ok = await client.post(
        f"/v1/notebooks/{notebook_id}/sources/{failed.id}/re-embed",
    )
    assert ok.status_code == 200
    assert ok.json()["status"] == SourceStatus.READY.value
    assert ok.json()["chunk_count"] >= 1

    after = tuple(await app.state.vector_store.entries())
    assert len(after) > len(before)
    assert any(entry.source_id == failed.id for entry in after)

    deleted = await client.request(
        "DELETE",
        f"/v1/notebooks/{notebook_id}/sources/batch",
        json={"source_ids": [failed.id]},
    )
    assert deleted.status_code == 200
    assert deleted.json()["deleted_count"] == 1
    assert deleted.json()["deleted_ids"] == [failed.id]
