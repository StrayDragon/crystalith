from __future__ import annotations

import datetime
import json
from collections.abc import Callable
from typing import TypedDict, cast

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.ai.interfaces import ChatProvider, EmbeddingProvider
from crystalith.shared.ai.types import ChatMessage
from crystalith.shared.concurrency import StageLimiters
from crystalith.shared.config import RefineSettings, Settings
from crystalith.shared.db import Chunk, Notebook, Source
from crystalith.shared.utils import format_context, parse_bullets
from crystalith.shared.vector_storage import VectorStore

from .models import Task
from .types import TaskType


class RefineTaskPayload(TypedDict, total=False):
    prompt: str
    format: str
    source_ids: list[int]
    top_k: int
    min_score: float


class RefineCitation(TypedDict):
    source_id: int
    source_name: str
    chunk_id: int
    chunk_index: int
    snippet: str
    score: float


def _fallback_structured(prompt: str, citations: list[RefineCitation]) -> dict[str, object]:
    title = prompt.strip()[:48] or "Refine"
    bullets = [citation["snippet"] for citation in citations[:5]]
    return {"title": title, "bullets": bullets, "terms": [], "citations": citations}


def _normalize_format(settings: RefineSettings, format_name: str) -> str:
    normalized = format_name.strip().lower()
    allowed = {item.lower() for item in settings.formats}
    if normalized not in allowed:
        raise HTTPException(status_code=400, detail="Unsupported refine format")
    return normalized


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
    citations: list[RefineCitation],
) -> dict[str, object]:
    if format_name == "paragraph":
        return {"paragraph": answer.strip()}
    if format_name == "bullets":
        return {"bullets": parse_bullets(answer)}

    try:
        parsed = json.loads(answer)
        structured: dict[str, object] = {
            "title": str(parsed.get("title", "")),
            "bullets": [str(item) for item in parsed.get("bullets", [])],
            "terms": [str(item) for item in parsed.get("terms", [])],
            "citations": citations,
        }
    except (json.JSONDecodeError, TypeError, ValueError):
        structured = _fallback_structured(prompt, citations)

    return {"structured": structured}


FORMAT_PROMPTS = {
    "paragraph": "Summarize the sources into one concise paragraph.",
    "bullets": "Summarize the sources into bullet points (each on a new line).",
    "structured": (
        "Return JSON with keys: title (string), bullets (list of strings), "
        "terms (list of strings). Keep bullets concise."
    ),
}


def _normalize_source_ids(source_ids: list[int] | None) -> list[int]:
    if not source_ids:
        return []
    normalized = [int(value) for value in source_ids]
    if any(value <= 0 for value in normalized):
        raise ValueError("Unknown source_id in source_ids")
    return list(dict.fromkeys(normalized))


async def _validate_source_ids(
    session: AsyncSession,
    notebook_id: int,
    source_ids: list[int],
) -> None:
    if not source_ids:
        return
    rows = await session.execute(
        select(Source.id).where(
            Source.notebook_id == notebook_id,
            Source.id.in_(source_ids),
        )
    )
    found = {row[0] for row in rows.all()}
    missing = [source_id for source_id in source_ids if source_id not in found]
    if missing:
        raise ValueError("Unknown source_id in source_ids")


async def execute_task(
    task: Task,
    session: AsyncSession,
    settings: Settings,
    vector_store: VectorStore,
    embedder_factory: Callable[[Settings], EmbeddingProvider],
    chat_factory: Callable[[Settings], ChatProvider],
    limiters: StageLimiters | None,
) -> dict[str, object]:
    if task.type == TaskType.REFINE:
        return await _execute_refine(
            task,
            session,
            settings,
            vector_store,
            embedder_factory,
            chat_factory,
            limiters=limiters,
        )
    raise ValueError(f"Unsupported task type: {task.type}")


async def _execute_refine(
    task: Task,
    session: AsyncSession,
    settings: Settings,
    vector_store: VectorStore,
    embedder_factory: Callable[[Settings], EmbeddingProvider],
    chat_factory: Callable[[Settings], ChatProvider],
    *,
    limiters: StageLimiters | None,
) -> dict[str, object]:
    payload = cast(RefineTaskPayload, task.payload)
    prompt = str(payload.get("prompt", "")).strip()
    if not prompt:
        raise ValueError("Refine task requires a prompt")

    notebook_id = task.notebook_id
    if notebook_id is None:
        raise ValueError("Refine task requires notebook_id")

    notebook = await session.get(Notebook, notebook_id)
    if notebook is None:
        raise ValueError("Notebook not found")

    format_name = _normalize_format(settings.refine, str(payload.get("format", "paragraph")))
    created_at = datetime.datetime.now(datetime.UTC).isoformat()
    source_ids = _normalize_source_ids(payload.get("source_ids"))
    if source_ids:
        await _validate_source_ids(session, notebook_id, source_ids)

    citations: list[RefineCitation]
    if not source_ids:
        citations = []
        context = ""
        evidence = False
    else:
        embedder = embedder_factory(settings)
        if limiters is None:
            embeddings = await embedder.embed_batch([prompt])
        else:
            async with limiters.embedding.acquire():
                embeddings = await embedder.embed_batch([prompt])
        if not embeddings:
            citations = []
            context = ""
            evidence = False
        else:
            query_vector = embeddings[0]
            if limiters is None:
                results = await vector_store.search(
                    notebook_id=notebook_id,
                    query_vector=query_vector,
                    top_k=int(payload.get("top_k", 5)),
                    min_score=float(payload.get("min_score", 0.2)),
                    source_ids=source_ids,
                )
            else:
                async with limiters.vector_search.acquire():
                    results = await vector_store.search(
                        notebook_id=notebook_id,
                        query_vector=query_vector,
                        top_k=int(payload.get("top_k", 5)),
                        min_score=float(payload.get("min_score", 0.2)),
                        source_ids=source_ids,
                    )
            if not results:
                citations = []
                context = ""
                evidence = False
            else:
                chunk_ids = [result.entry.chunk_id for result in results]
                rows = await session.execute(
                    select(Chunk, Source)
                    .join(Source, Source.id == Chunk.source_id)
                    .where(Chunk.id.in_(chunk_ids))
                )
                chunk_map = {chunk.id: (chunk, source) for chunk, source in rows.all()}

                citations = []
                for result in results:
                    chunk, source = chunk_map[result.entry.chunk_id]
                    snippet = chunk.text.strip()[:200]
                    citations.append(
                        {
                            "source_id": source.id,
                            "source_name": source.filename,
                            "chunk_id": chunk.id,
                            "chunk_index": chunk.chunk_index,
                            "snippet": snippet,
                            "score": result.score,
                        }
                    )

                context = format_context(results, chunk_map)
                evidence = True

    chat_provider = chat_factory(settings)
    messages = _build_messages(format_name, prompt, context)
    if limiters is None:
        answer = await chat_provider.chat(messages)
    else:
        async with limiters.llm_generate.acquire():
            answer = await chat_provider.chat(messages)
    formatted = _apply_format(format_name, answer, prompt, citations)
    response = {
        "format": format_name,
        "citations": citations,
        "evidence": evidence,
        "created_at": created_at,
    }
    response.update(formatted)
    return response
