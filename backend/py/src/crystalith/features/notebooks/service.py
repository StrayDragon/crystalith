from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from cl_logs.logging import get_logger

from crystalith.shared.cache.interfaces import CacheProvider
from ..templates.schemas import TemplateConfig
from crystalith.shared.db import Notebook, Session, SourceTag, Template

from . import repo
from .schemas import NotebookRead


_NOTEBOOKS_LIST_CACHE_KEY = "notebooks:list"
logger = get_logger(__name__)


async def create_notebook(
    session: AsyncSession,
    *,
    name: str,
    template_id: int | None = None,
    cache: CacheProvider | None = None,
) -> Notebook:
    if template_id is None:
        notebook = await repo.create_notebook(session, name=name)
        if cache is not None:
            await cache.delete(_NOTEBOOKS_LIST_CACHE_KEY)
        return notebook

    template = await session.get(Template, template_id)
    if template is None:
        raise ValueError("Template not found")

    config = TemplateConfig.model_validate(template.config_json)

    notebook = Notebook(name=name)
    session.add(notebook)
    await session.flush()

    for title in config.session_titles:
        session.add(Session(notebook_id=notebook.id, title=title))

    for tag_name in config.source_tags:
        session.add(SourceTag(notebook_id=notebook.id, name=tag_name))

    await session.commit()
    await session.refresh(notebook)
    if cache is not None:
        await cache.delete(_NOTEBOOKS_LIST_CACHE_KEY)
    return notebook


async def list_notebooks(
    session: AsyncSession,
    cache: CacheProvider | None = None,
) -> list[NotebookRead]:
    if cache is not None:
        cached = await cache.get(_NOTEBOOKS_LIST_CACHE_KEY)
        if isinstance(cached, list):
            try:
                payload = [NotebookRead.model_validate(item) for item in cached]
            except Exception:  # noqa: BLE001 - tolerate corrupted/legacy cache shapes
                payload = None
            if payload is not None:
                logger.info("cache_hit", key=_NOTEBOOKS_LIST_CACHE_KEY)
                return payload
            try:
                await cache.delete(_NOTEBOOKS_LIST_CACHE_KEY)
            except Exception:  # noqa: BLE001 - best-effort cache cleanup
                pass
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
