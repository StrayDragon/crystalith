from __future__ import annotations

from typing import AsyncIterator, Literal, Protocol, Sequence, cast

from openai import AsyncOpenAI
from openai.types.chat import ChatCompletionMessageParam

from .cache import EmbeddingCache
from .effective_settings import OpenAIChatCompletionKwargs
from .retry import default_retry_budget_s, run_with_retry
from .types import ChatMessage


class _OpenAIEmbeddingItem(Protocol):
    @property
    def index(self) -> int:
        ...

    @property
    def embedding(self) -> Sequence[float]:
        ...


class _OpenAIEmbeddingResponse(Protocol):
    @property
    def data(self) -> Sequence[_OpenAIEmbeddingItem]:
        ...


class _OpenAIChatCompletionMessage(Protocol):
    @property
    def content(self) -> str | None:
        ...


class _OpenAIChatCompletionChoice(Protocol):
    @property
    def message(self) -> _OpenAIChatCompletionMessage:
        ...


class _OpenAIChatCompletionResponse(Protocol):
    @property
    def choices(self) -> Sequence[_OpenAIChatCompletionChoice]:
        ...


class _OpenAIChatDelta(Protocol):
    @property
    def content(self) -> str | None:
        ...


class _OpenAIChatStreamChoice(Protocol):
    @property
    def delta(self) -> _OpenAIChatDelta:
        ...


class _OpenAIChatStreamChunk(Protocol):
    @property
    def choices(self) -> Sequence[_OpenAIChatStreamChoice]:
        ...


def _to_openai_messages(messages: Sequence[ChatMessage]) -> list[ChatCompletionMessageParam]:
    payload: list[ChatCompletionMessageParam] = []
    for message in messages:
        payload.append(
            cast(
                ChatCompletionMessageParam,
                {"role": message.role, "content": message.content},
            )
        )
    return payload


class OpenAIEmbeddingProvider:
    provider: Literal["openai"] = "openai"

    def __init__(
        self,
        model: str,
        *,
        client: AsyncOpenAI | None = None,
        api_key: str | None = None,
        base_url: str | None = None,
        organization: str | None = None,
        project: str | None = None,
        timeout: float | None = 60,
        max_retries: int = 3,
        cache: EmbeddingCache | None = None,
    ) -> None:
        self.model = model
        self._client = client or AsyncOpenAI(
            api_key=api_key,
            base_url=base_url,
            organization=organization,
            project=project,
            timeout=timeout,
            # We run our own retry policy in providers.run_with_retry; disable SDK retries
            # to avoid nested backoff and inflated tail latencies.
            max_retries=0,
            webhook_secret="",
        )
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
            for text, vector in zip(chunk_texts, chunk_embeddings):
                for idx in pending_positions_by_text.get(text, []):
                    embeddings[idx] = vector
                if self._cache is not None:
                    self._cache.set(model=self.model, text=text, vector=vector)

        if any(vector is None or len(vector) == 0 for vector in embeddings):
            return []
        return [list(vector) for vector in embeddings if vector is not None]

    async def _embed_chunk(self, texts: Sequence[str]) -> list[list[float]]:
        async def _do_embed() -> _OpenAIEmbeddingResponse:
            return await self._client.embeddings.create(
                model=self.model,
                input=list(texts),
            )

        response = await run_with_retry(
            _do_embed,
            timeout=self._timeout,
            total_timeout=self._total_timeout,
            max_retries=self._max_retries,
        )

        data = list(response.data)
        try:
            data.sort(key=lambda item: item.index)
        except Exception:  # noqa: BLE001 - tolerate unexpected SDK object shapes
            pass
        return [list(item.embedding) for item in data]


class OpenAIChatProvider:
    provider: Literal["openai"] = "openai"

    def __init__(
        self,
        model: str,
        *,
        client: AsyncOpenAI | None = None,
        api_key: str | None = None,
        base_url: str | None = None,
        organization: str | None = None,
        project: str | None = None,
        timeout: float | None = 60,
        max_retries: int = 3,
        completion_kwargs: OpenAIChatCompletionKwargs | None = None,
    ) -> None:
        self.model = model
        self._client = client or AsyncOpenAI(
            api_key=api_key,
            base_url=base_url,
            organization=organization,
            project=project,
            timeout=timeout,
            # We run our own retry policy in providers.run_with_retry; disable SDK retries
            # to avoid nested backoff and inflated tail latencies.
            max_retries=0,
            webhook_secret="",
        )
        self._timeout = timeout
        self._total_timeout = default_retry_budget_s(timeout=timeout, max_retries=max_retries)
        self._max_retries = max_retries
        self._completion_kwargs: OpenAIChatCompletionKwargs = (
            cast(OpenAIChatCompletionKwargs, dict(completion_kwargs)) if completion_kwargs else {}
        )

    async def chat(self, messages: Sequence[ChatMessage]) -> str:
        if not messages:
            raise ValueError("messages must not be empty")

        async def _do_chat() -> _OpenAIChatCompletionResponse:
            return await self._client.chat.completions.create(
                model=self.model,
                messages=_to_openai_messages(messages),
                **self._completion_kwargs,
            )

        response = await run_with_retry(
            _do_chat,
            timeout=self._timeout,
            total_timeout=self._total_timeout,
            max_retries=self._max_retries,
        )

        content = response.choices[0].message.content
        return content or ""

    async def chat_stream(self, messages: Sequence[ChatMessage]) -> AsyncIterator[str]:
        if not messages:
            raise ValueError("messages must not be empty")

        async def _create_stream() -> AsyncIterator[_OpenAIChatStreamChunk]:
            return await self._client.chat.completions.create(
                model=self.model,
                messages=_to_openai_messages(messages),
                stream=True,
                **self._completion_kwargs,
            )

        response = await run_with_retry(
            _create_stream,
            timeout=self._timeout,
            total_timeout=self._total_timeout,
            max_retries=self._max_retries,
        )
        async for chunk in response:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
