from __future__ import annotations

import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.agents.deps import StudioDeps
from crystalith.agents.output_graph import OutputState, run_output_graph
from crystalith.config import Settings
from crystalith.db import Notebook, Output
from crystalith.outputs import OutputType

from .deps import get_db_session, get_embedding_provider, get_settings, get_vector_store


router = APIRouter(prefix="/v1/notebooks/{notebook_id}/outputs", tags=["outputs"])


class OutputGenerateRequest(BaseModel):
    prompt: str | None = None
    chunk_ids: list[int] | None = None
    top_k: int = Field(5, ge=1, le=20)
    min_score: float = Field(0.2, ge=0.0, le=1.0)

    @field_validator("prompt")
    @classmethod
    def _normalize_prompt(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = " ".join(value.strip().split())
        return cleaned or None


class OutputRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    notebook_id: int
    type: OutputType
    prompt: str | None
    chunk_ids: list[int] | None
    content: dict[str, Any]
    created_at: datetime.datetime
    updated_at: datetime.datetime


@router.post("/{output_type}", response_model=OutputRead, status_code=status.HTTP_201_CREATED)
async def create_output(
    notebook_id: int,
    output_type: OutputType,
    payload: OutputGenerateRequest,
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
    embedder=Depends(get_embedding_provider),
    vector_store=Depends(get_vector_store),
) -> OutputRead:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")

    deps = StudioDeps(
        settings=settings,
        session=session,
        vector_store=vector_store,
        embedder=embedder,
    )
    state: OutputState = {
        "notebook_id": notebook_id,
        "output_type": output_type,
        "prompt": payload.prompt or "",
        "chunk_ids": payload.chunk_ids,
        "top_k": payload.top_k,
        "min_score": payload.min_score,
        "deps": deps,
    }

    try:
        db_output = await run_output_graph(state)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return OutputRead.model_validate(db_output)


@router.get("", response_model=list[OutputRead])
async def list_outputs(
    notebook_id: int,
    session: AsyncSession = Depends(get_db_session),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> list[OutputRead]:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")

    result = await session.execute(
        select(Output)
        .where(Output.notebook_id == notebook_id)
        .order_by(Output.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return [OutputRead.model_validate(item) for item in result.scalars().all()]


@router.get("/{output_id}", response_model=OutputRead)
async def get_output(
    notebook_id: int,
    output_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> OutputRead:
    output = await session.get(Output, output_id)
    if output is None or output.notebook_id != notebook_id:
        raise HTTPException(status_code=404, detail="Output not found")
    return OutputRead.model_validate(output)
