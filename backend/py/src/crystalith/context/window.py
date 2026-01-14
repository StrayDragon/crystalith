from __future__ import annotations

from crystalith.ai.types import ChatMessage
from crystalith.config import ContextWindowSettings

from .compressor import summarize_messages
from .counter import TokenCounter
from .types import ContextPriority, ContextStats


_DEFAULT_PRIORITY: list[ContextPriority] = ["history", "retrieval", "recent", "system"]


class ContextWindow:
    def __init__(self, settings: ContextWindowSettings, counter: TokenCounter) -> None:
        self._settings = settings
        self._counter = counter

    def build(
        self,
        *,
        system_message: ChatMessage,
        history_messages: list[ChatMessage],
        query: str,
        retrieval: str,
    ) -> tuple[list[ChatMessage], ContextStats]:
        max_tokens = max(1, int(self._settings.max_tokens))
        window_size = max(0, int(self._settings.window_size))

        recent_messages = history_messages[-window_size:] if window_size else []
        older_messages = history_messages[:-window_size] if window_size else history_messages

        compressed = False
        history_summary_text = ""
        if older_messages:
            compressed = True
            if self._settings.compression_strategy == "summarize":
                history_summary_text = summarize_messages(
                    older_messages,
                    max_tokens,
                    self._counter,
                )

        query_segment = _format_query_segment(query)
        retrieval_segment = _format_retrieval_segment(retrieval)

        system_tokens = self._counter.count_text(system_message.content)
        recent_tokens = self._counter.count_messages(recent_messages)
        history_summary_tokens = self._counter.count_text(history_summary_text)
        query_tokens = self._counter.count_text(query_segment)
        retrieval_tokens = self._counter.count_text(retrieval_segment)

        total_tokens = system_tokens + recent_tokens + history_summary_tokens + query_tokens + retrieval_tokens

        priority = _normalize_priority(self._settings.priority)
        for item in priority:
            if total_tokens <= max_tokens:
                break
            if item == "history" and history_summary_tokens:
                budget = max_tokens - (total_tokens - history_summary_tokens)
                history_summary_text = self._counter.truncate_text(
                    history_summary_text,
                    max(0, budget),
                )
                new_tokens = self._counter.count_text(history_summary_text)
                if new_tokens != history_summary_tokens:
                    compressed = True
                history_summary_tokens = new_tokens
            elif item == "retrieval" and retrieval_tokens:
                budget = max_tokens - (total_tokens - retrieval_tokens)
                new_segment = _truncate_retrieval_segment(
                    retrieval,
                    max(0, budget),
                    self._counter,
                )
                if new_segment != retrieval_segment:
                    compressed = True
                retrieval_segment = new_segment
                retrieval_tokens = self._counter.count_text(retrieval_segment)
            elif item == "recent" and recent_messages:
                while recent_messages and total_tokens > max_tokens:
                    dropped = recent_messages.pop(0)
                    recent_tokens -= self._counter.count_text(dropped.content)
                    compressed = True
                    total_tokens = (
                        system_tokens
                        + recent_tokens
                        + history_summary_tokens
                        + query_tokens
                        + retrieval_tokens
                    )
                continue
            elif item == "system":
                continue
            total_tokens = system_tokens + recent_tokens + history_summary_tokens + query_tokens + retrieval_tokens

        if total_tokens > max_tokens:
            budget = max_tokens - (total_tokens - query_tokens)
            query_segment = self._counter.truncate_text(query_segment, max(0, budget))
            new_query_tokens = self._counter.count_text(query_segment)
            if new_query_tokens != query_tokens:
                compressed = True
            query_tokens = new_query_tokens
            total_tokens = system_tokens + recent_tokens + history_summary_tokens + query_tokens + retrieval_tokens

        messages = [system_message]
        if history_summary_text:
            messages.append(ChatMessage(role="assistant", content=history_summary_text))
        messages.extend(recent_messages)
        messages.append(ChatMessage(role="user", content=query_segment + retrieval_segment))

        history_tokens = recent_tokens + history_summary_tokens
        stats = ContextStats(
            total_tokens=total_tokens,
            system_tokens=system_tokens,
            history_tokens=history_tokens,
            retrieval_tokens=retrieval_tokens,
            query_tokens=query_tokens,
            max_tokens=max_tokens,
            compressed=compressed,
        )
        return messages, stats


def _format_query_segment(query: str) -> str:
    return f"Question:\n{query}"


def _format_retrieval_segment(retrieval: str) -> str:
    if not retrieval:
        return ""
    return f"\n\nSources:\n{retrieval}"


def _truncate_retrieval_segment(retrieval: str, budget: int, counter: TokenCounter) -> str:
    if not retrieval or budget <= 0:
        return ""
    prefix = "\n\nSources:\n"
    prefix_tokens = counter.count_text(prefix)
    if budget <= prefix_tokens:
        return ""
    trimmed_body = counter.truncate_text(retrieval, budget - prefix_tokens)
    if not trimmed_body:
        return ""
    return f"{prefix}{trimmed_body}"


def _normalize_priority(priority: list[ContextPriority]) -> list[ContextPriority]:
    resolved: list[ContextPriority] = []
    for item in priority:
        if item in _DEFAULT_PRIORITY and item not in resolved:
            resolved.append(item)
    for item in _DEFAULT_PRIORITY:
        if item not in resolved:
            resolved.append(item)
    return resolved
