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


class BulletsGenerator:
    def __init__(self, chatter: ChatProvider) -> None:
        self._chatter = chatter

    async def generate(self, context: str, prompt: str) -> OutputContent:
        final_prompt = prompt.strip() or "Summarize the sources as bullet points."
        messages = build_messages(
            OutputType.BULLETS,
            final_prompt,
            context,
            (
                "Return JSON with key 'items': list of objects with keys "
                "'text' (string) and 'citations' (list of source indexes)."
            ),
        )
        answer = await self._chatter.chat(messages)
        payload = parse_json_payload(answer)
        items = _normalize_items(payload.get("items") if payload else None, final_prompt)
        if not items:
            items = [{"text": final_prompt, "citations": [1]}]
        return {"items": items}


def _normalize_items(raw: Any, fallback_text: str) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    items: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        text = normalize_text(item.get("text"), fallback_text)
        if not text:
            continue
        items.append(
            {
                "text": text,
                "citations": normalize_citation_indices(item.get("citations")),
            }
        )
    return items
