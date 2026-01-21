from __future__ import annotations

from typing import Any, AsyncIterator, Literal, Sequence

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
        options: dict[str, Any] | None = None,
    ) -> None:
        self.model = model
        self._client = client or ollama.AsyncClient(host=host)
        self._options = options

    async def embed(self, texts: Sequence[str]) -> list[list[float]]:
        if not texts:
            return []

        kwargs: dict[str, Any] = {"model": self.model, "input": list(texts)}
        if self._options is not None:
            kwargs["options"] = self._options

        response = await self._client.embed(**kwargs)
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

    async def chat_stream(self, messages: Sequence[ChatMessage]) -> AsyncIterator[str]:
        """Stream chat completion, yielding text chunks as they arrive."""
        if not messages:
            raise ValueError("messages must not be empty")

        response = await self._client.chat(
            model=self.model,
            messages=[{"role": m.role, "content": m.content} for m in messages],
            stream=True,
        )
        async for chunk in response:
            if chunk.message and chunk.message.content:
                yield chunk.message.content
