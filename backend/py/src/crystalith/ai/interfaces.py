from __future__ import annotations

from typing import Protocol, Sequence

from .types import ChatMessage, ProviderType


class Provider(Protocol):
    provider: ProviderType
    model: str


class EmbeddingProvider(Provider, Protocol):
    async def embed(self, texts: Sequence[str]) -> list[list[float]]: ...


class ChatProvider(Provider, Protocol):
    async def chat(self, messages: Sequence[ChatMessage]) -> str: ...

