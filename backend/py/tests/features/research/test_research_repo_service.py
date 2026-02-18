from __future__ import annotations

import pytest

from crystalith.features.research import repo as research_repo
from crystalith.features.research import schemas as research_schemas
from crystalith.features.research import service as research_service
from crystalith.shared.db import Notebook
from crystalith.shared.types import ResearchStatus


@pytest.mark.asyncio
async def test_research_repo_and_service_roundtrip(db_session) -> None:
    notebook = Notebook(name="Research Repo Notebook")
    db_session.add(notebook)
    await db_session.commit()
    await db_session.refresh(notebook)

    assert await research_service.get_notebook(db_session, notebook.id) is not None

    created = await research_service.create_session(
        db_session,
        notebook_id=notebook.id,
        topic="Repo Topic",
    )
    assert created.notebook_id == notebook.id
    assert created.topic == "Repo Topic"
    assert created.status == ResearchStatus.PLANNING

    listed = await research_service.list_sessions(db_session, notebook_id=notebook.id)
    assert [item.id for item in listed] == [created.id]

    fetched = await research_service.get_session(db_session, created.id)
    assert fetched is not None
    assert fetched.id == created.id

    payload = research_schemas.ResearchSessionCreate(topic="x")
    assert payload.topic == "x"

    read = research_schemas.ResearchSessionRead.model_validate(created)
    assert read.id == created.id
    assert read.status == ResearchStatus.PLANNING

    await research_service.delete_session(db_session, created)
    assert await research_repo.get_session(db_session, created.id) is None
