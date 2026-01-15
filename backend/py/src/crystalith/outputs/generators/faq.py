from __future__ import annotations

from typing import Any

from crystalith.ai.interfaces import ChatProvider

from ..types import OutputContent, OutputType
from .common import (
    build_messages,
    normalize_citation_indices,
    normalize_text,
    parse_json_payload,
)


class FAQGenerator:
    def __init__(self, chatter: ChatProvider) -> None:
        self._chatter = chatter

    async def generate(self, context: str, prompt: str) -> OutputContent:
        final_prompt = prompt.strip() or "Generate a FAQ from the sources."
        messages = build_messages(
            OutputType.FAQ,
            final_prompt,
            context,
            (
                "Return JSON with key 'items': list of objects with keys "
                "'question' (string), 'answer' (string), 'citations' (list of source indexes). "
                "Provide 5-10 items."
            ),
        )
        answer = await self._chatter.chat(messages)
        payload = parse_json_payload(answer)
        items = _normalize_items(payload.get("items") if payload else None, final_prompt)
        if not items:
            items = [_fallback_item(final_prompt)]
        return {"items": items}


def _normalize_items(raw: Any, fallback_question: str) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    items: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        question = normalize_text(item.get("question"), fallback_question)
        answer = normalize_text(item.get("answer"))
        if not question and not answer:
            continue
        items.append(
            {
                "question": question,
                "answer": answer,
                "citations": normalize_citation_indices(item.get("citations")),
            }
        )
    return items


def _fallback_item(prompt: str) -> dict[str, Any]:
    return {
        "question": prompt,
        "answer": "",
        "citations": [1],
    }
