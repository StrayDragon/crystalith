from __future__ import annotations

import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic_ai.exceptions import UnexpectedModelBehavior
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from cl_logs.logging import get_logger

from crystalith.agents.deps import StudioDeps
from crystalith.agents.models import ModelConfigurationError
from crystalith.agents.output_graph import run_output_graph
from crystalith.config import Settings
from crystalith.db import Notebook, Output
from crystalith.outputs import OutputType

from .deps import get_db_session, get_embedding_provider, get_settings, get_vector_store


log = get_logger(__name__)


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

    log.info(
        "creating output",
        notebook_id=notebook_id,
        output_type=output_type.value,
        prompt_length=len(payload.prompt) if payload.prompt else 0,
        chunk_ids_count=len(payload.chunk_ids) if payload.chunk_ids else 0,
    )

    try:
        db_output = await run_output_graph(
            notebook_id=notebook_id,
            output_type=output_type,
            prompt=payload.prompt or "",
            deps=deps,
            chunk_ids=payload.chunk_ids,
            top_k=payload.top_k,
            min_score=payload.min_score,
        )
    except ModelConfigurationError as exc:
        log.warning("model configuration error", error=str(exc))
        raise HTTPException(
            status_code=503,
            detail=f"AI model configuration error: {exc}. Please check your config/app.yaml settings.",
        ) from exc
    except UnexpectedModelBehavior as exc:
        # pydantic_ai validation errors - model output didn't match expected schema
        error_msg = str(exc)
        log.warning(
            "model output validation failed",
            error=error_msg,
            output_type=output_type.value,
        )
        # Provide user-friendly message
        if "maximum retries" in error_msg.lower():
            detail = "AI 模型输出格式不符合预期，已达到最大重试次数。请稍后重试或尝试更简单的提示。"
        else:
            detail = f"AI 模型响应异常：{error_msg[:100]}"
        raise HTTPException(status_code=422, detail=detail) from exc
    except ValueError as exc:
        log.warning("invalid request", error=str(exc))
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        log.error("unexpected error during output generation", exc_info=exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to generate output. Please try again later.",
        ) from exc

    log.info("output created", output_id=db_output.id, output_type=output_type.value)
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
