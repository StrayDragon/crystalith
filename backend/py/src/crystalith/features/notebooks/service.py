from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.db import Notebook

from . import repo


async def create_notebook(session: AsyncSession, *, name: str) -> Notebook:
    return await repo.create_notebook(session, name=name)


async def list_notebooks(session: AsyncSession) -> list[Notebook]:
    return await repo.list_notebooks(session)


async def get_notebook(session: AsyncSession, notebook_id: int) -> Notebook | None:
    return await repo.get_notebook(session, notebook_id)


async def update_notebook(session: AsyncSession, notebook: Notebook, *, name: str) -> Notebook:
    return await repo.update_notebook(session, notebook, name=name)


async def delete_notebook(session: AsyncSession, notebook: Notebook) -> None:
    await repo.delete_notebook(session, notebook)
