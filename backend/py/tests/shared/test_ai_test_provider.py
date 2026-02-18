from __future__ import annotations

import json

import pytest

from crystalith.shared.ai.test_provider import TestChatProvider, TestEmbeddingProvider
from crystalith.shared.ai.types import ChatMessage


@pytest.mark.asyncio
async def test_test_embedding_provider_validates_inputs_and_is_deterministic() -> None:
    provider = TestEmbeddingProvider("test", vector=[0.5, 0.5])
    vectors = await provider.embed(["a", "b"])
    assert vectors == [[0.5, 0.5], [0.5, 0.5]]

    assert await provider.embed([]) == []

    with pytest.raises(ValueError, match="batch_size"):
        await provider.embed_batch(["a"], batch_size=0)

    with pytest.raises(ValueError, match="must not be empty"):
        TestEmbeddingProvider("test", vector=[])


@pytest.mark.asyncio
async def test_test_chat_provider_handles_common_prompt_patterns() -> None:
    provider = TestChatProvider("test")

    with pytest.raises(ValueError, match="messages"):
        await provider.chat([])

    json_text = await provider.chat(
        [ChatMessage(role="system", content="Return JSON with keys summary and next_step")]
    )
    payload = json.loads(json_text)
    assert payload["bullets"]

    bullets = await provider.chat([ChatMessage(role="system", content="Please return bullet points")])
    assert bullets.startswith("- ")

    plain = await provider.chat([ChatMessage(role="user", content="hello")])
    assert plain == "Test answer"


@pytest.mark.asyncio
async def test_test_chat_provider_stream_splits_into_chunks() -> None:
    provider = TestChatProvider("test")
    messages = [ChatMessage(role="user", content="hello")]

    chunks = [chunk async for chunk in provider.chat_stream(messages)]
    assert chunks
    assert "".join(chunks) == "Test answer"
