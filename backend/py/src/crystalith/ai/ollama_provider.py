from __future__ import annotations

from typing import Any, Literal, Sequence

import ollama

from .types import ChatMessage


class OllamaEmbeddingProvider:
    provider: Literal["ollama"] = "ollama"

    def __init__(
        self,
        model: str,
        *,
        client: Any | None = None,
        host: str | None = None,
    ) -> None:
        self.model = model
        self._client = client or ollama.AsyncClient(host=host)

    async def embed(self, texts: Sequence[str]) -> list[list[float]]:
        if not texts:
            return []

        response = await self._client.embed(
            model=self.model,
            input=list(texts),
        )
        return [list(vector) for vector in response.embeddings]


class OllamaChatProvider:
    provider: Literal["ollama"] = "ollama"

    def __init__(
        self,
        model: str,
        *,
        client: Any | None = None,
        host: str | None = None,
    ) -> None:
        self.model = model
        self._client = client or ollama.AsyncClient(host=host)

    async def chat(self, messages: Sequence[ChatMessage]) -> str:
        if not messages:
            raise ValueError("messages must not be empty")

        response = await self._client.chat(
            model=self.model,
            messages=[{"role": m.role, "content": m.content} for m in messages],
        )

        content = response.message.content
        return content or ""
