from __future__ import annotations

from typing import AsyncIterator, Protocol, Sequence

from .types import ChatMessage, ProviderType


class Provider(Protocol):
    @property
    def provider(self) -> ProviderType:
        ...

    @property
    def model(self) -> str:
        ...


class EmbeddingProvider(Provider, Protocol):
    async def embed(self, texts: Sequence[str]) -> list[list[float]]: ...

    async def embed_batch(
        self,
        texts: Sequence[str],
        *,
        batch_size: int = 100,
    ) -> list[list[float]]: ...


class ChatProvider(Provider, Protocol):
    async def chat(self, messages: Sequence[ChatMessage]) -> str: ...

    def chat_stream(self, messages: Sequence[ChatMessage]) -> AsyncIterator[str]:
        """Stream chat completion, yielding text chunks as they arrive."""
        ...
