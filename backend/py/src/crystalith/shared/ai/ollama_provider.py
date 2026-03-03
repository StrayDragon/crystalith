from __future__ import annotations

from collections.abc import Mapping
from typing import Literal, Protocol, cast, overload
from collections.abc import AsyncIterator, Sequence

import ollama

from .cache import EmbeddingCache
from crystalith.shared.json_types import JsonValue
from .retry import default_retry_budget_s, run_with_retry
from .types import ChatMessage


class _OllamaEmbedResponse(Protocol):
    @property
    def embeddings(self) -> Sequence[Sequence[float]]:
        ...


class _OllamaChatMessage(Protocol):
    @property
    def content(self) -> str | None:
        ...


class _OllamaChatResponse(Protocol):
    @property
    def message(self) -> _OllamaChatMessage:
        ...


class _OllamaChatChunk(Protocol):
    @property
    def message(self) -> _OllamaChatMessage | None:
        ...


class OllamaEmbedClient(Protocol):
    async def embed(
        self,
        *,
        model: str,
        input: str | Sequence[str],
        options: Mapping[str, JsonValue] | None = None,
    ) -> object: ...


class OllamaChatClient(Protocol):
    @overload
    async def chat(
        self,
        *,
        model: str,
        messages: Sequence[Mapping[str, object]] | None = None,
        stream: Literal[False] = False,
        options: Mapping[str, JsonValue] | None = None,
    ) -> object: ...

    @overload
    async def chat(
        self,
        *,
        model: str,
        messages: Sequence[Mapping[str, object]] | None = None,
        stream: Literal[True] = True,
        options: Mapping[str, JsonValue] | None = None,
    ) -> object: ...


class OllamaEmbeddingProvider:
    provider: Literal["ollama"] = "ollama"

    def __init__(
        self,
        model: str,
        *,
        client: OllamaEmbedClient | None = None,
        host: str | None = None,
        options: dict[str, JsonValue] | None = None,
        timeout: float | None = 60,
        max_retries: int = 3,
        cache: EmbeddingCache | None = None,
    ) -> None:
        self.model = model
        self._client = client or ollama.AsyncClient(host=host)
        self._options = options
        self._timeout = timeout
        self._total_timeout = default_retry_budget_s(timeout=timeout, max_retries=max_retries)
        self._max_retries = max_retries
        self._cache = cache

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

        if batch_size <= 0:
            raise ValueError("batch_size must be greater than 0")

        embeddings: list[list[float] | None] = [None] * len(texts)
        pending_positions_by_text: dict[str, list[int]] = {}

        for index, text in enumerate(texts):
            if self._cache is None:
                pending_positions_by_text.setdefault(text, []).append(index)
                continue
            cached = self._cache.get(model=self.model, text=text)
            if cached is None:
                pending_positions_by_text.setdefault(text, []).append(index)
                continue
            embeddings[index] = cached

        pending_texts = list(pending_positions_by_text.keys())
        for start in range(0, len(pending_texts), batch_size):
            end = start + batch_size
            chunk_texts = pending_texts[start:end]
            chunk_embeddings = await self._embed_chunk(chunk_texts)
            for text, vector in zip(chunk_texts, chunk_embeddings, strict=True):
                for idx in pending_positions_by_text.get(text, []):
                    embeddings[idx] = vector
                if self._cache is not None:
                    self._cache.set(model=self.model, text=text, vector=vector)

        if any(vector is None or len(vector) == 0 for vector in embeddings):
            return []
        return [list(vector) for vector in embeddings if vector is not None]

    async def _embed_chunk(self, texts: Sequence[str]) -> list[list[float]]:
        async def _do_embed() -> _OllamaEmbedResponse:
            if self._options is None:
                response = await self._client.embed(
                    model=self.model,
                    input=list(texts),
                )
                return cast(_OllamaEmbedResponse, response)
            response = await self._client.embed(
                model=self.model,
                input=list(texts),
                options=self._options,
            )
            return cast(_OllamaEmbedResponse, response)

        response = await run_with_retry(
            _do_embed,
            timeout=self._timeout,
            total_timeout=self._total_timeout,
            max_retries=self._max_retries,
        )

        return [list(vector) for vector in response.embeddings]


class OllamaChatProvider:
    provider: Literal["ollama"] = "ollama"

    def __init__(
        self,
        model: str,
        *,
        client: OllamaChatClient | None = None,
        host: str | None = None,
        options: dict[str, JsonValue] | None = None,
        timeout: float | None = 60,
        max_retries: int = 3,
    ) -> None:
        self.model = model
        self._client = client or ollama.AsyncClient(host=host)
        self._options = options
        self._timeout = timeout
        self._total_timeout = default_retry_budget_s(timeout=timeout, max_retries=max_retries)
        self._max_retries = max_retries

    async def chat(self, messages: Sequence[ChatMessage]) -> str:
        if not messages:
            raise ValueError("messages must not be empty")

        payload: list[dict[str, str]] = [{"role": m.role, "content": m.content} for m in messages]

        async def _do_chat() -> _OllamaChatResponse:
            if self._options is None:
                response = await self._client.chat(
                    model=self.model,
                    messages=payload,
                )
                return cast(_OllamaChatResponse, response)
            response = await self._client.chat(
                model=self.model,
                messages=payload,
                options=self._options,
            )
            return cast(_OllamaChatResponse, response)

        response = await run_with_retry(
            _do_chat,
            timeout=self._timeout,
            total_timeout=self._total_timeout,
            max_retries=self._max_retries,
        )

        content = response.message.content
        return content or ""

    async def chat_stream(self, messages: Sequence[ChatMessage]) -> AsyncIterator[str]:
        """Stream chat completion, yielding text chunks as they arrive."""
        if not messages:
            raise ValueError("messages must not be empty")

        payload: list[dict[str, str]] = [{"role": m.role, "content": m.content} for m in messages]

        async def _do_chat_stream() -> AsyncIterator[_OllamaChatChunk]:
            if self._options is None:
                response = await self._client.chat(
                    model=self.model,
                    messages=payload,
                    stream=True,
                )
                return cast(AsyncIterator[_OllamaChatChunk], response)
            response = await self._client.chat(
                model=self.model,
                messages=payload,
                stream=True,
                options=self._options,
            )
            return cast(AsyncIterator[_OllamaChatChunk], response)

        response = await run_with_retry(
            _do_chat_stream,
            timeout=self._timeout,
            total_timeout=self._total_timeout,
            max_retries=self._max_retries,
        )
        async for chunk in response:
            if chunk.message and chunk.message.content:
                yield chunk.message.content
