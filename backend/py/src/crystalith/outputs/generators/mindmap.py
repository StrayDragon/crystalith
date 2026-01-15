from __future__ import annotations

from typing import Any

from crystalith.ai.interfaces import ChatProvider

from ..types import OutputContent, OutputType
from .common import build_messages, normalize_citation_indices, normalize_text, parse_json_payload


class MindmapGenerator:
    def __init__(self, chatter: ChatProvider) -> None:
        self._chatter = chatter

    async def generate(self, context: str, prompt: str) -> OutputContent:
        final_prompt = prompt.strip() or "Create a mindmap from the sources."
        messages = build_messages(
            OutputType.MINDMAP,
            final_prompt,
            context,
            (
                "Return JSON with key 'root': object with keys 'label' (string), "
                "'citations' (list of source indexes), and 'children' (list of nodes). "
                "Each child node has the same shape."
            ),
        )
        answer = await self._chatter.chat(messages)
        payload = parse_json_payload(answer)
        root = _normalize_node(payload.get("root") if payload else None, final_prompt)
        return {"root": root}


def _normalize_node(raw: Any, fallback_label: str) -> dict[str, Any]:
    if not isinstance(raw, dict):
        return {
            "label": fallback_label,
            "citations": [1],
            "children": [],
        }
    label = normalize_text(raw.get("label"), fallback_label)
    children_raw = raw.get("children")
    children: list[dict[str, Any]] = []
    if isinstance(children_raw, list):
        for child in children_raw:
            children.append(_normalize_node(child, fallback_label))
    return {
        "label": label,
        "citations": normalize_citation_indices(raw.get("citations")),
        "children": children,
    }
