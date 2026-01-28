from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.db.deps import get_db_session

from . import service
from .schemas import NotebookCreate, NotebookRead, NotebookUpdate


router = APIRouter(prefix="/v1/notebooks", tags=["notebooks"])


@router.post("", response_model=NotebookRead, status_code=status.HTTP_201_CREATED)
async def create_notebook(
    payload: NotebookCreate,
    session: AsyncSession = Depends(get_db_session),
) -> NotebookRead:
    notebook = await service.create_notebook(session, name=payload.name)
    return NotebookRead.model_validate(notebook)


@router.get("", response_model=list[NotebookRead])
async def list_notebooks(
    session: AsyncSession = Depends(get_db_session),
) -> list[NotebookRead]:
    notebooks = await service.list_notebooks(session)
    return [NotebookRead.model_validate(item) for item in notebooks]


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
) -> NotebookRead:
    notebook = await service.get_notebook(session, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")
    notebook = await service.update_notebook(session, notebook, name=payload.name)
    return NotebookRead.model_validate(notebook)


@router.delete("/{notebook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notebook(
    notebook_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    notebook = await service.get_notebook(session, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")
    await service.delete_notebook(session, notebook)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
