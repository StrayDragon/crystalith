from __future__ import annotations

import datetime
from enum import StrEnum

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from pydantic_ai.exceptions import UnexpectedModelBehavior
from sqlalchemy.ext.asyncio import AsyncSession

from cl_logs.logging import get_logger

from crystalith.agents.deps import StudioDeps
from crystalith.agents.models import ModelConfigurationError
from crystalith.agents.suggestions_graph import run_suggestions_graph
from crystalith.config import Settings
from crystalith.db import Notebook, Session
from crystalith.api.deps import get_db_session, get_embedding_provider, get_settings, get_vector_store

from .generator import Suggestion
from .types import SuggestionType


log = get_logger(__name__)


router = APIRouter(prefix="/v1", tags=["suggestions"])


class SuggestionMode(StrEnum):
    STANDARD = "standard"
    DEEP_DIVE = "deep_dive"


class SuggestionRequest(BaseModel):
    count: int = Field(4, ge=3, le=5)
    mode: SuggestionMode = SuggestionMode.STANDARD
    seed_question: str | None = None


class SuggestionRead(BaseModel):
    question: str
    type: SuggestionType
    context: str


class SuggestionResponse(BaseModel):
    suggestions: list[SuggestionRead]
    created_at: datetime.datetime


@router.post("/notebooks/{notebook_id}/suggestions", response_model=SuggestionResponse)
async def notebook_suggestions(
    notebook_id: int,
    payload: SuggestionRequest,
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
    embedder=Depends(get_embedding_provider),
    vector_store=Depends(get_vector_store),
) -> SuggestionResponse:
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
        "generating notebook suggestions",
        notebook_id=notebook_id,
        count=payload.count,
        mode=payload.mode.value,
    )

    try:
        suggestions = await run_suggestions_graph(
            deps=deps,
            notebook_id=notebook_id,
            count=payload.count,
            mode=payload.mode.value,
            seed_question=payload.seed_question,
        )
    except ModelConfigurationError as exc:
        log.warning("model configuration error", error=str(exc))
        raise HTTPException(
            status_code=503,
            detail=f"AI model configuration error: {exc}. Please check your config/app.yaml settings.",
        ) from exc
    except UnexpectedModelBehavior as exc:
        error_msg = str(exc)
        log.warning("model output validation failed", error=error_msg)
        if "maximum retries" in error_msg.lower():
            detail = "AI 模型输出格式不符合预期，已达到最大重试次数。请稍后重试。"
        else:
            detail = f"AI 模型响应异常：{error_msg[:100]}"
        raise HTTPException(status_code=422, detail=detail) from exc
    except ValueError as exc:
        log.warning("invalid request", error=str(exc))
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        log.error("unexpected error during suggestion generation", exc_info=exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to generate suggestions. Please try again later.",
        ) from exc

    log.info("notebook suggestions generated", count=len(suggestions))
    created_at = datetime.datetime.now(datetime.UTC)
    return _build_response(suggestions, created_at)


@router.post("/sessions/{session_id}/suggestions", response_model=SuggestionResponse)
async def session_suggestions(
    session_id: int,
    payload: SuggestionRequest,
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
    embedder=Depends(get_embedding_provider),
    vector_store=Depends(get_vector_store),
) -> SuggestionResponse:
    db_session = await session.get(Session, session_id)
    if db_session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    deps = StudioDeps(
        settings=settings,
        session=session,
        vector_store=vector_store,
        embedder=embedder,
    )

    log.info(
        "generating session suggestions",
        session_id=session_id,
        count=payload.count,
        mode=payload.mode.value,
    )

    try:
        suggestions = await run_suggestions_graph(
            deps=deps,
            session_id=session_id,
            count=payload.count,
            mode=payload.mode.value,
            seed_question=payload.seed_question,
        )
    except ModelConfigurationError as exc:
        log.warning("model configuration error", error=str(exc))
        raise HTTPException(
            status_code=503,
            detail=f"AI model configuration error: {exc}. Please check your config/app.yaml settings.",
        ) from exc
    except UnexpectedModelBehavior as exc:
        error_msg = str(exc)
        log.warning("model output validation failed", error=error_msg)
        if "maximum retries" in error_msg.lower():
            detail = "AI 模型输出格式不符合预期，已达到最大重试次数。请稍后重试。"
        else:
            detail = f"AI 模型响应异常：{error_msg[:100]}"
        raise HTTPException(status_code=422, detail=detail) from exc
    except ValueError as exc:
        log.warning("invalid request", error=str(exc))
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        log.error("unexpected error during suggestion generation", exc_info=exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to generate suggestions. Please try again later.",
        ) from exc

    log.info("session suggestions generated", count=len(suggestions))
    created_at = datetime.datetime.now(datetime.UTC)
    return _build_response(suggestions, created_at)


def _build_response(suggestions: list[Suggestion], created_at: datetime.datetime) -> SuggestionResponse:
    items = [
        SuggestionRead(question=item.question, type=item.type, context=item.context)
        for item in suggestions
    ]
    return SuggestionResponse(suggestions=items, created_at=created_at)
