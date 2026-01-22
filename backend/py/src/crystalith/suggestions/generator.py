from __future__ import annotations

import itertools
import json
import re
from dataclasses import dataclass
from typing import Iterable, Sequence

from cl_logs.logging import get_logger

from crystalith.ai.interfaces import ChatProvider
from crystalith.ai.types import ChatMessage
from crystalith.utils import normalize_whitespace, question_key

from .types import SuggestionType


MIN_SUGGESTIONS = 3
MAX_SUGGESTIONS = 5
MAX_SNIPPET_LENGTH = 420
MAX_MESSAGE_LENGTH = 320

FALLBACK_QUESTIONS: tuple[str, ...] = (
    "What is the main topic covered by these sources?",
    "Which concept is most critical to understand first?",
    "How do the key ideas compare or contrast?",
    "What implications or next steps emerge from the material?",
    "What open questions remain unanswered?",
)

TYPE_ALIASES = {
    "factual": SuggestionType.FACTUAL,
    "fact": SuggestionType.FACTUAL,
    "analytical": SuggestionType.ANALYTICAL,
    "analysis": SuggestionType.ANALYTICAL,
    "comparative": SuggestionType.COMPARATIVE,
    "compare": SuggestionType.COMPARATIVE,
    "comparison": SuggestionType.COMPARATIVE,
    "creative": SuggestionType.CREATIVE,
    "ideation": SuggestionType.CREATIVE,
    "deep_dive": SuggestionType.DEEP_DIVE,
    "deep dive": SuggestionType.DEEP_DIVE,
    "socratic": SuggestionType.DEEP_DIVE,
}

log = get_logger(__name__)


@dataclass(frozen=True, slots=True)
class SourceSnippet:
    source_name: str
    chunk_index: int
    text: str


@dataclass(frozen=True, slots=True)
class SessionTurn:
    role: str
    content: str


@dataclass(frozen=True, slots=True)
class SuggestionDraft:
    question: str
    context: str | None = None


@dataclass(frozen=True, slots=True)
class Suggestion:
    question: str
    context: str
    type: SuggestionType


def format_source_context(snippets: Sequence[SourceSnippet]) -> str:
    blocks: list[str] = []
    for index, snippet in enumerate(snippets, start=1):
        text = _truncate(snippet.text, MAX_SNIPPET_LENGTH)
        blocks.append(
            f"[{index}] Source: {snippet.source_name} (chunk {snippet.chunk_index})\n{text}"
        )
    return "\n\n".join(blocks)


def format_session_context(turns: Sequence[SessionTurn]) -> str:
    lines: list[str] = []
    for turn in turns:
        role = turn.role.strip().capitalize() or "User"
        content = _truncate(turn.content, MAX_MESSAGE_LENGTH)
        lines.append(f"{role}: {content}")
    return "\n".join(lines)


async def generate_contextual_suggestions(
    chatter: ChatProvider,
    *,
    context_label: str,
    context_text: str,
    count: int,
    fallback_context: str,
) -> list[Suggestion]:
    messages = _build_generation_messages(context_label, context_text, count)
    try:
        raw = await chatter.chat(messages)
    except Exception as error:  # noqa: BLE001 - degrade to fallback suggestions
        log.warning("suggestion generation failed", exc_info=error)
        raw = ""
    drafts = _parse_suggestions(raw, limit=count, fallback_context=fallback_context)
    return await classify_suggestions(chatter, drafts, fallback_context=fallback_context)


async def generate_deep_dive_suggestions(
    chatter: ChatProvider,
    *,
    seed_question: str,
    context_text: str,
    count: int,
    fallback_context: str,
) -> list[Suggestion]:
    messages = _build_deep_dive_messages(seed_question, context_text, count)
    try:
        raw = await chatter.chat(messages)
    except Exception as error:  # noqa: BLE001 - degrade to fallback suggestions
        log.warning("deep dive suggestion generation failed", exc_info=error)
        raw = ""
    drafts = _parse_suggestions(raw, limit=count, fallback_context=fallback_context)
    return _finalize_with_type(
        drafts,
        suggestion_type=SuggestionType.DEEP_DIVE,
        fallback_context=fallback_context,
    )


async def classify_suggestions(
    chatter: ChatProvider,
    drafts: Sequence[SuggestionDraft],
    *,
    fallback_context: str,
) -> list[Suggestion]:
    if not drafts:
        return []

    questions = [draft.question for draft in drafts]
    messages = _build_classification_messages(questions)
    mapping: dict[str, SuggestionType] = {}
    try:
        raw = await chatter.chat(messages)
        mapping = _parse_classifications(raw)
    except Exception as error:  # noqa: BLE001 - fall back to default cycling
        log.warning("suggestion classification failed", exc_info=error)
    fallback_cycle = itertools.cycle(
        [
            SuggestionType.FACTUAL,
            SuggestionType.ANALYTICAL,
            SuggestionType.COMPARATIVE,
            SuggestionType.CREATIVE,
        ]
    )

    suggestions: list[Suggestion] = []
    for draft in drafts:
        key = question_key(draft.question)
        suggestion_type = mapping.get(key) or next(fallback_cycle)
        context = normalize_whitespace(draft.context or fallback_context) or fallback_context
        suggestions.append(
            Suggestion(
                question=draft.question,
                context=context,
                type=suggestion_type,
            )
        )

    return suggestions


def _finalize_with_type(
    drafts: Sequence[SuggestionDraft],
    *,
    suggestion_type: SuggestionType,
    fallback_context: str,
) -> list[Suggestion]:
    suggestions: list[Suggestion] = []
    for draft in drafts:
        context = normalize_whitespace(draft.context or fallback_context) or fallback_context
        suggestions.append(
            Suggestion(
                question=draft.question,
                context=context,
                type=suggestion_type,
            )
        )
    return suggestions


def _build_generation_messages(
    context_label: str,
    context_text: str,
    count: int,
) -> list[ChatMessage]:
    system = (
        "You generate helpful follow-up questions based on the provided context. "
        "Return a JSON array of objects with keys: question and context. "
        "Each question should be one sentence and grounded in the context. "
        f"Return exactly {count} items."
    )
    user = f"{context_label}:\n{context_text}"
    return [ChatMessage(role="system", content=system), ChatMessage(role="user", content=user)]


def _build_deep_dive_messages(
    seed_question: str,
    context_text: str,
    count: int,
) -> list[ChatMessage]:
    system = (
        "You are a Socratic tutor. Generate a deep-dive sequence of questions that "
        "builds on the seed question. Return a JSON array of objects with keys: question and context. "
        f"Return exactly {count} items."
    )
    if context_text.strip():
        user = f"Seed question:\n{seed_question}\n\nContext:\n{context_text}"
    else:
        user = f"Seed question:\n{seed_question}"
    return [ChatMessage(role="system", content=system), ChatMessage(role="user", content=user)]


def _build_classification_messages(questions: Sequence[str]) -> list[ChatMessage]:
    system = (
        "Classify each question into one of: factual, analytical, comparative, creative. "
        "Return a JSON array of objects with keys: question and type."
    )
    user = "Questions:\n" + "\n".join(f"- {question}" for question in questions)
    return [ChatMessage(role="system", content=system), ChatMessage(role="user", content=user)]


def _parse_suggestions(
    raw: str,
    *,
    limit: int,
    fallback_context: str,
) -> list[SuggestionDraft]:
    limit = max(MIN_SUGGESTIONS, min(MAX_SUGGESTIONS, limit))
    items: list[SuggestionDraft] = []
    seen: set[str] = set()

    def _add_item(question: str, context: str | None) -> None:
        normalized = normalize_whitespace(question)
        if not normalized or not _is_valid_question(normalized):
            return
        key = question_key(normalized)
        if key in seen:
            return
        seen.add(key)
        context_value = normalize_whitespace(context or fallback_context) or fallback_context
        items.append(SuggestionDraft(question=normalized, context=context_value))

    parsed = _safe_json_load(raw)
    payload: Iterable[object] | None = None
    if isinstance(parsed, list):
        payload = parsed
    elif isinstance(parsed, dict):
        for key in ("items", "suggestions", "questions", "data"):
            if isinstance(parsed.get(key), list):
                payload = parsed[key]
                break
        if payload is None and "question" in parsed:
            payload = [parsed]
    if payload is not None:
        for entry in payload:
            if isinstance(entry, str):
                _add_item(entry, None)
            elif isinstance(entry, dict):
                _add_item(
                    str(entry.get("question", "")),
                    entry.get("context"),
                )
            if len(items) >= limit:
                return items
    else:
        for line in raw.splitlines():
            cleaned = _strip_bullets(line)
            if cleaned:
                _add_item(cleaned, None)
            if len(items) >= limit:
                return items

    for fallback in FALLBACK_QUESTIONS:
        if len(items) >= limit:
            break
        _add_item(fallback, fallback_context)

    return items


def _parse_classifications(raw: str) -> dict[str, SuggestionType]:
    parsed = _safe_json_load(raw)
    mapping: dict[str, SuggestionType] = {}

    def _add_entry(question: str, value: str) -> None:
        suggestion_type = _normalize_type(value)
        if suggestion_type is None:
            return
        key = question_key(question)
        if not key:
            return
        mapping[key] = suggestion_type

    payload: Iterable[object] | None = None
    if isinstance(parsed, list):
        payload = parsed
    elif isinstance(parsed, dict):
        if all(isinstance(value, str) for value in parsed.values()):
            for question, value in parsed.items():
                _add_entry(str(question), str(value))
            return mapping
        for key in ("items", "classifications", "data"):
            if isinstance(parsed.get(key), list):
                payload = parsed[key]
                break
        if payload is None and {"question", "type"}.issubset(parsed.keys()):
            payload = [parsed]

    if payload is None:
        log.warning("suggestion classification parse failed", raw=raw)
        return mapping

    for entry in payload:
        if isinstance(entry, dict):
            _add_entry(str(entry.get("question", "")), str(entry.get("type", "")))

    return mapping


def _safe_json_load(raw: str) -> object | None:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    raw_text = raw.strip()
    if not raw_text:
        log.warning("suggestion json parse failed", raw=raw)
        return None

    def _try_array_slice() -> object | None:
        match = re.search(r"\[\s*\{", raw_text)
        if match is None:
            return None
        start = match.start()
        end = raw_text.rfind("]")
        if end == -1 or end <= start:
            return None
        try:
            return json.loads(raw_text[start : end + 1])
        except json.JSONDecodeError:
            return None

    def _try_object_slice() -> object | None:
        match = re.search(r"\{\s*\"", raw_text)
        if match is None:
            return None
        start = match.start()
        end = raw_text.rfind("}")
        if end == -1 or end <= start:
            return None
        try:
            return json.loads(raw_text[start : end + 1])
        except json.JSONDecodeError:
            return None

    parsed = _try_array_slice()
    if parsed is None:
        parsed = _try_object_slice()
    if parsed is None:
        log.warning("suggestion json parse failed", raw=raw)
    return parsed


def _normalize_type(value: str) -> SuggestionType | None:
    cleaned = normalize_whitespace(value).lower()
    return TYPE_ALIASES.get(cleaned)


def _truncate(text: str, limit: int) -> str:
    cleaned = normalize_whitespace(text)
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[: limit - 3].rstrip() + "..."


def _strip_bullets(line: str) -> str:
    cleaned = line.strip().lstrip("-*•").strip()
    cleaned = re.sub(r"^\d+[\).]\s+", "", cleaned)
    return cleaned


def _is_valid_question(text: str) -> bool:
    if len(text) < 6:
        return False
    lowered = text.lower()
    if lowered.startswith("```"):
        return False
    if re.fullmatch(r"[\[\]{}]+", text):
        return False
    return bool(re.search(r"[A-Za-z0-9\u4e00-\u9fff]", text))
