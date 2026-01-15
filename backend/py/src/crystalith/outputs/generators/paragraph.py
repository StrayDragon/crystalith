from __future__ import annotations

from crystalith.ai.interfaces import ChatProvider

from ..types import OutputContent, OutputType
from .common import build_messages, normalize_citation_indices, normalize_text, parse_json_payload


class ParagraphGenerator:
    def __init__(self, chatter: ChatProvider) -> None:
        self._chatter = chatter

    async def generate(self, context: str, prompt: str) -> OutputContent:
        final_prompt = prompt.strip() or "Summarize the sources as a paragraph."
        messages = build_messages(
            OutputType.PARAGRAPH,
            final_prompt,
            context,
            (
                "Return JSON with keys 'text' (string) and "
                "'citations' (list of source indexes)."
            ),
        )
        answer = await self._chatter.chat(messages)
        payload = parse_json_payload(answer)
        if not payload:
            return _fallback_paragraph(final_prompt)
        return {
            "text": normalize_text(payload.get("text"), final_prompt),
            "citations": normalize_citation_indices(payload.get("citations")),
        }


def _fallback_paragraph(prompt: str) -> OutputContent:
    return {"text": prompt, "citations": [1]}
