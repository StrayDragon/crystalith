from __future__ import annotations

import datetime
from enum import StrEnum

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.ai.interfaces import ChatProvider
from crystalith.db import Chunk, Message, Notebook, Session, Source, SourceStatus
from crystalith.api.deps import get_chat_provider, get_db_session

from .generator import (
    SessionTurn,
    SourceSnippet,
    Suggestion,
    format_session_context,
    format_source_context,
    generate_contextual_suggestions,
    generate_deep_dive_suggestions,
)
from .types import SuggestionType


router = APIRouter(prefix="/v1", tags=["suggestions"])

MAX_SOURCE_SNIPPETS = 6
MAX_SESSION_MESSAGES = 10


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
    chatter: ChatProvider = Depends(get_chat_provider),
) -> SuggestionResponse:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")

    snippets = await _load_source_snippets(session, notebook_id, limit=MAX_SOURCE_SNIPPETS)
    created_at = datetime.datetime.now(datetime.UTC)
    if not snippets:
        return SuggestionResponse(suggestions=[], created_at=created_at)

    context = format_source_context(snippets)
    fallback_context = "notebook sources"

    if payload.mode == SuggestionMode.DEEP_DIVE:
        seed_question = _normalize_seed(payload.seed_question)
        if seed_question is None:
            raise HTTPException(status_code=400, detail="seed_question is required for deep_dive")
        deep_context = f"Deep dive on: {seed_question}"
        suggestions = await generate_deep_dive_suggestions(
            chatter,
            seed_question=seed_question,
            context_text=context,
            count=payload.count,
            fallback_context=deep_context,
        )
    else:
        suggestions = await generate_contextual_suggestions(
            chatter,
            context_label="Sources",
            context_text=context,
            count=payload.count,
            fallback_context=fallback_context,
        )

    return _build_response(suggestions, created_at)


@router.post("/sessions/{session_id}/suggestions", response_model=SuggestionResponse)
async def session_suggestions(
    session_id: int,
    payload: SuggestionRequest,
    session: AsyncSession = Depends(get_db_session),
    chatter: ChatProvider = Depends(get_chat_provider),
) -> SuggestionResponse:
    db_session = await session.get(Session, session_id)
    if db_session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    turns = await _load_session_turns(session, session_id, limit=MAX_SESSION_MESSAGES)
    created_at = datetime.datetime.now(datetime.UTC)
    if not turns:
        return SuggestionResponse(suggestions=[], created_at=created_at)

    context = format_session_context(turns)
    fallback_context = "session history"

    if payload.mode == SuggestionMode.DEEP_DIVE:
        seed_question = _normalize_seed(payload.seed_question) or _last_user_question(turns)
        if seed_question is None:
            raise HTTPException(status_code=400, detail="seed_question is required for deep_dive")
        deep_context = f"Deep dive on: {seed_question}"
        suggestions = await generate_deep_dive_suggestions(
            chatter,
            seed_question=seed_question,
            context_text=context,
            count=payload.count,
            fallback_context=deep_context,
        )
    else:
        suggestions = await generate_contextual_suggestions(
            chatter,
            context_label="Conversation",
            context_text=context,
            count=payload.count,
            fallback_context=fallback_context,
        )

    return _build_response(suggestions, created_at)


async def _load_source_snippets(
    session: AsyncSession,
    notebook_id: int,
    *,
    limit: int,
) -> list[SourceSnippet]:
    rows = await session.execute(
        select(Chunk, Source)
        .join(Source, Source.id == Chunk.source_id)
        .where(
            Source.notebook_id == notebook_id,
            Source.status == SourceStatus.READY,
        )
        .order_by(Source.created_at.desc(), Chunk.chunk_index.asc())
        .limit(limit)
    )
    return [
        SourceSnippet(
            source_name=source.filename,
            chunk_index=chunk.chunk_index,
            text=chunk.text,
        )
        for chunk, source in rows.all()
    ]


async def _load_session_turns(
    session: AsyncSession,
    session_id: int,
    *,
    limit: int,
) -> list[SessionTurn]:
    rows = await session.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at.desc())
        .limit(limit)
    )
    messages = list(rows.scalars().all())
    messages.reverse()
    return [SessionTurn(role=message.role, content=message.content) for message in messages]


def _build_response(suggestions: list[Suggestion], created_at: datetime.datetime) -> SuggestionResponse:
    items = [
        SuggestionRead(question=item.question, type=item.type, context=item.context)
        for item in suggestions
    ]
    return SuggestionResponse(suggestions=items, created_at=created_at)


def _normalize_seed(seed: str | None) -> str | None:
    if seed is None:
        return None
    cleaned = " ".join(seed.strip().split())
    return cleaned or None


def _last_user_question(turns: list[SessionTurn]) -> str | None:
    for turn in reversed(turns):
        if turn.role == "user":
            return _normalize_seed(turn.content)
    return None
