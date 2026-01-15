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


class TimelineGenerator:
    def __init__(self, chatter: ChatProvider) -> None:
        self._chatter = chatter

    async def generate(self, context: str, prompt: str) -> OutputContent:
        final_prompt = prompt.strip() or "Create a timeline from the sources."
        messages = build_messages(
            OutputType.TIMELINE,
            final_prompt,
            context,
            (
                "Return JSON with key 'events': list of objects with keys "
                "'date' (string), 'event' (string), 'description' (string), "
                "'citations' (list of source indexes)."
            ),
        )
        answer = await self._chatter.chat(messages)
        payload = parse_json_payload(answer)
        events = _normalize_events(payload.get("events") if payload else None, final_prompt)
        if not events:
            events = [_fallback_event(final_prompt)]
        return {"events": events}


def _normalize_events(raw: Any, fallback_label: str) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    events: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        events.append(
            {
                "date": normalize_text(item.get("date")),
                "event": normalize_text(item.get("event"), fallback_label),
                "description": normalize_text(item.get("description")),
                "citations": normalize_citation_indices(item.get("citations")),
            }
        )
    return events


def _fallback_event(prompt: str) -> dict[str, Any]:
    return {
        "date": "",
        "event": prompt,
        "description": "",
        "citations": [1],
    }
