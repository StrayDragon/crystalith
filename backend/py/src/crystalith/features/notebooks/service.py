from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from cl_logs.logging import get_logger

from crystalith.shared.cache.interfaces import CacheProvider
from crystalith.shared.db import Notebook

from . import repo
from .schemas import NotebookRead


_NOTEBOOKS_LIST_CACHE_KEY = "notebooks:list"
logger = get_logger(__name__)


async def create_notebook(
    session: AsyncSession,
    *,
    name: str,
    cache: CacheProvider | None = None,
) -> Notebook:
    notebook = await repo.create_notebook(session, name=name)
    if cache is not None:
        await cache.delete(_NOTEBOOKS_LIST_CACHE_KEY)
    return notebook


async def list_notebooks(
    session: AsyncSession,
    cache: CacheProvider | None = None,
) -> list[NotebookRead]:
    if cache is not None:
        cached = await cache.get(_NOTEBOOKS_LIST_CACHE_KEY)
        if cached is not None:
            logger.info("cache_hit", key=_NOTEBOOKS_LIST_CACHE_KEY)
            return [NotebookRead.model_validate(item) for item in cached]
        logger.info("cache_miss", key=_NOTEBOOKS_LIST_CACHE_KEY)

    notebooks = await repo.list_notebooks(session)
    payload = [NotebookRead.model_validate(item) for item in notebooks]
    if cache is not None:
        await cache.set(
            _NOTEBOOKS_LIST_CACHE_KEY,
            [item.model_dump(mode="json") for item in payload],
        )
    return payload


async def get_notebook(session: AsyncSession, notebook_id: int) -> Notebook | None:
    return await repo.get_notebook(session, notebook_id)


async def update_notebook(
    session: AsyncSession,
    notebook: Notebook,
    *,
    name: str,
    cache: CacheProvider | None = None,
) -> Notebook:
    notebook = await repo.update_notebook(session, notebook, name=name)
    if cache is not None:
        await cache.delete(_NOTEBOOKS_LIST_CACHE_KEY)
    return notebook


async def delete_notebook(
    session: AsyncSession,
    notebook: Notebook,
    cache: CacheProvider | None = None,
) -> None:
    await repo.delete_notebook(session, notebook)
    if cache is not None:
        await cache.delete(_NOTEBOOKS_LIST_CACHE_KEY)
