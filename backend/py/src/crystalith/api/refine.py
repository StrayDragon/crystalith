from __future__ import annotations

import datetime
import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.ai.interfaces import ChatProvider, EmbeddingProvider
from crystalith.ai.types import ChatMessage
from crystalith.config import RefineSettings, Settings
from crystalith.db import Chunk, Notebook, Source
from crystalith.schemas.citations import Citation
from crystalith.tasks import TaskQueue, TaskStatus, TaskType
from crystalith.utils import (
    extract_page_number,
    extract_paragraph_index,
    format_context,
    format_context_from_chunk_ids,
    parse_bullets,
)
from crystalith.vector_storage import VectorSearchResult, VectorStore

from .deps import (
    get_chat_provider,
    get_db_session,
    get_embedding_provider,
    get_settings,
    get_task_queue,
    get_vector_store,
)


router = APIRouter(prefix="/v1/notebooks/{notebook_id}/refine", tags=["refine"])


class RefineRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    format: str = Field("paragraph")
    chunk_ids: list[int] | None = None
    top_k: int = Field(5, ge=1, le=20)
    min_score: float = Field(0.2, ge=0.0, le=1.0)


class RefineBatchRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    formats: list[str] | None = None
    chunk_ids: list[int] | None = None
    top_k: int = Field(5, ge=1, le=20)
    min_score: float = Field(0.2, ge=0.0, le=1.0)


class StructuredRefine(BaseModel):
    title: str
    bullets: list[str]
    terms: list[str]
    citations: list[Citation]


class RefineBatchOutput(BaseModel):
    paragraph: str | None = None
    bullets: list[str] | None = None
    structured: StructuredRefine | None = None


class RefineResponse(BaseModel):
    format: str
    paragraph: str | None = None
    bullets: list[str] | None = None
    structured: StructuredRefine | None = None
    citations: list[Citation]
    evidence: bool
    created_at: datetime.datetime


class RefineBatchResponse(BaseModel):
    outputs: dict[str, RefineBatchOutput]
    citations: list[Citation]
    evidence: bool
    created_at: datetime.datetime


FORMAT_PROMPTS = {
    "paragraph": "Summarize the sources into one concise paragraph.",
    "bullets": "Summarize the sources into bullet points (each on a new line).",
    "structured": (
        "Return JSON with keys: title (string), bullets (list of strings), "
        "terms (list of strings). Keep bullets concise."
    ),
}


def _fallback_structured(
    prompt: str,
    citations: list[Citation],
) -> StructuredRefine:
    title = prompt.strip()[:48] or "Refine"
    bullets = [citation.snippet for citation in citations[:5]]
    terms: list[str] = []
    return StructuredRefine(title=title, bullets=bullets, terms=terms, citations=citations)


def _normalize_format(settings: RefineSettings, format_name: str) -> str:
    normalized = format_name.strip().lower()
    allowed = {item.lower() for item in settings.formats}
    if normalized not in allowed:
        raise HTTPException(status_code=400, detail="Unsupported refine format")
    return normalized


def _resolve_formats(settings: RefineSettings, formats: list[str] | None) -> list[str]:
    if not formats:
        return [item.strip().lower() for item in settings.formats]
    resolved: list[str] = []
    for item in formats:
        resolved.append(_normalize_format(settings, item))
    return resolved


def _build_messages(format_name: str, prompt: str, context: str) -> list[ChatMessage]:
    format_prompt = FORMAT_PROMPTS.get(format_name, FORMAT_PROMPTS["paragraph"])
    return [
        ChatMessage(
            role="system",
            content=(
                "You are a research assistant. Answer strictly using the provided sources. "
                f"{format_prompt}"
            ),
        ),
        ChatMessage(role="user", content=f"Prompt:\n{prompt}\n\nSources:\n{context}"),
    ]


def _apply_format(
    format_name: str,
    answer: str,
    prompt: str,
    citations: list[Citation],
) -> RefineBatchOutput:
    if format_name == "paragraph":
        return RefineBatchOutput(paragraph=answer.strip())
    if format_name == "bullets":
        return RefineBatchOutput(bullets=parse_bullets(answer))

    try:
        parsed = json.loads(answer)
        structured = StructuredRefine(
            title=str(parsed.get("title", "")),
            bullets=[str(item) for item in parsed.get("bullets", [])],
            terms=[str(item) for item in parsed.get("terms", [])],
            citations=citations,
        )
    except (json.JSONDecodeError, TypeError, ValueError):
        structured = _fallback_structured(prompt, citations)

    return RefineBatchOutput(structured=structured)


@router.post("", response_model=RefineResponse)
async def refine(
    notebook_id: int,
    payload: RefineRequest,
    session: AsyncSession = Depends(get_db_session),
    task_queue: TaskQueue = Depends(get_task_queue),
    settings: Settings = Depends(get_settings),
) -> RefineResponse:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")

    format_name = _normalize_format(settings.refine, payload.format)
    explicit_chunk_ids = [int(value) for value in (payload.chunk_ids or []) if int(value) > 0]
    if explicit_chunk_ids:
        rows = await session.execute(
            select(Chunk, Source)
            .join(Source, Source.id == Chunk.source_id)
            .where(Chunk.id.in_(explicit_chunk_ids), Source.notebook_id == notebook_id)
        )
        chunk_map: dict[int, tuple[Chunk, Source]] = {
            chunk.id: (chunk, source) for chunk, source in rows.all()
        }
        missing = [chunk_id for chunk_id in explicit_chunk_ids if chunk_id not in chunk_map]
        if missing:
            raise HTTPException(status_code=400, detail="Unknown chunk_id in chunk_ids")
    task_payload = {
        "prompt": payload.prompt,
        "format": format_name,
        "chunk_ids": payload.chunk_ids,
        "top_k": payload.top_k,
        "min_score": payload.min_score,
    }
    task_id = await task_queue.enqueue(TaskType.REFINE, task_payload, notebook_id=notebook_id)
    await task_queue.wait_for_completion(task_id)
    task = await task_queue.get_status(task_id)
    if task.status == TaskStatus.COMPLETED and task.result is not None:
        return RefineResponse.model_validate(task.result)
    if task.status == TaskStatus.CANCELLED:
        raise HTTPException(status_code=409, detail="Task cancelled")
    raise HTTPException(status_code=500, detail=task.error or "Task failed")


@router.post("/batch", response_model=RefineBatchResponse)
async def refine_batch(
    notebook_id: int,
    payload: RefineBatchRequest,
    session: AsyncSession = Depends(get_db_session),
    embedder: EmbeddingProvider = Depends(get_embedding_provider),
    chatter: ChatProvider = Depends(get_chat_provider),
    vector_store: VectorStore = Depends(get_vector_store),
    settings: Settings = Depends(get_settings),
) -> RefineBatchResponse:
    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")

    formats = _resolve_formats(settings.refine, payload.formats)
    created_at = datetime.datetime.now(datetime.UTC)

    explicit_chunk_ids = [int(value) for value in (payload.chunk_ids or []) if int(value) > 0]
    if explicit_chunk_ids:
        rows = await session.execute(
            select(Chunk, Source)
            .join(Source, Source.id == Chunk.source_id)
            .where(Chunk.id.in_(explicit_chunk_ids), Source.notebook_id == notebook_id)
        )
        chunk_map: dict[int, tuple[Chunk, Source]] = {
            chunk.id: (chunk, source) for chunk, source in rows.all()
        }
        missing = [chunk_id for chunk_id in explicit_chunk_ids if chunk_id not in chunk_map]
        if missing:
            raise HTTPException(status_code=400, detail="Unknown chunk_id in chunk_ids")

        citations: list[Citation] = []
        for chunk_id in explicit_chunk_ids:
            chunk, source = chunk_map[chunk_id]
            snippet = chunk.text.strip()[:200]
            citations.append(
                Citation(
                    source_id=source.id,
                    source_name=source.filename,
                    chunk_id=chunk.id,
                    chunk_index=chunk.chunk_index,
                    page_number=extract_page_number(chunk),
                    paragraph_index=extract_paragraph_index(chunk),
                    snippet=snippet,
                    score=1.0,
                )
            )

        context = format_context_from_chunk_ids(explicit_chunk_ids, chunk_map)
    else:
        embeddings = await embedder.embed([payload.prompt])
        if not embeddings:
            return RefineBatchResponse(
                outputs={},
                citations=[],
                evidence=False,
                created_at=created_at,
            )
        query_vector = embeddings[0]
        results = await vector_store.search(
            notebook_id=notebook_id,
            query_vector=query_vector,
            top_k=payload.top_k,
            min_score=payload.min_score,
        )
        if not results:
            return RefineBatchResponse(
                outputs={},
                citations=[],
                evidence=False,
                created_at=created_at,
            )

        chunk_ids = [result.entry.chunk_id for result in results]
        rows = await session.execute(
            select(Chunk, Source)
            .join(Source, Source.id == Chunk.source_id)
            .where(Chunk.id.in_(chunk_ids))
        )
        chunk_map = {chunk.id: (chunk, source) for chunk, source in rows.all()}

        citations: list[Citation] = []
        for result in results:
            chunk, source = chunk_map[result.entry.chunk_id]
            snippet = chunk.text.strip()[:200]
            citations.append(
                Citation(
                    source_id=source.id,
                    source_name=source.filename,
                    chunk_id=chunk.id,
                    chunk_index=chunk.chunk_index,
                    page_number=extract_page_number(chunk),
                    paragraph_index=extract_paragraph_index(chunk),
                    snippet=snippet,
                    score=result.score,
                )
            )

        context = format_context(results, chunk_map)

    outputs: dict[str, RefineBatchOutput] = {}
    for format_name in formats:
        messages = _build_messages(format_name, payload.prompt, context)
        answer = await chatter.chat(messages)
        outputs[format_name] = _apply_format(format_name, answer, payload.prompt, citations)

    return RefineBatchResponse(
        outputs=outputs,
        citations=citations,
        evidence=True,
        created_at=created_at,
    )
