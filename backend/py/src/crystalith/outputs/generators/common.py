from __future__ import annotations

import json
from typing import Any

from crystalith.ai.types import ChatMessage
from crystalith.outputs.types import OutputType


SYSTEM_PROMPT = (
    "You are a research assistant. Answer strictly using the provided sources. "
    "Cite sources for every point using the source index list provided. "
    "Return ONLY valid JSON."
)


def build_messages(
    output_type: OutputType,
    prompt: str,
    context: str,
    format_instructions: str,
) -> list[ChatMessage]:
    system = f"{SYSTEM_PROMPT} Output type: {output_type.value}. {format_instructions}"
    user = f"Prompt:\n{prompt}\n\nSources:\n{context}"
    return [
        ChatMessage(role="system", content=system),
        ChatMessage(role="user", content=user),
    ]


def parse_json_payload(text: str) -> dict[str, Any] | None:
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        return None
    return payload if isinstance(payload, dict) else None


def normalize_text(value: Any, default: str = "") -> str:
    if value is None:
        return default
    text = str(value).strip()
    return text or default


def normalize_text_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    items: list[str] = []
    for item in value:
        text = normalize_text(item)
        if text:
            items.append(text)
    return items


def normalize_citation_indices(value: Any) -> list[int]:
    if not isinstance(value, list):
        return []
    indices: list[int] = []
    for item in value:
        try:
            index = int(item)
        except (TypeError, ValueError):
            continue
        if index > 0:
            indices.append(index)
    return indices


def normalize_cited_text(value: Any, default_text: str = "") -> dict[str, Any]:
    if isinstance(value, dict):
        text = normalize_text(value.get("text"), default_text)
        citations = normalize_citation_indices(value.get("citations"))
        return {"text": text, "citations": citations}
    if isinstance(value, str):
        return {"text": normalize_text(value, default_text), "citations": []}
    return {"text": default_text, "citations": []}


def normalize_cited_list(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    items: list[dict[str, Any]] = []
    for item in value:
        if isinstance(item, dict):
            items.append(normalize_cited_text(item, default_text=""))
        elif isinstance(item, str):
            text = normalize_text(item)
            if text:
                items.append({"text": text, "citations": []})
    return items
