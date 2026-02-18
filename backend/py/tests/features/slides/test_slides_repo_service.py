from __future__ import annotations

import pytest

from crystalith.features.studio import repo as studio_repo
from crystalith.features.studio import schemas as studio_schemas
from crystalith.features.studio import service as studio_service
from crystalith.shared.db import Notebook, Source
from crystalith.shared.types import SlideStage, SlideStatus, SourceStatus


@pytest.mark.asyncio
async def test_studio_repo_and_service_roundtrip(db_session) -> None:
    notebook = Notebook(name="Studio Repo Notebook")
    db_session.add(notebook)
    await db_session.commit()
    await db_session.refresh(notebook)

    source = Source(notebook_id=notebook.id, filename="doc.md", status=SourceStatus.READY)
    db_session.add(source)
    await db_session.commit()
    await db_session.refresh(source)

    draft = await studio_service.create_slide(
        db_session,
        notebook_id=notebook.id,
        title="Deck",
        prompt="p",
        engine="slidev",
        chunk_ids=None,
        source_ids=[source.id],
        generation_config=None,
    )
    assert draft.notebook_id == notebook.id
    assert draft.title == "Deck"
    assert draft.status == SlideStatus.IDLE
    assert draft.stage == SlideStage.INPUT

    listed = await studio_service.list_slides(db_session, notebook_id=notebook.id)
    assert [item.id for item in listed] == [draft.id]

    fetched = await studio_repo.get_slide(db_session, draft.id)
    assert fetched is not None
    assert fetched.id == draft.id

    updated = await studio_service.update_slide(
        db_session,
        fetched,
        title="Updated",
        prompt=None,
        engine=None,
        chunk_ids=None,
        source_ids=None,
        generation_config={"a": 1},
    )
    assert updated.title == "Updated"
    assert updated.generation_config == {"a": 1}

    read = studio_schemas.SlideDraftRead.model_validate(updated)
    assert read.id == updated.id

    create_payload = studio_schemas.SlideDraftCreate(title="t", source_ids=[source.id])
    assert create_payload.engine == "slidev"
    update_payload = studio_schemas.SlideDraftUpdate(title="u")
    assert update_payload.title == "u"

    await studio_service.delete_slide(db_session, updated)
    assert await studio_repo.get_slide(db_session, updated.id) is None
