from __future__ import annotations

from typing import Any

from crystalith.ai.interfaces import ChatProvider

from ..types import OutputContent, OutputType
from .common import (
    build_messages,
    normalize_citation_indices,
    normalize_text,
    normalize_text_list,
    parse_json_payload,
)


class StructuredGenerator:
    def __init__(self, chatter: ChatProvider) -> None:
        self._chatter = chatter

    async def generate(self, context: str, prompt: str) -> OutputContent:
        final_prompt = prompt.strip() or "Create a structured summary from the sources."
        messages = build_messages(
            OutputType.STRUCTURED,
            final_prompt,
            context,
            (
                "Return JSON with keys 'title' (string), "
                "'bullets' (list of objects with text/citations), "
                "and 'terms' (list of strings)."
            ),
        )
        answer = await self._chatter.chat(messages)
        payload = parse_json_payload(answer)
        if not payload:
            return _fallback_structured(final_prompt)
        bullets = _normalize_bullets(payload.get("bullets"))
        if not bullets:
            bullets = [{"text": final_prompt, "citations": [1]}]
        return {
            "title": normalize_text(payload.get("title"), final_prompt),
            "bullets": bullets,
            "terms": normalize_text_list(payload.get("terms")),
        }


def _normalize_bullets(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    items: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        text = normalize_text(item.get("text"))
        if not text:
            continue
        items.append(
            {
                "text": text,
                "citations": normalize_citation_indices(item.get("citations")),
            }
        )
    return items


def _fallback_structured(prompt: str) -> OutputContent:
    return {"title": prompt, "bullets": [{"text": prompt, "citations": [1]}], "terms": []}
