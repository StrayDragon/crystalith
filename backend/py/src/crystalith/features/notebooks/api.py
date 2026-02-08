from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.cache import CacheProvider
from crystalith.shared.deps import get_cache_provider, get_db_session

from . import service
from .schemas import NotebookCreate, NotebookRead, NotebookUpdate


router = APIRouter(prefix="/v1/notebooks", tags=["notebooks"])


@router.post("", response_model=NotebookRead, status_code=status.HTTP_201_CREATED)
async def create_notebook(
    payload: NotebookCreate,
    template_id: int | None = Query(None, ge=1),
    session: AsyncSession = Depends(get_db_session),
    cache: CacheProvider = Depends(get_cache_provider),
) -> NotebookRead:
    try:
        notebook = await service.create_notebook(
            session,
            name=payload.name,
            template_id=template_id,
            cache=cache,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return NotebookRead.model_validate(notebook)


@router.get("", response_model=list[NotebookRead])
async def list_notebooks(
    session: AsyncSession = Depends(get_db_session),
    cache: CacheProvider = Depends(get_cache_provider),
) -> list[NotebookRead]:
    return await service.list_notebooks(session, cache=cache)


@router.get("/{notebook_id}", response_model=NotebookRead)
async def get_notebook(
    notebook_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> NotebookRead:
    notebook = await service.get_notebook(session, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")
    return NotebookRead.model_validate(notebook)


@router.patch("/{notebook_id}", response_model=NotebookRead)
async def update_notebook(
    notebook_id: int,
    payload: NotebookUpdate,
    session: AsyncSession = Depends(get_db_session),
    cache: CacheProvider = Depends(get_cache_provider),
) -> NotebookRead:
    notebook = await service.get_notebook(session, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")
    notebook = await service.update_notebook(session, notebook, name=payload.name, cache=cache)
    return NotebookRead.model_validate(notebook)


@router.delete("/{notebook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notebook(
    notebook_id: int,
    session: AsyncSession = Depends(get_db_session),
    cache: CacheProvider = Depends(get_cache_provider),
) -> Response:
    notebook = await service.get_notebook(session, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")
    await service.delete_notebook(session, notebook, cache=cache)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
