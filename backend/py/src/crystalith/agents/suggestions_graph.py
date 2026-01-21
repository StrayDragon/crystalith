from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Iterable

from pydantic import BaseModel, ConfigDict
from pydantic_ai import Agent
from pydantic_graph import BaseNode, End, Graph, GraphRunContext
from sqlalchemy import select

from cl_logs.logging import get_logger

from crystalith.agents.deps import StudioDeps
from crystalith.agents.models import build_chat_model
from crystalith.db import Chunk, Message, Source, SourceStatus
from crystalith.suggestions.generator import (
    FALLBACK_QUESTIONS,
    TYPE_ALIASES,
    SessionTurn,
    SourceSnippet,
    Suggestion,
    SuggestionDraft,
    format_session_context,
    format_source_context,
)
from crystalith.suggestions.types import SuggestionType


log = get_logger(__name__)

MAX_SOURCE_SNIPPETS = 6
MAX_SESSION_MESSAGES = 10


@dataclass
class SuggestionGraphState:
    """State object passed through the suggestion generation graph."""

    notebook_id: int | None = None
    session_id: int | None = None
    count: int = 5
    mode: str = "standard"
    seed_question: str | None = None
    context_text: str = ""
    fallback_context: str = ""
    drafts: list[SuggestionDraft] = field(default_factory=list)
    suggestions: list[Suggestion] = field(default_factory=list)


class SuggestionDraftItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: str
    context: str | None = None


class SuggestionDraftList(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[SuggestionDraftItem]


class SuggestionClassItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: str
    type: str


class SuggestionClassList(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[SuggestionClassItem]


SYSTEM_PROMPT_STANDARD = (
    "You generate helpful follow-up questions based on the provided context. "
    "Return JSON with key 'items': list of objects with keys question and context. "
    "Each question should be one sentence and grounded in the context."
)

SYSTEM_PROMPT_DEEP_DIVE = (
    "You are a Socratic tutor. Generate a deep-dive sequence of questions that "
    "builds on the seed question. Return JSON with key 'items': list of objects "
    "with keys question and context."
)

SYSTEM_PROMPT_CLASSIFY = (
    "Classify each question into one of: factual, analytical, comparative, creative. "
    "Return JSON with key 'items': list of objects with keys question and type."
)


def _normalize_whitespace(text: str) -> str:
    return " ".join(text.strip().split())


def _question_key(text: str) -> str:
    return _normalize_whitespace(text).lower()


def _is_valid_question(text: str) -> bool:
    if len(text) < 6:
        return False
    lowered = text.lower()
    if lowered.startswith("```"):
        return False
    return True


def _normalize_drafts(
    items: Iterable[SuggestionDraftItem],
    *,
    limit: int,
    fallback_context: str,
) -> list[SuggestionDraft]:
    limit = max(3, min(5, limit))
    drafts: list[SuggestionDraft] = []
    seen: set[str] = set()

    for item in items:
        question = _normalize_whitespace(item.question)
        if not _is_valid_question(question):
            continue
        key = _question_key(question)
        if key in seen:
            continue
        seen.add(key)
        context = _normalize_whitespace(item.context or fallback_context) or fallback_context
        drafts.append(SuggestionDraft(question=question, context=context))
        if len(drafts) >= limit:
            return drafts

    for fallback in FALLBACK_QUESTIONS:
        if len(drafts) >= limit:
            break
        question = _normalize_whitespace(fallback)
        if not question:
            continue
        key = _question_key(question)
        if key in seen:
            continue
        seen.add(key)
        drafts.append(SuggestionDraft(question=question, context=fallback_context))

    return drafts


def _normalize_type(value: str) -> SuggestionType | None:
    cleaned = _normalize_whitespace(value).lower()
    return TYPE_ALIASES.get(cleaned)


def _last_user_question(turns: list[SessionTurn]) -> str | None:
    for turn in reversed(turns):
        if turn.role == "user":
            cleaned = _normalize_whitespace(turn.content)
            if cleaned:
                return cleaned
    return None


# =============================================================================
# Graph Nodes
# =============================================================================


@dataclass
class LoadContext(BaseNode[SuggestionGraphState, StudioDeps, list[Suggestion]]):
    """Load context from notebook sources or session messages."""

    async def run(
        self, ctx: GraphRunContext[SuggestionGraphState, StudioDeps]
    ) -> "GenerateDrafts":
        state = ctx.state
        deps = ctx.deps

        if state.notebook_id is not None:
            rows = await deps.session.execute(
                select(Chunk, Source)
                .join(Source, Source.id == Chunk.source_id)
                .where(
                    Source.notebook_id == state.notebook_id,
                    Source.status == SourceStatus.READY,
                )
                .order_by(Source.created_at.desc(), Chunk.chunk_index.asc())
                .limit(MAX_SOURCE_SNIPPETS)
            )
            snippets = [
                SourceSnippet(
                    source_name=source.filename,
                    chunk_index=chunk.chunk_index,
                    text=chunk.text,
                )
                for chunk, source in rows.all()
            ]
            state.context_text = format_source_context(snippets) if snippets else ""
            state.fallback_context = "notebook sources"
            if state.mode == "deep_dive":
                seed = _normalize_whitespace(state.seed_question or "")
                if not seed:
                    raise ValueError("seed_question is required for deep_dive")
                state.fallback_context = f"Deep dive on: {seed}"
                state.seed_question = seed
            return GenerateDrafts()

        # Session-based context
        rows = await deps.session.execute(
            select(Message)
            .where(Message.session_id == state.session_id)
            .order_by(Message.created_at.desc())
            .limit(MAX_SESSION_MESSAGES)
        )
        messages = list(rows.scalars().all())
        messages.reverse()
        turns = [SessionTurn(role=message.role, content=message.content) for message in messages]
        state.context_text = format_session_context(turns) if turns else ""
        state.fallback_context = "session history"

        if state.mode == "deep_dive":
            seed = _normalize_whitespace(state.seed_question or "")
            if not seed:
                seed = _last_user_question(turns) or ""
            if not seed:
                raise ValueError("seed_question is required for deep_dive")
            state.fallback_context = f"Deep dive on: {seed}"
            state.seed_question = seed

        return GenerateDrafts()


@dataclass
class GenerateDrafts(BaseNode[SuggestionGraphState, StudioDeps, list[Suggestion]]):
    """Generate suggestion drafts using LLM."""

    async def run(
        self, ctx: GraphRunContext[SuggestionGraphState, StudioDeps]
    ) -> "ClassifyOrFinalize":
        state = ctx.state
        deps = ctx.deps

        log.info(
            "generating suggestion drafts",
            mode=state.mode,
            count=state.count,
            context_length=len(state.context_text),
            has_seed=bool(state.seed_question),
        )

        system_prompt = SYSTEM_PROMPT_DEEP_DIVE if state.mode == "deep_dive" else SYSTEM_PROMPT_STANDARD
        model = deps.model or build_chat_model(deps.settings)
        agent = Agent(
            model,
            output_type=SuggestionDraftList,
            deps_type=StudioDeps,
            system_prompt=system_prompt,
            retries=2,
        )

        if state.mode == "deep_dive":
            user_prompt = f"Seed question:\n{state.seed_question}\n\nContext:\n{state.context_text}\nCount: {state.count}"
        else:
            user_prompt = f"Context:\n{state.context_text}\nCount: {state.count}"

        try:
            result = await agent.run(user_prompt, deps=deps)
            items = result.output.items
            log.info(
                "suggestion drafts generated",
                mode=state.mode,
                generated_count=len(items),
            )
        except Exception as error:  # noqa: BLE001 - fallback for generation
            error_type = type(error).__name__
            error_message = str(error)[:200]
            log.warning(
                "suggestion generation failed, using fallback",
                exc_info=error,
                mode=state.mode,
                error_type=error_type,
                error_message=error_message,
            )
            items = []

        state.drafts = _normalize_drafts(items, limit=state.count, fallback_context=state.fallback_context)
        return ClassifyOrFinalize()


@dataclass
class ClassifyOrFinalize(BaseNode[SuggestionGraphState, StudioDeps, list[Suggestion]]):
    """Classify suggestions or finalize for deep_dive mode."""

    async def run(
        self, ctx: GraphRunContext[SuggestionGraphState, StudioDeps]
    ) -> End[list[Suggestion]]:
        state = ctx.state
        deps = ctx.deps

        log.debug(
            "classifying suggestions",
            mode=state.mode,
            drafts_count=len(state.drafts),
        )

        if not state.drafts:
            log.info("no drafts to classify, returning empty suggestions")
            return End([])

        if state.mode == "deep_dive":
            state.suggestions = [
                Suggestion(
                    question=draft.question,
                    context=draft.context or state.fallback_context,
                    type=SuggestionType.DEEP_DIVE,
                )
                for draft in state.drafts
            ]
            return End(state.suggestions)

        model = deps.model or build_chat_model(deps.settings)
        agent = Agent(
            model,
            output_type=SuggestionClassList,
            deps_type=StudioDeps,
            system_prompt=SYSTEM_PROMPT_CLASSIFY,
            retries=2,
        )

        questions = [draft.question for draft in state.drafts]
        user_prompt = "Questions:\n" + "\n".join(f"- {question}" for question in questions)
        mapping: dict[str, SuggestionType] = {}
        try:
            result = await agent.run(user_prompt, deps=deps)
            for item in result.output.items:
                suggestion_type = _normalize_type(item.type)
                if suggestion_type is None:
                    continue
                key = _question_key(item.question)
                mapping[key] = suggestion_type
        except Exception as error:  # noqa: BLE001 - fallback to cycling
            log.warning("suggestion classification failed", exc_info=error)

        cycle = [
            SuggestionType.FACTUAL,
            SuggestionType.ANALYTICAL,
            SuggestionType.COMPARATIVE,
            SuggestionType.CREATIVE,
        ]
        suggestions: list[Suggestion] = []
        for index, draft in enumerate(state.drafts):
            key = _question_key(draft.question)
            suggestion_type = mapping.get(key) or cycle[index % len(cycle)]
            context = draft.context or state.fallback_context
            suggestions.append(
                Suggestion(
                    question=draft.question,
                    context=context,
                    type=suggestion_type,
                )
            )

        state.suggestions = suggestions
        return End(suggestions)


# =============================================================================
# Graph Definition
# =============================================================================

SUGGESTION_GRAPH: Graph[SuggestionGraphState, StudioDeps, list[Suggestion]] = Graph(
    nodes=[LoadContext, GenerateDrafts, ClassifyOrFinalize]
)


async def run_suggestions_graph(
    deps: StudioDeps,
    *,
    notebook_id: int | None = None,
    session_id: int | None = None,
    count: int = 5,
    mode: str = "standard",
    seed_question: str | None = None,
) -> list[Suggestion]:
    """Run the suggestions graph and return the suggestions."""
    state = SuggestionGraphState(
        notebook_id=notebook_id,
        session_id=session_id,
        count=count,
        mode=mode,
        seed_question=seed_question,
    )
    result = await SUGGESTION_GRAPH.run(LoadContext(), state=state, deps=deps)
    return result.output
