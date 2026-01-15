from __future__ import annotations

from typing import Any

from crystalith.ai.interfaces import ChatProvider

from ..types import OutputContent, OutputType
from .common import (
    build_messages,
    normalize_cited_list,
    normalize_text,
    parse_json_payload,
)


class BriefingGenerator:
    def __init__(self, chatter: ChatProvider) -> None:
        self._chatter = chatter

    async def generate(self, context: str, prompt: str) -> OutputContent:
        final_prompt = prompt.strip() or "Create an executive briefing from the sources."
        messages = build_messages(
            OutputType.BRIEFING,
            final_prompt,
            context,
            (
                "Return JSON with key 'sections': list of objects with keys "
                "'heading' (string) and 'points' (list of text/citations objects). "
                "Include sections for background, key findings, recommendations, and next steps."
            ),
        )
        answer = await self._chatter.chat(messages)
        payload = parse_json_payload(answer)
        sections = _normalize_sections(payload.get("sections") if payload else None, final_prompt)
        if not sections:
            sections = [_fallback_section(final_prompt)]
        return {"sections": sections}


def _normalize_sections(raw: Any, fallback_heading: str) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    sections: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        sections.append(
            {
                "heading": normalize_text(item.get("heading"), fallback_heading),
                "points": normalize_cited_list(item.get("points")),
            }
        )
    return sections


def _fallback_section(prompt: str) -> dict[str, Any]:
    return {
        "heading": prompt,
        "points": [{"text": "", "citations": [1]}],
    }
