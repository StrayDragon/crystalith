from __future__ import annotations

from crystalith.shared.ai.types import ChatMessage
from crystalith.shared.config import ContextWindowSettings
from crystalith.shared.context.compressor import summarize_messages
from crystalith.shared.context.counter import TokenCounter
from crystalith.shared.context.window import (
    ContextWindow,
    _format_query_segment,
    _format_retrieval_segment,
    _normalize_priority,
    _truncate_retrieval_segment,
)


def test_summarize_messages_and_helpers() -> None:
    counter = TokenCounter(model=None)
    summary = summarize_messages(
        [
            ChatMessage(role="user", content="Hello"),
            ChatMessage(role="assistant", content="World"),
        ],
        max_tokens=10_000,
        counter=counter,
    )
    assert "Summary of earlier messages:" in summary

    assert _format_query_segment("Q") == "Question:\nQ"
    assert _format_retrieval_segment("") == ""
    assert _format_retrieval_segment("S").startswith("\n\nSources:\n")


def test_truncate_retrieval_segment_respects_budget() -> None:
    counter = TokenCounter(model=None)
    assert _truncate_retrieval_segment("abc", budget=0, counter=counter) == ""
    assert _truncate_retrieval_segment("abc", budget=1, counter=counter) == ""
    truncated = _truncate_retrieval_segment("abc " * 100, budget=10, counter=counter)
    assert truncated.startswith("\n\nSources:\n")


def test_normalize_priority_dedupes_and_appends_defaults() -> None:
    assert _normalize_priority(["recent", "recent", "history"]) == ["recent", "history", "retrieval", "system"]


def test_context_window_build_compresses_and_truncates() -> None:
    settings = ContextWindowSettings(
        max_tokens=40,
        compression_strategy="summarize",
        window_size=1,
        priority=["history", "retrieval", "recent", "system"],
    )
    counter = TokenCounter(model=None)
    window = ContextWindow(settings, counter)

    system = ChatMessage(role="system", content="system prompt")
    history = [
        ChatMessage(role="user", content="older message " * 20),
        ChatMessage(role="assistant", content="recent message " * 20),
    ]

    messages, stats = window.build(
        system_message=system,
        history_messages=history,
        query="query " * 50,
        retrieval="retrieval " * 50,
    )

    assert messages[0].role == "system"
    assert messages[-1].role == "user"
    assert stats.max_tokens == 40
    assert stats.total_tokens <= stats.max_tokens
    assert stats.compressed is True


def test_context_window_handles_non_summarize_strategy() -> None:
    settings = ContextWindowSettings(
        max_tokens=20,
        compression_strategy="truncate",
        window_size=0,
        priority=[],
    )
    counter = TokenCounter(model=None)
    window = ContextWindow(settings, counter)

    messages, stats = window.build(
        system_message=ChatMessage(role="system", content="sys"),
        history_messages=[ChatMessage(role="user", content="older " * 50)],
        query="q " * 50,
        retrieval="",
    )
    assert stats.total_tokens <= stats.max_tokens
    assert messages[0].role == "system"
