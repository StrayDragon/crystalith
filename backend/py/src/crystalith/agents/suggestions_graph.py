from __future__ import annotations

from typing import Any, Iterable, TypedDict

from langgraph.graph import END, StateGraph
from pydantic import BaseModel, ConfigDict
from pydantic_ai import Agent
from sqlalchemy import select

from cl_logs.logging import get_logger

from crystalith.agents.deps import StudioDeps
from crystalith.agents.models import build_chat_model
from crystalith.db import Chunk, Message, Session, Source, SourceStatus
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


class SuggestionState(TypedDict, total=False):
    notebook_id: int
    session_id: int
    count: int
    mode: str
    seed_question: str | None
    deps: StudioDeps
    context_text: str
    fallback_context: str
    drafts: list[SuggestionDraft]
    suggestions: list[Suggestion]


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


async def _load_context(state: SuggestionState) -> dict[str, Any]:
    deps = state["deps"]
    count = state["count"]
    mode = state["mode"]
    seed_question = state.get("seed_question")

    if "notebook_id" in state:
        rows = await deps.session.execute(
            select(Chunk, Source)
            .join(Source, Source.id == Chunk.source_id)
            .where(
                Source.notebook_id == state["notebook_id"],
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
        context_text = format_source_context(snippets) if snippets else ""
        fallback_context = "notebook sources"
        if mode == "deep_dive":
            seed = _normalize_whitespace(seed_question or "")
            if not seed:
                raise ValueError("seed_question is required for deep_dive")
            fallback_context = f"Deep dive on: {seed}"
            return {
                "context_text": context_text,
                "fallback_context": fallback_context,
                "seed_question": seed,
                "count": count,
            }
        return {
            "context_text": context_text,
            "fallback_context": fallback_context,
            "count": count,
        }

    rows = await deps.session.execute(
        select(Message)
        .where(Message.session_id == state["session_id"])
        .order_by(Message.created_at.desc())
        .limit(MAX_SESSION_MESSAGES)
    )
    messages = list(rows.scalars().all())
    messages.reverse()
    turns = [SessionTurn(role=message.role, content=message.content) for message in messages]
    context_text = format_session_context(turns) if turns else ""
    fallback_context = "session history"

    if mode == "deep_dive":
        seed = _normalize_whitespace(seed_question or "")
        if not seed:
            seed = _last_user_question(turns) or ""
        if not seed:
            raise ValueError("seed_question is required for deep_dive")
        fallback_context = f"Deep dive on: {seed}"
        return {
            "context_text": context_text,
            "fallback_context": fallback_context,
            "seed_question": seed,
            "count": count,
        }

    return {
        "context_text": context_text,
        "fallback_context": fallback_context,
        "count": count,
    }


async def _generate_drafts(state: SuggestionState) -> dict[str, Any]:
    deps = state["deps"]
    mode = state["mode"]
    count = state["count"]
    context_text = state.get("context_text", "")
    fallback_context = state.get("fallback_context", "")
    seed_question = state.get("seed_question")

    system_prompt = SYSTEM_PROMPT_DEEP_DIVE if mode == "deep_dive" else SYSTEM_PROMPT_STANDARD
    model = deps.model or build_chat_model(deps.settings)
    agent = Agent(
        model,
        output_type=SuggestionDraftList,
        deps_type=StudioDeps,
        system_prompt=system_prompt,
        retries=2,
    )

    if mode == "deep_dive":
        user_prompt = f"Seed question:\n{seed_question}\n\nContext:\n{context_text}\nCount: {count}"
    else:
        user_prompt = f"Context:\n{context_text}\nCount: {count}"

    try:
        result = await agent.run(user_prompt, deps=deps)
        items = result.output.items
    except Exception as error:  # noqa: BLE001 - fallback for generation
        log.warning("suggestion generation failed", exc_info=error)
        items = []

    drafts = _normalize_drafts(items, limit=count, fallback_context=fallback_context)
    return {"drafts": drafts}


async def _classify_or_finalize(state: SuggestionState) -> dict[str, Any]:
    mode = state["mode"]
    drafts = state.get("drafts", [])
    fallback_context = state.get("fallback_context", "")

    if not drafts:
        return {"suggestions": []}

    if mode == "deep_dive":
        suggestions = [
            Suggestion(
                question=draft.question,
                context=draft.context or fallback_context,
                type=SuggestionType.DEEP_DIVE,
            )
            for draft in drafts
        ]
        return {"suggestions": suggestions}

    deps = state["deps"]
    model = deps.model or build_chat_model(deps.settings)
    agent = Agent(
        model,
        output_type=SuggestionClassList,
        deps_type=StudioDeps,
        system_prompt=SYSTEM_PROMPT_CLASSIFY,
        retries=2,
    )

    questions = [draft.question for draft in drafts]
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
    for index, draft in enumerate(drafts):
        key = _question_key(draft.question)
        suggestion_type = mapping.get(key) or cycle[index % len(cycle)]
        context = draft.context or fallback_context
        suggestions.append(
            Suggestion(
                question=draft.question,
                context=context,
                type=suggestion_type,
            )
        )

    return {"suggestions": suggestions}


def _build_graph():
    graph = StateGraph(SuggestionState)
    graph.add_node("load_context", _load_context)
    graph.add_node("generate_drafts", _generate_drafts)
    graph.add_node("classify_or_finalize", _classify_or_finalize)
    graph.set_entry_point("load_context")
    graph.add_edge("load_context", "generate_drafts")
    graph.add_edge("generate_drafts", "classify_or_finalize")
    graph.add_edge("classify_or_finalize", END)
    return graph.compile()


_SUGGESTION_GRAPH = _build_graph()


async def run_suggestions_graph(state: SuggestionState) -> list[Suggestion]:
    result = await _SUGGESTION_GRAPH.ainvoke(state)
    return result.get("suggestions", [])
