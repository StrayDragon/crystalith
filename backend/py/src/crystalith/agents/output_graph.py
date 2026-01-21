from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from pydantic_ai import Agent
from pydantic_graph import BaseNode, End, Graph, GraphRunContext
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
from crystalith.utils import (
    extract_page_number,
    extract_paragraph_index,
    format_context,
    format_context_from_chunk_ids,
)
from crystalith.vector_storage import VectorSearchResult


log = get_logger(__name__)


@dataclass
class OutputGraphState:
    """State object passed through the output generation graph."""

    notebook_id: int
    output_type: OutputType
    prompt: str
    chunk_ids: list[int] | None = None
    top_k: int = 10
    min_score: float = 0.0
    context: str = ""
    citations: list[Citation] = field(default_factory=list)
    resolved_chunk_ids: list[int] = field(default_factory=list)
    content: dict[str, Any] = field(default_factory=dict)
    db_output: Output | None = None


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


def _build_citation(chunk: Chunk, source: Source, score: float) -> Citation:
    snippet = chunk.text.strip()[:200]
    return Citation(
        source_id=source.id,
        source_name=source.filename,
        chunk_id=chunk.id,
        chunk_index=chunk.chunk_index,
        page_number=extract_page_number(chunk),
        paragraph_index=extract_paragraph_index(chunk),
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
    """Generate fallback content when AI model fails to produce valid output.

    This provides a meaningful placeholder that indicates the generation failed,
    rather than showing empty or confusing content to the user.
    """
    title = prompt or DEFAULT_PROMPTS.get(output_type, "")
    error_note = "⚠️ AI 模型生成失败，请稍后重试或使用更强大的模型。"

    if output_type == OutputType.FAQ:
        return {
            "items": [
                {
                    "question": title,
                    "answer": error_note,
                    "citations": [],
                }
            ],
            "_fallback": True,
        }
    if output_type == OutputType.GUIDE:
        return {
            "modules": [
                {
                    "title": title,
                    "objective": {"text": error_note, "citations": []},
                    "key_points": [],
                    "examples": [],
                    "exercises": [],
                }
            ],
            "_fallback": True,
        }
    if output_type == OutputType.TIMELINE:
        return {
            "events": [
                {
                    "date": "—",
                    "event": title,
                    "description": error_note,
                    "citations": [],
                }
            ],
            "_fallback": True,
        }
    if output_type == OutputType.MINDMAP:
        return {
            "root": {
                "label": title or error_note,
                "citations": [],
                "children": [],
            },
            "_fallback": True,
        }
    if output_type == OutputType.QUIZ:
        return {
            "questions": [
                {
                    "type": "short_answer",
                    "question": title,
                    "options": [],
                    "answer": error_note,
                    "explanation": "",
                    "citations": [],
                }
            ],
            "_fallback": True,
        }
    if output_type == OutputType.BRIEFING:
        return {
            "sections": [
                {
                    "heading": title or "生成失败",
                    "points": [{"text": error_note, "citations": []}],
                }
            ],
            "_fallback": True,
        }
    if output_type == OutputType.PARAGRAPH:
        return {"text": error_note, "citations": [], "_fallback": True}
    if output_type == OutputType.BULLETS:
        return {"items": [{"text": error_note, "citations": []}], "_fallback": True}
    if output_type == OutputType.STRUCTURED:
        return {
            "title": title or "生成失败",
            "bullets": [{"text": error_note, "citations": []}],
            "terms": [],
            "_fallback": True,
        }
    return {"_fallback": True}


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


# =============================================================================
# Graph Nodes
# =============================================================================


@dataclass
class ResolveContext(BaseNode[OutputGraphState, StudioDeps, Output]):
    """Resolve context from vector store or explicit chunk IDs."""

    async def run(
        self, ctx: GraphRunContext[OutputGraphState, StudioDeps]
    ) -> "GenerateOutput":
        state = ctx.state
        deps = ctx.deps

        log.debug(
            "resolving context",
            notebook_id=state.notebook_id,
            prompt_length=len(state.prompt),
            explicit_chunk_ids_count=len(state.chunk_ids or []),
        )

        explicit_chunk_ids = [int(v) for v in (state.chunk_ids or []) if int(v) > 0]
        if explicit_chunk_ids:
            rows = await deps.session.execute(
                select(Chunk, Source)
                .join(Source, Source.id == Chunk.source_id)
                .where(Chunk.id.in_(explicit_chunk_ids), Source.notebook_id == state.notebook_id)
            )
            chunk_map: dict[int, tuple[Chunk, Source]] = {
                chunk.id: (chunk, source) for chunk, source in rows.all()
            }
            missing = [cid for cid in explicit_chunk_ids if cid not in chunk_map]
            if missing:
                raise ValueError("Unknown chunk_id in chunk_ids")

            state.citations = [
                _build_citation(chunk_map[cid][0], chunk_map[cid][1], 1.0)
                for cid in explicit_chunk_ids
            ]
            state.context = format_context_from_chunk_ids(explicit_chunk_ids, chunk_map)
            state.resolved_chunk_ids = explicit_chunk_ids
            return GenerateOutput()

        seed = state.prompt or "Summarize the notebook sources."
        embeddings = await deps.embedder.embed([seed])
        if not embeddings:
            state.context = ""
            state.citations = []
            state.resolved_chunk_ids = []
            return GenerateOutput()

        query_vector = embeddings[0]
        results = await deps.vector_store.search(
            notebook_id=state.notebook_id,
            query_vector=query_vector,
            top_k=state.top_k,
            min_score=state.min_score,
        )
        if not results:
            state.context = ""
            state.citations = []
            state.resolved_chunk_ids = []
            return GenerateOutput()

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

        state.context = format_context(results, chunk_map)
        state.citations = citations
        state.resolved_chunk_ids = chunk_ids
        return GenerateOutput()


@dataclass
class GenerateOutput(BaseNode[OutputGraphState, StudioDeps, Output]):
    """Generate structured output using Pydantic AI Agent."""

    async def run(
        self, ctx: GraphRunContext[OutputGraphState, StudioDeps]
    ) -> "MapCitations":
        state = ctx.state
        deps = ctx.deps

        schema = OUTPUT_SCHEMAS[state.output_type]
        model = deps.model or build_chat_model(deps.settings)

        log.info(
            "generating output",
            output_type=state.output_type.value,
            prompt_length=len(state.prompt),
            context_length=len(state.context),
            has_context=bool(state.context.strip()),
        )

        agent = Agent(
            model,
            output_type=schema,
            deps_type=StudioDeps,
            system_prompt=SYSTEM_PROMPT,
            retries=2,
        )

        user_prompt = _build_output_prompt(state.output_type, state.prompt, state.context)
        try:
            result = await agent.run(user_prompt, deps=deps)
            state.content = result.output.model_dump()
            log.info(
                "output generation succeeded",
                output_type=state.output_type.value,
                content_keys=list(state.content.keys()) if isinstance(state.content, dict) else None,
            )
        except Exception as error:  # noqa: BLE001 - fallback for output generation
            error_type = type(error).__name__
            error_message = str(error)[:200]
            log.warning(
                "output generation failed, using fallback",
                exc_info=error,
                output_type=state.output_type.value,
                error_type=error_type,
                error_message=error_message,
            )
            state.content = _fallback_output(state.output_type, state.prompt)

        return MapCitations()


@dataclass
class MapCitations(BaseNode[OutputGraphState, StudioDeps, Output]):
    """Map citation indices to full citation objects."""

    async def run(
        self, ctx: GraphRunContext[OutputGraphState, StudioDeps]
    ) -> "PersistOutput":
        state = ctx.state

        log.debug(
            "mapping citations",
            output_type=state.output_type.value,
            citations_count=len(state.citations),
        )

        citation_map = {index: cit for index, cit in enumerate(state.citations, start=1)}
        fallback_citations = state.citations[:1]
        normalized = _ensure_minimum_content(state.output_type, state.content, state.prompt)
        state.content = _map_citations(normalized, citation_map, fallback_citations)
        return PersistOutput()


@dataclass
class PersistOutput(BaseNode[OutputGraphState, StudioDeps, Output]):
    """Persist the generated output to the database."""

    async def run(
        self, ctx: GraphRunContext[OutputGraphState, StudioDeps]
    ) -> End[Output]:
        state = ctx.state
        deps = ctx.deps

        db_output = Output(
            notebook_id=state.notebook_id,
            type=state.output_type,
            prompt=state.prompt or None,
            chunk_ids=state.resolved_chunk_ids or None,
            content=state.content,
        )
        deps.session.add(db_output)
        await deps.session.commit()
        await deps.session.refresh(db_output)

        state.db_output = db_output
        return End(db_output)


# =============================================================================
# Graph Definition
# =============================================================================

OUTPUT_GRAPH: Graph[OutputGraphState, StudioDeps, Output] = Graph(
    nodes=[ResolveContext, GenerateOutput, MapCitations, PersistOutput]
)


async def run_output_graph(
    notebook_id: int,
    output_type: OutputType,
    prompt: str,
    deps: StudioDeps,
    *,
    chunk_ids: list[int] | None = None,
    top_k: int = 10,
    min_score: float = 0.0,
) -> Output:
    """Run the output generation graph and return the persisted Output."""
    state = OutputGraphState(
        notebook_id=notebook_id,
        output_type=output_type,
        prompt=prompt,
        chunk_ids=chunk_ids,
        top_k=top_k,
        min_score=min_score,
    )
    result = await OUTPUT_GRAPH.run(ResolveContext(), state=state, deps=deps)
    return result.output
