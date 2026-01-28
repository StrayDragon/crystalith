from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.db import Notebook


async def create_notebook(session: AsyncSession, *, name: str) -> Notebook:
    notebook = Notebook(name=name)
    session.add(notebook)
    await session.commit()
    await session.refresh(notebook)
    return notebook


async def list_notebooks(session: AsyncSession) -> list[Notebook]:
    result = await session.execute(select(Notebook).order_by(Notebook.id.asc()))
    return list(result.scalars().all())


async def get_notebook(session: AsyncSession, notebook_id: int) -> Notebook | None:
    return await session.get(Notebook, notebook_id)


async def update_notebook(session: AsyncSession, notebook: Notebook, *, name: str) -> Notebook:
    notebook.name = name
    await session.commit()
    await session.refresh(notebook)
    return notebook


async def delete_notebook(session: AsyncSession, notebook: Notebook) -> None:
    await session.delete(notebook)
    await session.commit()
