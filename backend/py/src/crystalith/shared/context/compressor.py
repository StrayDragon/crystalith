from __future__ import annotations

from crystalith.shared.ai.types import ChatMessage

from .counter import TokenCounter


def summarize_messages(messages: list[ChatMessage], max_tokens: int, counter: TokenCounter) -> str:
    if max_tokens <= 0:
        return ""
    lines = [f"{message.role}: {message.content}".strip() for message in messages if message.content.strip()]
    if not lines:
        return ""
    summary = "Summary of earlier messages:\n" + "\n".join(lines)
    return counter.truncate_text(summary, max_tokens)
