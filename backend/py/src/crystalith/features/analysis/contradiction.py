from __future__ import annotations

import re
import asyncio
from collections.abc import Mapping, Sequence

from crystalith.shared.ai.interfaces import ChatProvider
from crystalith.shared.ai.types import ChatMessage

from .types import Relation


def _normalize_response(text: str) -> str:
    cleaned = re.sub(r"\s+", " ", text.strip().lower())
    return cleaned


def _is_contradiction(text: str) -> bool:
    normalized = _normalize_response(text)
    if not normalized:
        return False
    if normalized.startswith("yes") or normalized == "true":
        return True
    if normalized.startswith("no") or normalized == "false":
        return False
    if "contradict" in normalized and "not" not in normalized:
        return True
    return False


def _truncate(text: str, limit: int = 800) -> str:
    cleaned = " ".join(text.strip().split())
    if len(cleaned) <= limit:
        return cleaned
    return f"{cleaned[:limit]}..."


def _build_messages(left: str, right: str) -> list[ChatMessage]:
    return [
        ChatMessage(
            role="system",
            content=(
                "You compare two excerpts from different sources. "
                "Determine if they contradict each other. "
                "Respond with 'yes' or 'no' only."
            ),
        ),
        ChatMessage(
            role="user",
            content=(
                f"Excerpt A:\n{left}\n\n"
                f"Excerpt B:\n{right}\n\n"
                "Do these excerpts contradict each other?"
            ),
        ),
    ]


async def detect_contradictions(
    relations: Sequence[Relation],
    chunk_texts: Mapping[int, str],
    chatter: ChatProvider,
    *,
    max_checks: int = 12,
    concurrency_limit: int = 5,
) -> list[Relation]:
    if max_checks <= 0:
        return []

    candidates = [relation for relation in relations if relation.relation_type == "similar"]
    candidates.sort(key=lambda item: item.score, reverse=True)

    semaphore = asyncio.Semaphore(max(concurrency_limit, 1))

    async def _detect_for_relation(relation: Relation) -> Relation | None:
        left_text = chunk_texts.get(relation.source_chunk_id)
        right_text = chunk_texts.get(relation.target_chunk_id)
        if not left_text or not right_text:
            return None
        messages = _build_messages(_truncate(left_text), _truncate(right_text))
        async with semaphore:
            response = await chatter.chat(messages)
        if _is_contradiction(response):
            return Relation(
                source_chunk_id=relation.source_chunk_id,
                target_chunk_id=relation.target_chunk_id,
                relation_type="contradicts",
                score=relation.score,
            )
        return None

    detections = await asyncio.gather(*[_detect_for_relation(item) for item in candidates[:max_checks]])
    contradictions = [item for item in detections if item is not None]

    return contradictions
