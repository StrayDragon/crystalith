from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.db import Notebook, Output
from crystalith.shared.types import OutputType

from . import repo


async def get_notebook(session: AsyncSession, notebook_id: int) -> Notebook | None:
    return await session.get(Notebook, notebook_id)


async def create_output(
    session: AsyncSession,
    *,
    notebook_id: int,
    output_type: OutputType,
    prompt: str | None,
    content: dict | None,
) -> Output:
    normalized = content or {}
    if not normalized and prompt:
        normalized = {"content": prompt}
    return await repo.create_output(
        session,
        notebook_id=notebook_id,
        output_type=output_type,
        prompt=prompt,
        content=normalized,
    )


async def list_outputs(
    session: AsyncSession,
    *,
    notebook_id: int,
    offset: int,
    limit: int,
) -> list[Output]:
    return await repo.list_outputs(session, notebook_id=notebook_id, offset=offset, limit=limit)


async def get_output(session: AsyncSession, output_id: int) -> Output | None:
    return await repo.get_output(session, output_id)


async def delete_output(session: AsyncSession, output: Output) -> None:
    await repo.delete_output(session, output)
