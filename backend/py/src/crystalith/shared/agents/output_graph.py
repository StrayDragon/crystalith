from __future__ import annotations

import asyncio
import json
import os
from dataclasses import dataclass, field
from time import perf_counter
from typing import cast

from pydantic_ai import Agent
from pydantic_graph import BaseNode, End, Graph, GraphRunContext
from sqlalchemy import select

from cl_logs.logging import get_logger

from crystalith.shared.agents.deps import StudioDeps
from crystalith.shared.agents.generation_preference import GenerationPreference, tuning_for_request
from crystalith.shared.agents.models import (
    build_chat_model,
    build_chat_model_from_model_id,
    extract_effective_model_settings_for_log,
)
from crystalith.shared.observability import classify_error_kind
from crystalith.shared.agents.output_postprocess import needs_repair, postprocess_output
from crystalith.shared.agents.output_schemas import (
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
from crystalith.shared.db import Chunk, Output, Source
from crystalith.shared.types import OutputType
from crystalith.shared.retrieval import retrieve_context
from crystalith.shared.schemas.citations import Citation
from crystalith.shared.utils import extract_page_number, extract_paragraph_index


log = get_logger(__name__)


OUTPUT_REPAIR_ENV = "CRYSTALITH_OUTPUT_REPAIR"


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() not in {"0", "false", "no", "off"}


def _strip_internal_keys(payload: object) -> object:
    if not isinstance(payload, dict):
        return payload
    return {key: value for key, value in payload.items() if not str(key).startswith("_")}


def _build_repair_prompt(
    *,
    output_type: OutputType,
    prompt: str,
    context: str,
    draft: object,
    citations_count: int,
) -> str:
    serialized = json.dumps(_strip_internal_keys(draft), ensure_ascii=False, indent=2, default=str)
    return (
        "Repair the draft structured output so it is complete, non-empty, and useful.\n"
        "Return JSON that matches the requested schema exactly.\n"
        f"Allowed citation indices: 1..{citations_count} (integers only).\n\n"
        f"Output type: {output_type.value}\n"
        f"Prompt:\n{prompt}\n\n"
        "Sources:\n"
        f"{context}\n\n"
        "Draft JSON:\n"
        f"{serialized}"
    )


@dataclass
class OutputGraphState:
    """State object passed through the output generation graph."""

    notebook_id: int
    output_type: OutputType
    prompt: str
    trace_id: str | None = None
    request_id: str | None = None
    preference: GenerationPreference | None = None
    effective_prompt: str = ""
    plugin_schema_used: bool = False
    source_ids: list[int] | None = None
    top_k: int = 10
    min_score: float = 0.0
    context: str = ""
    citations: list[Citation] = field(default_factory=list)
    resolved_chunk_ids: list[int] = field(default_factory=list)
    content: dict[str, object] = field(default_factory=dict)
    db_output: Output | None = None
    model_id: str | None = None  # Optional model ID for dynamic model selection


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
        chunk_index=chunk.chunk_index + 1,
        page_number=extract_page_number(chunk),
        paragraph_index=extract_paragraph_index(chunk),
        snippet=snippet,
        score=score,
    )


def _resolve_citation_indices(value: object) -> list[int]:
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
) -> list[dict[str, object]]:
    resolved: list[Citation] = []
    for index in indices:
        citation = citation_map.get(index)
        if citation is not None:
            resolved.append(citation)
    if not resolved and fallback:
        resolved = fallback[:1]
    return [cast(dict[str, object], item.model_dump()) for item in resolved]


def _normalize_source_ids(source_ids: list[int] | None) -> list[int]:
    if not source_ids:
        return []
    normalized = [int(value) for value in source_ids]
    if any(value <= 0 for value in normalized):
        raise ValueError("Unknown source_id in source_ids")
    return list(dict.fromkeys(normalized))


async def _validate_source_ids(
    session,
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


def _map_citations(
    payload: object,
    citation_map: dict[int, Citation],
    fallback: list[Citation],
) -> object:
    if isinstance(payload, dict):
        mapped: dict[str, object] = {}
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


def _fallback_output(output_type: OutputType, prompt: str) -> dict[str, object]:
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
    content: object,
    prompt: str,
) -> dict[str, object]:
    if not isinstance(content, dict):
        return _fallback_output(output_type, prompt)
    content = cast(dict[str, object], content)

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
        started = perf_counter()

        log.debug(
            "resolving context",
            trace_id=state.trace_id,
            request_id=state.request_id,
            notebook_id=state.notebook_id,
            output_type=state.output_type.value,
            prompt_length=len(state.prompt),
            source_ids_count=len(state.source_ids or []),
            preference=state.preference,
        )

        normalized_source_ids = _normalize_source_ids(state.source_ids)
        if not normalized_source_ids:
            raise ValueError("source_ids must not be empty")

        retrieved = await retrieve_context(
            deps,
            notebook_id=state.notebook_id,
            seed=state.prompt or "Summarize the notebook sources.",
            source_ids=normalized_source_ids,
            output_type=state.output_type,
            preference=state.preference,
            model_id=state.model_id,
            top_k=state.top_k,
            min_score=state.min_score,
            trace_id=state.trace_id,
            request_id=state.request_id,
        )

        state.context = retrieved.context_text
        state.resolved_chunk_ids = retrieved.resolved_chunk_ids
        state.citations = [
            _build_citation(item.chunk, item.source, item.score) for item in retrieved.chunks
        ]

        total_ms = int((perf_counter() - started) * 1000)
        log.info(
            "context resolved",
            trace_id=state.trace_id,
            request_id=state.request_id,
            notebook_id=state.notebook_id,
            output_type=state.output_type.value,
            preference=state.preference,
            top_k=state.top_k,
            min_score=state.min_score,
            results=retrieved.stats.results,
            unique_sources=retrieved.stats.unique_sources,
            avg_score=retrieved.stats.avg_score,
            truncated=retrieved.stats.truncated,
            max_chunks_per_source=retrieved.stats.max_chunks_per_source,
            budget_tokens=retrieved.stats.budget_tokens,
            used_tokens=retrieved.stats.used_tokens,
            query_count=retrieved.stats.query_count,
            multi_query_enabled=retrieved.stats.multi_query_enabled,
            seed_cap=retrieved.stats.seed_cap,
            fusion_strategy=retrieved.stats.fusion_strategy,
            cache_hit=retrieved.stats.cache_hit,
            embed_ms=retrieved.timings_ms.get("embed_ms"),
            embed_wait_ms=retrieved.timings_ms.get("embed_wait_ms"),
            embed_limit=retrieved.timings_ms.get("embed_limit"),
            embed_hit=retrieved.timings_ms.get("embed_hit"),
            search_ms=retrieved.timings_ms.get("search_ms"),
            search_wait_ms=retrieved.timings_ms.get("search_wait_ms"),
            search_limit=retrieved.timings_ms.get("search_limit"),
            search_hit=retrieved.timings_ms.get("search_hit"),
            db_ms=retrieved.timings_ms.get("db_ms"),
            format_ms=retrieved.timings_ms.get("format_ms"),
            total_ms=total_ms,
            duration_ms=total_ms,
        )
        return GenerateOutput()


@dataclass
class GenerateOutput(BaseNode[OutputGraphState, StudioDeps, Output]):
    """Generate structured output using Pydantic AI Agent."""

    async def run(
        self, ctx: GraphRunContext[OutputGraphState, StudioDeps]
    ) -> "PostprocessOutput":
        state = ctx.state
        deps = ctx.deps

        schema = OUTPUT_SCHEMAS[state.output_type]
        default_prompt = DEFAULT_PROMPTS.get(state.output_type, "")

        plugins = deps.plugins
        if plugins is not None:
            plugin = plugins.output_types.get(state.output_type.value)
            if plugin is not None:
                state.plugin_schema_used = True
                schema = plugin.schema
                if plugin.default_prompt:
                    default_prompt = plugin.default_prompt

        # Build model: prefer state.model_id, then deps.model, then default from settings
        if state.model_id:
            model = build_chat_model_from_model_id(deps.settings, state.model_id)
        else:
            model = deps.model or build_chat_model(deps.settings)

        model_settings_log = extract_effective_model_settings_for_log(model)
        log.info(
            "generating output",
            trace_id=state.trace_id,
            request_id=state.request_id,
            output_type=state.output_type.value,
            prompt_length=len(state.prompt),
            context_length=len(state.context),
            has_context=bool(state.context.strip()),
            model_id=state.model_id,
            preference=state.preference,
            **model_settings_log,
        )

        tuning = tuning_for_request(state.output_type, state.preference)
        agent = Agent(
            model,
            output_type=schema,
            deps_type=StudioDeps,
            system_prompt=SYSTEM_PROMPT,
            retries=tuning.agent_retries,
        )

        effective_prompt = state.prompt.strip() or default_prompt
        state.effective_prompt = effective_prompt
        user_prompt = _build_output_prompt(state.output_type, effective_prompt, state.context)
        generation_started = perf_counter()
        limiters = deps.limiters
        llm_limit = int(limiters.llm_generate.limit) if limiters is not None else 0
        llm_wait_ms = 0
        llm_hit = 0
        try:
            if limiters is None:
                result = await agent.run(user_prompt, deps=deps)
            else:
                async with limiters.llm_generate.acquire() as lease:
                    llm_wait_ms = int(lease.wait_ms)
                    llm_hit = int(lease.hit)
                    result = await agent.run(user_prompt, deps=deps)
            state.content = cast(dict[str, object], result.output.model_dump())
            generate_ms = int((perf_counter() - generation_started) * 1000)
            log.info(
                "output generation succeeded",
                trace_id=state.trace_id,
                request_id=state.request_id,
                output_type=state.output_type.value,
                content_keys=list(state.content.keys()),
                model_id=state.model_id,
                preference=state.preference,
                agent_retries=tuning.agent_retries,
                fallback=False,
                llm_limit=llm_limit,
                llm_wait_ms=llm_wait_ms,
                llm_hit=llm_hit,
                generate_ms=generate_ms,
                duration_ms=generate_ms,
                **model_settings_log,
            )
        except asyncio.CancelledError:
            raise
        except Exception as error:  # noqa: BLE001 - fallback for output generation
            generate_ms = int((perf_counter() - generation_started) * 1000)
            log.warning(
                "output generation failed, using fallback",
                trace_id=state.trace_id,
                request_id=state.request_id,
                output_type=state.output_type.value,
                error=type(error).__name__,
                error_kind=classify_error_kind(error),
                model_id=state.model_id,
                preference=state.preference,
                agent_retries=tuning.agent_retries,
                fallback=True,
                llm_limit=llm_limit,
                llm_wait_ms=llm_wait_ms,
                llm_hit=llm_hit,
                generate_ms=generate_ms,
                duration_ms=generate_ms,
                **model_settings_log,
            )
            state.content = _fallback_output(state.output_type, effective_prompt)

        return PostprocessOutput()


@dataclass
class PostprocessOutput(BaseNode[OutputGraphState, StudioDeps, Output]):
    """Apply deterministic postprocessing before mapping citations."""

    async def run(
        self, ctx: GraphRunContext[OutputGraphState, StudioDeps]
    ) -> "MapCitations":
        state = ctx.state
        deps = ctx.deps

        content: object = state.content
        repair_attempted = False
        repair_succeeded = False

        if (
            state.preference == "quality"
            and _env_bool(OUTPUT_REPAIR_ENV, default=False)
            and not state.plugin_schema_used
            and bool(state.context.strip())
            and len(state.citations) > 0
            and needs_repair(state.output_type, content)
        ):
            repair_attempted = True
            tuning = tuning_for_request(state.output_type, state.preference)
            repair_retries = max(1, min(2, tuning.agent_retries))

            repair_prompt = _build_repair_prompt(
                output_type=state.output_type,
                prompt=state.effective_prompt or state.prompt,
                context=state.context,
                draft=content,
                citations_count=len(state.citations),
            )

            repair_started = perf_counter()
            limiters = deps.limiters
            llm_limit = int(limiters.llm_generate.limit) if limiters is not None else 0
            llm_wait_ms = 0
            llm_hit = 0
            model_settings_log: dict[str, object] = {}
            try:
                if state.model_id:
                    model = build_chat_model_from_model_id(deps.settings, state.model_id)
                else:
                    model = deps.model or build_chat_model(deps.settings)

                model_settings_log = extract_effective_model_settings_for_log(model)
                agent = Agent(
                    model,
                    output_type=OUTPUT_SCHEMAS[state.output_type],
                    deps_type=StudioDeps,
                    system_prompt=SYSTEM_PROMPT,
                    retries=repair_retries,
                )
                if limiters is None:
                    result = await agent.run(repair_prompt, deps=deps)
                else:
                    async with limiters.llm_generate.acquire() as lease:
                        llm_wait_ms = int(lease.wait_ms)
                        llm_hit = int(lease.hit)
                        result = await agent.run(repair_prompt, deps=deps)
                content = cast(dict[str, object], result.output.model_dump())
                repair_succeeded = True
            except asyncio.CancelledError:
                raise
            except Exception as error:  # noqa: BLE001 - best-effort repair pass
                repair_ms = int((perf_counter() - repair_started) * 1000)
                log.warning(
                    "output repair failed",
                    trace_id=state.trace_id,
                    request_id=state.request_id,
                    output_type=state.output_type.value,
                    preference=state.preference,
                    model_id=state.model_id,
                    agent_retries=repair_retries,
                    llm_limit=llm_limit,
                    llm_wait_ms=llm_wait_ms,
                    llm_hit=llm_hit,
                    error=type(error).__name__,
                    error_kind=classify_error_kind(error),
                    repair_ms=repair_ms,
                    duration_ms=repair_ms,
                    **model_settings_log,
                )
            else:
                repair_ms = int((perf_counter() - repair_started) * 1000)
                log.info(
                    "output repair succeeded",
                    trace_id=state.trace_id,
                    request_id=state.request_id,
                    output_type=state.output_type.value,
                    preference=state.preference,
                    model_id=state.model_id,
                    agent_retries=repair_retries,
                    llm_limit=llm_limit,
                    llm_wait_ms=llm_wait_ms,
                    llm_hit=llm_hit,
                    repair_ms=repair_ms,
                    duration_ms=repair_ms,
                    **model_settings_log,
                )

        result = postprocess_output(
            output_type=state.output_type,
            content=content,
            prompt_title=state.effective_prompt or state.prompt,
            citations_count=len(state.citations),
            preference=state.preference,
            apply_structural=not state.plugin_schema_used,
        )

        processed = result.content
        if repair_attempted:
            warnings = processed.get("_warnings")
            if not isinstance(warnings, list):
                warnings = []
            warnings.append("llm_repaired" if repair_succeeded else "llm_repair_failed")
            processed["_warnings"] = list(dict.fromkeys(warnings))

        state.content = processed
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
            trace_id=state.trace_id,
            request_id=state.request_id,
            output_type=state.output_type.value,
            citations_count=len(state.citations),
        )

        citation_map = {index: cit for index, cit in enumerate(state.citations, start=1)}
        fallback_citations = state.citations[:1]
        state.content = cast(dict[str, object], _map_citations(state.content, citation_map, fallback_citations))
        return PersistOutput()


@dataclass
class PersistOutput(BaseNode[OutputGraphState, StudioDeps, Output]):
    """Persist the generated output to the database."""

    async def run(
        self, ctx: GraphRunContext[OutputGraphState, StudioDeps]
    ) -> End[Output]:
        state = ctx.state
        deps = ctx.deps

        persist_started = perf_counter()
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
        persist_ms = int((perf_counter() - persist_started) * 1000)
        log.info(
            "output persisted",
            trace_id=state.trace_id,
            request_id=state.request_id,
            output_id=db_output.id,
            notebook_id=state.notebook_id,
            output_type=state.output_type.value,
            preference=state.preference,
            persist_ms=persist_ms,
            duration_ms=persist_ms,
        )
        return End(db_output)


# =============================================================================
# Graph Definition
# =============================================================================

OUTPUT_GRAPH: Graph[OutputGraphState, StudioDeps, Output] = Graph(
    nodes=[ResolveContext, GenerateOutput, PostprocessOutput, MapCitations, PersistOutput]
)


async def run_output_graph(
    notebook_id: int,
    output_type: OutputType,
    prompt: str,
    deps: StudioDeps,
    *,
    trace_id: str | None = None,
    request_id: str | None = None,
    preference: GenerationPreference | None = None,
    source_ids: list[int] | None = None,
    top_k: int = 10,
    min_score: float = 0.0,
    model_id: str | None = None,
) -> Output:
    """Run the output generation graph and return the persisted Output.

    Args:
        notebook_id: The notebook to generate output for
        output_type: Type of output to generate
        prompt: User prompt for generation
        deps: Studio dependencies
        preference: Optional generation preference tuning (quality/speed)
        source_ids: Optional source IDs to constrain retrieval
        top_k: Number of chunks to retrieve from the selected sources
        min_score: Minimum similarity score for chunk retrieval
        model_id: Optional model ID to use (overrides default from settings)
    """
    state = OutputGraphState(
        trace_id=trace_id,
        request_id=request_id,
        notebook_id=notebook_id,
        output_type=output_type,
        prompt=prompt,
        preference=preference,
        source_ids=source_ids,
        top_k=top_k,
        min_score=min_score,
        model_id=model_id,
    )
    result = await OUTPUT_GRAPH.run(ResolveContext(), state=state, deps=deps)
    return result.output
