from __future__ import annotations

from typing import Any, TypedDict

from langgraph.graph import END, StateGraph
from pydantic_ai import Agent
from sqlalchemy import select

from cl_logs.logging import get_logger

from crystalith.agents.deps import StudioDeps
from crystalith.agents.models import build_chat_model
from crystalith.agents.output_schemas import (
    BriefingOutput,
    BulletsOutput,
    FAQOutput,
    GuideOutput,
    MindmapOutput,
    ParagraphOutput,
    QuizOutput,
    StructuredOutput,
    TimelineOutput,
)
from crystalith.db import Chunk, Output, Source
from crystalith.outputs import OutputType
from crystalith.schemas.citations import Citation
from crystalith.vector_storage import VectorSearchResult


log = get_logger(__name__)


class OutputState(TypedDict, total=False):
    notebook_id: int
    output_type: OutputType
    prompt: str
    chunk_ids: list[int] | None
    top_k: int
    min_score: float
    deps: StudioDeps
    context: str
    citations: list[Citation]
    resolved_chunk_ids: list[int]
    content: dict[str, Any]
    db_output: Output


DEFAULT_PROMPTS: dict[OutputType, str] = {
    OutputType.FAQ: "Generate a FAQ from the sources.",
    OutputType.GUIDE: "Create a study guide from the sources.",
    OutputType.TIMELINE: "Create a timeline from the sources.",
    OutputType.MINDMAP: "Create a mindmap from the sources.",
    OutputType.QUIZ: "Create a quiz from the sources.",
    OutputType.BRIEFING: "Create an executive briefing from the sources.",
    OutputType.PARAGRAPH: "Summarize the sources as a paragraph.",
    OutputType.BULLETS: "Summarize the sources as bullet points.",
    OutputType.STRUCTURED: "Create a structured summary from the sources.",
}

SYSTEM_PROMPT = (
    "You are a research assistant. Answer strictly using the provided sources. "
    "Cite sources for every point using the source index list provided. "
    "Return structured output that matches the requested schema."
)

OUTPUT_SCHEMAS = {
    OutputType.FAQ: FAQOutput,
    OutputType.GUIDE: GuideOutput,
    OutputType.TIMELINE: TimelineOutput,
    OutputType.MINDMAP: MindmapOutput,
    OutputType.QUIZ: QuizOutput,
    OutputType.BRIEFING: BriefingOutput,
    OutputType.PARAGRAPH: ParagraphOutput,
    OutputType.BULLETS: BulletsOutput,
    OutputType.STRUCTURED: StructuredOutput,
}


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


def _extract_page_number(chunk: Chunk) -> int | None:
    metadata = chunk.metadata_ if isinstance(chunk.metadata_, dict) else None
    page = metadata.get("page") if metadata else None
    return page if isinstance(page, int) else None


def _extract_paragraph_index(chunk: Chunk) -> int | None:
    metadata = chunk.metadata_ if isinstance(chunk.metadata_, dict) else None
    paragraph_index = metadata.get("paragraph_index") if metadata else None
    return paragraph_index if isinstance(paragraph_index, int) else None


def _build_citation(chunk: Chunk, source: Source, score: float) -> Citation:
    snippet = chunk.text.strip()[:200]
    return Citation(
        source_id=source.id,
        source_name=source.filename,
        chunk_id=chunk.id,
        chunk_index=chunk.chunk_index,
        page_number=_extract_page_number(chunk),
        paragraph_index=_extract_paragraph_index(chunk),
        snippet=snippet,
        score=score,
    )


def _resolve_citation_indices(value: Any) -> list[int]:
    if not isinstance(value, list):
        return []
    indices: list[int] = []
    for item in value:
        try:
            index = int(item)
        except (TypeError, ValueError):
            continue
        if index > 0:
            indices.append(index)
    return indices


def _resolve_citations(
    indices: list[int],
    citation_map: dict[int, Citation],
    fallback: list[Citation],
) -> list[dict[str, Any]]:
    resolved: list[Citation] = []
    for index in indices:
        citation = citation_map.get(index)
        if citation is not None:
            resolved.append(citation)
    if not resolved and fallback:
        resolved = fallback[:1]
    return [item.model_dump() for item in resolved]


def _map_citations(
    payload: Any,
    citation_map: dict[int, Citation],
    fallback: list[Citation],
) -> Any:
    if isinstance(payload, dict):
        mapped: dict[str, Any] = {}
        for key, value in payload.items():
            if key == "citations":
                indices = _resolve_citation_indices(value)
                mapped[key] = _resolve_citations(indices, citation_map, fallback)
            else:
                mapped[key] = _map_citations(value, citation_map, fallback)
        return mapped
    if isinstance(payload, list):
        return [_map_citations(item, citation_map, fallback) for item in payload]
    return payload


def _fallback_output(output_type: OutputType, prompt: str) -> dict[str, Any]:
    fallback = prompt or DEFAULT_PROMPTS.get(output_type, "")
    if output_type == OutputType.FAQ:
        return {"items": [{"question": fallback, "answer": "", "citations": [1]}]}
    if output_type == OutputType.GUIDE:
        return {
            "modules": [
                {
                    "title": fallback,
                    "objective": {"text": "", "citations": [1]},
                    "key_points": [{"text": "", "citations": [1]}],
                    "examples": [],
                    "exercises": [],
                }
            ]
        }
    if output_type == OutputType.TIMELINE:
        return {
            "events": [
                {
                    "date": "",
                    "event": fallback,
                    "description": "",
                    "citations": [1],
                }
            ]
        }
    if output_type == OutputType.MINDMAP:
        return {
            "root": {
                "label": fallback,
                "citations": [1],
                "children": [],
            }
        }
    if output_type == OutputType.QUIZ:
        return {
            "questions": [
                {
                    "type": "short_answer",
                    "question": fallback,
                    "options": [],
                    "answer": "",
                    "explanation": "",
                    "citations": [1],
                }
            ]
        }
    if output_type == OutputType.BRIEFING:
        return {
            "sections": [
                {
                    "heading": fallback,
                    "points": [{"text": "", "citations": [1]}],
                }
            ]
        }
    if output_type == OutputType.PARAGRAPH:
        return {"text": fallback, "citations": [1]}
    if output_type == OutputType.BULLETS:
        return {"items": [{"text": fallback, "citations": [1]}]}
    if output_type == OutputType.STRUCTURED:
        return {
            "title": fallback,
            "bullets": [{"text": fallback, "citations": [1]}],
            "terms": [],
        }
    return {}


def _ensure_minimum_content(
    output_type: OutputType,
    content: Any,
    prompt: str,
) -> dict[str, Any]:
    if not isinstance(content, dict):
        return _fallback_output(output_type, prompt)

    if output_type == OutputType.FAQ:
        items = content.get("items")
        if not isinstance(items, list) or not items:
            return _fallback_output(output_type, prompt)
        return content

    if output_type == OutputType.GUIDE:
        modules = content.get("modules")
        if not isinstance(modules, list) or not modules:
            return _fallback_output(output_type, prompt)
        for module in modules:
            if not isinstance(module, dict):
                continue
            if not module.get("objective"):
                module["objective"] = {"text": "", "citations": [1]}
            if not module.get("key_points"):
                module["key_points"] = [{"text": "", "citations": [1]}]
            if not isinstance(module.get("examples"), list):
                module["examples"] = []
            if not isinstance(module.get("exercises"), list):
                module["exercises"] = []
        return content

    if output_type == OutputType.TIMELINE:
        events = content.get("events")
        if not isinstance(events, list) or not events:
            return _fallback_output(output_type, prompt)
        return content

    if output_type == OutputType.MINDMAP:
        root = content.get("root")
        if not isinstance(root, dict):
            return _fallback_output(output_type, prompt)
        if not root.get("citations"):
            root["citations"] = [1]
        children = root.get("children")
        if not isinstance(children, list) or not children:
            label = str(root.get("label") or prompt or "Topic")
            root["children"] = [{"label": label, "citations": [1], "children": []}]
        return content

    if output_type == OutputType.QUIZ:
        questions = content.get("questions")
        if not isinstance(questions, list) or not questions:
            return _fallback_output(output_type, prompt)
        return content

    if output_type == OutputType.BRIEFING:
        sections = content.get("sections")
        if not isinstance(sections, list) or not sections:
            return _fallback_output(output_type, prompt)
        for section in sections:
            if not isinstance(section, dict):
                continue
            if not section.get("points"):
                section["points"] = [{"text": "", "citations": [1]}]
        return content

    if output_type == OutputType.PARAGRAPH:
        citations = content.get("citations")
        if not isinstance(citations, list) or not citations:
            content["citations"] = [1]
        return content

    if output_type == OutputType.BULLETS:
        items = content.get("items")
        if not isinstance(items, list) or not items:
            return _fallback_output(output_type, prompt)
        return content

    if output_type == OutputType.STRUCTURED:
        bullets = content.get("bullets")
        if not isinstance(bullets, list) or not bullets:
            return _fallback_output(output_type, prompt)
        return content

    return content


def _build_output_prompt(output_type: OutputType, prompt: str, context: str) -> str:
    final_prompt = prompt.strip() or DEFAULT_PROMPTS.get(output_type, "")
    return (
        f"Output type: {output_type.value}\n"
        f"Prompt:\n{final_prompt}\n\n"
        f"Sources:\n{context}"
    )


async def _resolve_context(state: OutputState) -> dict[str, Any]:
    deps = state["deps"]
    notebook_id = state["notebook_id"]
    prompt = state["prompt"]
    chunk_ids = state["chunk_ids"] or []

    log.debug(
        "resolving context",
        notebook_id=notebook_id,
        prompt_length=len(prompt),
        explicit_chunk_ids_count=len(chunk_ids),
    )

    explicit_chunk_ids = [int(value) for value in chunk_ids if int(value) > 0]
    if explicit_chunk_ids:
        rows = await deps.session.execute(
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

        citations = [
            _build_citation(chunk_map[chunk_id][0], chunk_map[chunk_id][1], 1.0)
            for chunk_id in explicit_chunk_ids
        ]
        context = _format_context_from_chunk_ids(explicit_chunk_ids, chunk_map)
        return {
            "context": context,
            "citations": citations,
            "resolved_chunk_ids": explicit_chunk_ids,
        }

    seed = prompt or "Summarize the notebook sources."
    embeddings = await deps.embedder.embed([seed])
    if not embeddings:
        return {
            "context": "",
            "citations": [],
            "resolved_chunk_ids": [],
        }

    query_vector = embeddings[0]
    results = await deps.vector_store.search(
        notebook_id=notebook_id,
        query_vector=query_vector,
        top_k=state["top_k"],
        min_score=state["min_score"],
    )
    if not results:
        return {
            "context": "",
            "citations": [],
            "resolved_chunk_ids": [],
        }

    chunk_ids = [result.entry.chunk_id for result in results]
    rows = await deps.session.execute(
        select(Chunk, Source)
        .join(Source, Source.id == Chunk.source_id)
        .where(Chunk.id.in_(chunk_ids))
    )
    chunk_map = {chunk.id: (chunk, source) for chunk, source in rows.all()}

    citations: list[Citation] = []
    for result in results:
        chunk, source = chunk_map[result.entry.chunk_id]
        citations.append(_build_citation(chunk, source, result.score))

    context = _format_context(results, chunk_map)
    return {
        "context": context,
        "citations": citations,
        "resolved_chunk_ids": chunk_ids,
    }


async def _generate_output(state: OutputState) -> dict[str, Any]:
    deps = state["deps"]
    output_type = state["output_type"]
    prompt = state["prompt"]
    context = state.get("context", "")

    schema = OUTPUT_SCHEMAS[output_type]
    model = deps.model or build_chat_model(deps.settings)

    log.info(
        "generating output",
        output_type=output_type.value,
        prompt_length=len(prompt),
        context_length=len(context),
        has_context=bool(context.strip()),
    )

    agent = Agent(
        model,
        output_type=schema,
        deps_type=StudioDeps,
        system_prompt=SYSTEM_PROMPT,
        retries=2,
    )

    user_prompt = _build_output_prompt(output_type, prompt, context)
    try:
        result = await agent.run(user_prompt, deps=deps)
        content = result.output.model_dump()
        log.info(
            "output generation succeeded",
            output_type=output_type.value,
            content_keys=list(content.keys()) if isinstance(content, dict) else None,
        )
    except Exception as error:  # noqa: BLE001 - fallback for output generation
        error_type = type(error).__name__
        error_message = str(error)[:200]  # Truncate long error messages
        log.warning(
            "output generation failed, using fallback",
            exc_info=error,
            output_type=output_type.value,
            error_type=error_type,
            error_message=error_message,
        )
        content = _fallback_output(output_type, prompt)

    return {"content": content}


async def _map_output_citations(state: OutputState) -> dict[str, Any]:
    output_type = state["output_type"]
    prompt = state.get("prompt", "")
    citations = state.get("citations", [])
    citation_map = {index: citation for index, citation in enumerate(citations, start=1)}
    fallback_citations = citations[:1]
    normalized = _ensure_minimum_content(output_type, state.get("content"), prompt)
    mapped = _map_citations(normalized, citation_map, fallback_citations)
    return {"content": mapped}


async def _persist_output(state: OutputState) -> dict[str, Any]:
    deps = state["deps"]
    notebook_id = state["notebook_id"]
    output_type = state["output_type"]
    prompt = state["prompt"]
    resolved_chunk_ids = state.get("resolved_chunk_ids") or None
    content = state.get("content")

    db_output = Output(
        notebook_id=notebook_id,
        type=output_type,
        prompt=prompt or None,
        chunk_ids=resolved_chunk_ids,
        content=content,
    )
    deps.session.add(db_output)
    await deps.session.commit()
    await deps.session.refresh(db_output)

    return {"db_output": db_output}


def _build_graph():
    graph = StateGraph(OutputState)
    graph.add_node("resolve_context", _resolve_context)
    graph.add_node("generate_output", _generate_output)
    graph.add_node("map_citations", _map_output_citations)
    graph.add_node("persist_output", _persist_output)
    graph.set_entry_point("resolve_context")
    graph.add_edge("resolve_context", "generate_output")
    graph.add_edge("generate_output", "map_citations")
    graph.add_edge("map_citations", "persist_output")
    graph.add_edge("persist_output", END)
    return graph.compile()


_OUTPUT_GRAPH = _build_graph()


async def run_output_graph(state: OutputState) -> Output:
    result = await _OUTPUT_GRAPH.ainvoke(state)
    return result["db_output"]
