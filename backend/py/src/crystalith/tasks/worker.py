from __future__ import annotations

import datetime
import json
from collections.abc import Callable
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.ai.interfaces import ChatProvider, EmbeddingProvider
from crystalith.ai.types import ChatMessage
from crystalith.config import RefineSettings, Settings
from crystalith.db import Chunk, Notebook, Source
from crystalith.vector_storage import VectorSearchResult, VectorStore

from .models import Task
from .types import TaskType


def _format_context(results: list[VectorSearchResult], chunk_map: dict[int, tuple[Chunk, Source]]) -> str:
    blocks: list[str] = []
    for index, result in enumerate(results, start=1):
        chunk, source = chunk_map[result.entry.chunk_id]
        blocks.append(
            f"[{index}] Source: {source.filename} (chunk {chunk.chunk_index})\n{chunk.text}"
        )
    return "\n\n".join(blocks)


def _format_context_from_chunk_ids(
    chunk_ids: list[int],
    chunk_map: dict[int, tuple[Chunk, Source]],
) -> str:
    blocks: list[str] = []
    for index, chunk_id in enumerate(chunk_ids, start=1):
        chunk, source = chunk_map[chunk_id]
        blocks.append(
            f"[{index}] Source: {source.filename} (chunk {chunk.chunk_index})\n{chunk.text}"
        )
    return "\n\n".join(blocks)


def _parse_bullets(text: str) -> list[str]:
    items: list[str] = []
    for raw in text.splitlines():
        cleaned = raw.strip().lstrip("-").strip()
        if cleaned:
            items.append(cleaned)
    return items


def _fallback_structured(prompt: str, citations: list[dict[str, Any]]) -> dict[str, Any]:
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
    citations: list[dict[str, Any]],
) -> dict[str, Any]:
    if format_name == "paragraph":
        return {"paragraph": answer.strip()}
    if format_name == "bullets":
        return {"bullets": _parse_bullets(answer)}

    try:
        parsed = json.loads(answer)
        structured = {
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


async def execute_task(
    task: Task,
    session: AsyncSession,
    settings: Settings,
    vector_store: VectorStore,
    embedder_factory: Callable[[Settings], EmbeddingProvider],
    chat_factory: Callable[[Settings], ChatProvider],
) -> dict[str, Any]:
    if task.type == TaskType.REFINE:
        return await _execute_refine(task, session, settings, vector_store, embedder_factory, chat_factory)
    raise ValueError(f"Unsupported task type: {task.type}")


async def _execute_refine(
    task: Task,
    session: AsyncSession,
    settings: Settings,
    vector_store: VectorStore,
    embedder_factory: Callable[[Settings], EmbeddingProvider],
    chat_factory: Callable[[Settings], ChatProvider],
) -> dict[str, Any]:
    payload = task.payload
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
    explicit_chunk_ids = [int(value) for value in (payload.get("chunk_ids") or []) if int(value) > 0]

    citations: list[dict[str, Any]]
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
            raise ValueError("Unknown chunk_id in chunk_ids")

        citations = []
        for chunk_id in explicit_chunk_ids:
            chunk, source = chunk_map[chunk_id]
            snippet = chunk.text.strip()[:200]
            citations.append(
                {
                    "source_id": source.id,
                    "source_name": source.filename,
                    "chunk_id": chunk.id,
                    "chunk_index": chunk.chunk_index,
                    "snippet": snippet,
                    "score": 1.0,
                }
            )

        context = _format_context_from_chunk_ids(explicit_chunk_ids, chunk_map)
    else:
        embedder = embedder_factory(settings)
        embeddings = await embedder.embed([prompt])
        if not embeddings:
            return {
                "format": format_name,
                "citations": [],
                "evidence": False,
                "created_at": created_at,
            }
        query_vector = embeddings[0]
        results = await vector_store.search(
            notebook_id=notebook_id,
            query_vector=query_vector,
            top_k=int(payload.get("top_k", 5)),
            min_score=float(payload.get("min_score", 0.2)),
        )
        if not results:
            return {
                "format": format_name,
                "citations": [],
                "evidence": False,
                "created_at": created_at,
            }

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

        context = _format_context(results, chunk_map)

    chat_provider = chat_factory(settings)
    messages = _build_messages(format_name, prompt, context)
    answer = await chat_provider.chat(messages)
    formatted = _apply_format(format_name, answer, prompt, citations)
    response = {
        "format": format_name,
        "citations": citations,
        "evidence": True,
        "created_at": created_at,
    }
    response.update(formatted)
    return response
