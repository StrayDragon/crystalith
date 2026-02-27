from __future__ import annotations

import pytest

from crystalith.shared.db import Chunk, Source
from crystalith.shared.types import SourceStatus


@pytest.mark.asyncio
async def test_qa_response_citations_are_mapped_and_1_based(db_session, client, app):
    create_resp = await client.post("/v1/notebooks", json={"name": "Contract QA Notebook"})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()["id"]

    source = Source(
        notebook_id=notebook_id,
        filename="Doc.md",
        status=SourceStatus.READY,
    )
    db_session.add(source)
    await db_session.flush()

    chunk = Chunk(source_id=source.id, chunk_index=1, text="Test chunk content for citations contract.")
    db_session.add(chunk)
    await db_session.commit()

    await app.state.vector_store.add(
        notebook_id=notebook_id,
        source_id=source.id,
        chunk_ids=[chunk.id],
        vectors=[[1.0, 0.0, 0.0]],
    )

    qa_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/qa",
        json={"question": "What is this?", "source_ids": [source.id]},
    )
    assert qa_resp.status_code == 200
    payload = qa_resp.json()
    assert isinstance(payload.get("citations"), list)
    assert payload["citations"], "Expected at least one citation when evidence is available"

    citation = payload["citations"][0]
    assert citation["source_id"] == source.id
    assert citation["chunk_id"] == chunk.id
    assert citation["chunk_index"] >= 1
    assert isinstance(citation["source_name"], str) and citation["source_name"]
    assert isinstance(citation["snippet"], str) and citation["snippet"]
