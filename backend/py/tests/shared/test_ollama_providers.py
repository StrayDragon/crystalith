from __future__ import annotations

from dataclasses import dataclass
from typing import Any, AsyncIterator

import pytest

from crystalith.shared.ai.cache import EmbeddingCache
from crystalith.shared.ai.ollama_provider import OllamaChatProvider, OllamaEmbeddingProvider
from crystalith.shared.ai.types import ChatMessage


@dataclass
class _EmbedResponse:
    embeddings: list[list[float]]


@dataclass
class _ChatMessagePayload:
    content: str


@dataclass
class _ChatResponse:
    message: _ChatMessagePayload


@dataclass
class _ChatChunk:
    message: _ChatMessagePayload | None


class _StubOllamaClient:
    def __init__(self) -> None:
        self.embed_calls: list[dict[str, Any]] = []
        self.chat_calls: list[dict[str, Any]] = []

    async def embed(self, **kwargs: Any) -> _EmbedResponse:
        self.embed_calls.append(kwargs)
        inputs = list(kwargs.get("input") or [])
        vectors: list[list[float]] = []
        for value in inputs:
            if value == "a":
                vectors.append([1.0, 0.0, 0.0])
            else:
                vectors.append([0.0, 1.0, 0.0])
        return _EmbedResponse(embeddings=vectors)

    async def chat(self, **kwargs: Any) -> Any:
        self.chat_calls.append(kwargs)
        if kwargs.get("stream"):
            async def gen() -> AsyncIterator[_ChatChunk]:
                yield _ChatChunk(message=_ChatMessagePayload(content="Hello "))
                yield _ChatChunk(message=_ChatMessagePayload(content="world"))
                yield _ChatChunk(message=None)
            return gen()
        return _ChatResponse(message=_ChatMessagePayload(content="OK"))


@pytest.mark.asyncio
async def test_ollama_embedding_provider_batches_and_caches() -> None:
    client = _StubOllamaClient()
    cache = EmbeddingCache(maxsize=100)
    provider = OllamaEmbeddingProvider(
        model="embed",
        client=client,
        timeout=None,
        max_retries=0,
        cache=cache,
    )

    vectors = await provider.embed_batch(["a", "a", "b"], batch_size=10)
    assert vectors == [
        [1.0, 0.0, 0.0],
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
    ]
    assert len(client.embed_calls) == 1

    vectors2 = await provider.embed_batch(["a"], batch_size=10)
    assert vectors2 == [[1.0, 0.0, 0.0]]
    assert len(client.embed_calls) == 1

    with pytest.raises(ValueError, match="batch_size must be greater than 0"):
        await provider.embed_batch(["a"], batch_size=0)


@pytest.mark.asyncio
async def test_ollama_chat_provider_chat_and_stream() -> None:
    client = _StubOllamaClient()
    provider = OllamaChatProvider(
        model="chat",
        client=client,
        timeout=None,
        max_retries=0,
    )

    with pytest.raises(ValueError, match="messages must not be empty"):
        await provider.chat([])

    text = await provider.chat([ChatMessage(role="user", content="hi")])
    assert text == "OK"

    chunks = []
    async for chunk in provider.chat_stream([ChatMessage(role="user", content="hi")]):
        chunks.append(chunk)
    assert "".join(chunks) == "Hello world"

    with pytest.raises(ValueError, match="messages must not be empty"):
        async for _ in provider.chat_stream([]):
            pass
