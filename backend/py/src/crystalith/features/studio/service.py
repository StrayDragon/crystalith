from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.db import Notebook, StudioSlide

from . import repo


async def get_notebook(session: AsyncSession, notebook_id: int) -> Notebook | None:
    return await session.get(Notebook, notebook_id)


async def create_slide(
    session: AsyncSession,
    *,
    notebook_id: int,
    title: str | None,
    prompt: str | None,
    engine: str,
    chunk_ids: list[int] | None,
    generation_config: dict | None,
) -> StudioSlide:
    return await repo.create_slide(
        session,
        notebook_id=notebook_id,
        title=title,
        prompt=prompt,
        engine=engine,
        chunk_ids=chunk_ids,
        generation_config=generation_config,
    )


async def list_slides(session: AsyncSession, *, notebook_id: int) -> list[StudioSlide]:
    return await repo.list_slides(session, notebook_id=notebook_id)


async def get_slide(session: AsyncSession, slide_id: int) -> StudioSlide | None:
    return await repo.get_slide(session, slide_id)


async def update_slide(
    session: AsyncSession,
    slide: StudioSlide,
    *,
    title: str | None,
    prompt: str | None,
    engine: str | None,
    chunk_ids: list[int] | None,
    generation_config: dict | None,
) -> StudioSlide:
    return await repo.update_slide(
        session,
        slide,
        title=title,
        prompt=prompt,
        engine=engine,
        chunk_ids=chunk_ids,
        generation_config=generation_config,
    )


async def delete_slide(session: AsyncSession, slide: StudioSlide) -> None:
    await repo.delete_slide(session, slide)
