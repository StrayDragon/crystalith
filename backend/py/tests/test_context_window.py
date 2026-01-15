from __future__ import annotations

import tiktoken

from crystalith.ai.types import ChatMessage
from crystalith.config import ContextWindowSettings
from crystalith.context import ContextWindow, TokenCounter


def test_token_counter_matches_tiktoken() -> None:
    counter = TokenCounter(model=None)
    encoding = tiktoken.get_encoding("cl100k_base")
    text = "hello world"
    assert counter.count_text(text) == len(encoding.encode(text))


def test_context_window_truncates_retrieval() -> None:
    counter = TokenCounter(model=None)
    system_message = ChatMessage(role="system", content="System")
    query = "Question?"
    retrieval = ("data " * 50).strip()

    query_segment = f"Question:\n{query}"
    base_tokens = counter.count_text(system_message.content) + counter.count_text(query_segment)
    prefix_tokens = counter.count_text("\n\nSources:\n")
    max_tokens = base_tokens + prefix_tokens + 3

    settings = ContextWindowSettings(
        max_tokens=max_tokens,
        compression_strategy="truncate",
        window_size=0,
    )
    window = ContextWindow(settings, counter)
    messages, stats = window.build(
        system_message=system_message,
        history_messages=[],
        query=query,
        retrieval=retrieval,
    )

    full_retrieval_tokens = counter.count_text(f"\n\nSources:\n{retrieval}")
    assert stats.retrieval_tokens < full_retrieval_tokens
    assert stats.total_tokens <= max_tokens
    assert stats.compressed is True
    assert "Sources:" in messages[-1].content


def test_context_window_sliding_window_keeps_recent_messages() -> None:
    counter = TokenCounter(model=None)
    settings = ContextWindowSettings(
        max_tokens=2000,
        compression_strategy="truncate",
        window_size=2,
    )
    window = ContextWindow(settings, counter)
    system_message = ChatMessage(role="system", content="System")
    history_messages = [
        ChatMessage(role="user", content="m1"),
        ChatMessage(role="assistant", content="m2"),
        ChatMessage(role="user", content="m3"),
        ChatMessage(role="assistant", content="m4"),
    ]

    messages, stats = window.build(
        system_message=system_message,
        history_messages=history_messages,
        query="Now",
        retrieval="",
    )

    assert [message.content for message in messages[1:-1]] == ["m3", "m4"]
    assert stats.compressed is True


def test_context_window_summarizes_history() -> None:
    counter = TokenCounter(model=None)
    settings = ContextWindowSettings(
        max_tokens=2000,
        compression_strategy="summarize",
        window_size=1,
    )
    window = ContextWindow(settings, counter)
    system_message = ChatMessage(role="system", content="System")
    history_messages = [
        ChatMessage(role="user", content="m1"),
        ChatMessage(role="assistant", content="m2"),
        ChatMessage(role="user", content="m3"),
    ]

    messages, stats = window.build(
        system_message=system_message,
        history_messages=history_messages,
        query="Now",
        retrieval="",
    )

    assert messages[1].content.startswith("Summary of earlier messages:")
    assert "m1" in messages[1].content
    assert messages[2].content == "m3"
    assert stats.compressed is True
