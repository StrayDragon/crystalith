from __future__ import annotations

from collections.abc import AsyncIterator, Sequence
from typing import Any


class EchoChatProvider:
    provider = "echo"

    def __init__(self, model: str) -> None:
        self.model = model

    async def chat(self, messages: Sequence[Any]) -> str:
        if not messages:
            raise ValueError("messages must not be empty")
        last = messages[-1]
        content = getattr(last, "content", None)
        if content is None and isinstance(last, dict):
            content = last.get("content")
        return f"echo:{content or ''}"

    async def chat_stream(self, messages: Sequence[Any]) -> AsyncIterator[str]:
        yield await self.chat(messages)


class EchoEmbeddingProvider:
    provider = "echo"

    def __init__(self, model: str) -> None:
        self.model = model

    async def embed(self, texts: Sequence[str]) -> list[list[float]]:
        return await self.embed_batch(texts, batch_size=len(texts) or 1)

    async def embed_batch(
        self,
        texts: Sequence[str],
        *,
        batch_size: int = 100,
    ) -> list[list[float]]:
        if not texts:
            return []
        return [[float(len(text))] for text in texts]


class EchoPlugin:
    api_version = "v1"

    def create_chat_provider(self, settings: Any, model_config: Any) -> EchoChatProvider:
        return EchoChatProvider(model=str(getattr(model_config, "model", "")))

    def create_embedding_provider(self, settings: Any, model_config: Any) -> EchoEmbeddingProvider:
        return EchoEmbeddingProvider(model=str(getattr(model_config, "model", "")))


plugin = EchoPlugin()
