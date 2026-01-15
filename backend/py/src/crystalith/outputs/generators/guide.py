from __future__ import annotations

from typing import Any

from crystalith.ai.interfaces import ChatProvider

from ..types import OutputContent, OutputType
from .common import (
    build_messages,
    normalize_cited_list,
    normalize_cited_text,
    normalize_text,
    parse_json_payload,
)


class GuideGenerator:
    def __init__(self, chatter: ChatProvider) -> None:
        self._chatter = chatter

    async def generate(self, context: str, prompt: str) -> OutputContent:
        final_prompt = prompt.strip() or "Create a study guide from the sources."
        messages = build_messages(
            OutputType.GUIDE,
            final_prompt,
            context,
            (
                "Return JSON with key 'modules': list of objects with keys "
                "'title' (string), 'objective' (object with text/citations), "
                "'key_points' (list of text/citations objects), "
                "'examples' (list of text/citations objects), "
                "'exercises' (list of text/citations objects)."
            ),
        )
        answer = await self._chatter.chat(messages)
        payload = parse_json_payload(answer)
        modules = _normalize_modules(payload.get("modules") if payload else None, final_prompt)
        if not modules:
            modules = [_fallback_module(final_prompt)]
        return {"modules": modules}


def _normalize_modules(raw: Any, fallback_title: str) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    modules: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        title = normalize_text(item.get("title"), fallback_title)
        module = {
            "title": title,
            "objective": normalize_cited_text(item.get("objective"), default_text=""),
            "key_points": normalize_cited_list(item.get("key_points")),
            "examples": normalize_cited_list(item.get("examples")),
            "exercises": normalize_cited_list(item.get("exercises")),
        }
        modules.append(module)
    return modules


def _fallback_module(prompt: str) -> dict[str, Any]:
    return {
        "title": prompt,
        "objective": {"text": "", "citations": [1]},
        "key_points": [{"text": "", "citations": [1]}],
        "examples": [],
        "exercises": [],
    }
