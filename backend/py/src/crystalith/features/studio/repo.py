from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.db import StudioSlide


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
    slide = StudioSlide(
        notebook_id=notebook_id,
        title=title,
        prompt=prompt,
        engine=engine,
        chunk_ids=chunk_ids,
        generation_config=generation_config,
    )
    session.add(slide)
    await session.commit()
    await session.refresh(slide)
    return slide


async def list_slides(session: AsyncSession, *, notebook_id: int) -> list[StudioSlide]:
    result = await session.execute(
        select(StudioSlide)
        .where(StudioSlide.notebook_id == notebook_id)
        .order_by(StudioSlide.updated_at.desc())
    )
    return list(result.scalars().all())


async def get_slide(session: AsyncSession, slide_id: int) -> StudioSlide | None:
    return await session.get(StudioSlide, slide_id)


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
    if title is not None:
        slide.title = title
    if prompt is not None:
        slide.prompt = prompt
    if engine is not None:
        slide.engine = engine
    if chunk_ids is not None:
        slide.chunk_ids = chunk_ids
    if generation_config is not None:
        slide.generation_config = generation_config
    await session.commit()
    await session.refresh(slide)
    return slide


async def delete_slide(session: AsyncSession, slide: StudioSlide) -> None:
    await session.delete(slide)
    await session.commit()
