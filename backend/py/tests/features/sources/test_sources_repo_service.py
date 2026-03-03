from __future__ import annotations

import pytest

from crystalith.features.sources import repo as sources_repo
from crystalith.features.sources import schemas as sources_schemas
from crystalith.features.sources import service as sources_service
from crystalith.shared.db import Notebook
from crystalith.shared.types import SourceStatus


@pytest.mark.asyncio
async def test_sources_repo_and_service_roundtrip(db_session) -> None:
    notebook = Notebook(name="Sources Repo Notebook")
    db_session.add(notebook)
    await db_session.commit()
    await db_session.refresh(notebook)

    created, chunk_count = await sources_service.create_source(
        db_session,
        notebook_id=notebook.id,
        filename="note.md",
        content="Hello world.\n\nSecond paragraph.",
        mime_type="text/markdown",
        parser_type="text",
        metadata={"k": "v"},
    )
    assert created.notebook_id == notebook.id
    assert created.status == SourceStatus.READY
    assert chunk_count >= 1

    assert await sources_repo.count_chunks(db_session, source_id=created.id) == chunk_count

    listed = await sources_service.list_sources(db_session, notebook_id=notebook.id)
    assert [item.id for item in listed] == [created.id]

    fetched = await sources_service.get_source(db_session, created.id)
    assert fetched is not None
    assert fetched.id == created.id

    await sources_service.delete_source(db_session, created)
    assert await sources_repo.get_source(db_session, created.id) is None


@pytest.mark.asyncio
async def test_sources_service_create_without_content_marks_processing(db_session) -> None:
    notebook = Notebook(name="Sources Processing Notebook")
    db_session.add(notebook)
    await db_session.commit()
    await db_session.refresh(notebook)

    created, chunk_count = await sources_service.create_source(
        db_session,
        notebook_id=notebook.id,
        filename="pending.txt",
        content=None,
        mime_type="text/plain",
        parser_type="text",
        metadata=None,
    )
    assert created.status == SourceStatus.PROCESSING
    assert chunk_count == 0
    assert await sources_repo.count_chunks(db_session, source_id=created.id) == 0

    schema_payload = sources_schemas.SourceCreate(filename="a.txt", content="x", parser_type="text")
    assert schema_payload.filename == "a.txt"
    assert schema_payload.content == "x"
