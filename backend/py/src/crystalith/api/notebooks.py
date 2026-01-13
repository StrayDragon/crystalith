from __future__ import annotations

import datetime

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.db import Notebook

from .deps import get_db_session


router = APIRouter(prefix="/v1/notebooks", tags=["notebooks"])


class NotebookCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("name must not be empty")
        return trimmed


class NotebookUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("name must not be empty")
        return trimmed


class NotebookRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    created_at: datetime.datetime
    updated_at: datetime.datetime


@router.post("", response_model=NotebookRead, status_code=status.HTTP_201_CREATED)
async def create_notebook(
    payload: NotebookCreate,
    session: AsyncSession = Depends(get_db_session),
) -> NotebookRead:
    notebook = Notebook(name=payload.name)
    session.add(notebook)
    await session.commit()
    await session.refresh(notebook)
    return NotebookRead.model_validate(notebook)


@router.get("", response_model=list[NotebookRead])
async def list_notebooks(
    session: AsyncSession = Depends(get_db_session),
) -> list[NotebookRead]:
    result = await session.execute(select(Notebook).order_by(Notebook.id.asc()))
    return [NotebookRead.model_validate(item) for item in result.scalars().all()]


@router.get("/{notebook_id}", response_model=NotebookRead)
async def get_notebook(
    notebook_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> NotebookRead:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")
    return NotebookRead.model_validate(notebook)


@router.patch("/{notebook_id}", response_model=NotebookRead)
async def update_notebook(
    notebook_id: int,
    payload: NotebookUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> NotebookRead:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")
    notebook.name = payload.name
    await session.commit()
    await session.refresh(notebook)
    return NotebookRead.model_validate(notebook)


@router.delete("/{notebook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notebook(
    notebook_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")
    await session.delete(notebook)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
