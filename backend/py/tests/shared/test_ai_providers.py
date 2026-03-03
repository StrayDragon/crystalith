from __future__ import annotations

import asyncio

import pytest

from crystalith.shared.ai.cache import EmbeddingCache
from crystalith.shared.ai.openai_provider import OpenAIChatProvider, OpenAIEmbeddingProvider
from crystalith.shared.ai.retry import run_with_retry, with_retry
from crystalith.shared.ai.types import ChatMessage


class _EmbeddingResponse:
    def __init__(self, vectors):  # noqa: ANN001
        self.data = [type("Row", (), {"index": idx, "embedding": vector}) for idx, vector in enumerate(vectors)]


class _EmbeddingsClient:
    def __init__(self) -> None:
        self.calls = []

    async def create(self, *, model, input):  # noqa: ANN001
        self.calls.append((model, tuple(input)))
        vectors = [[float(i), float(i + 1)] for i, _ in enumerate(input)]
        return _EmbeddingResponse(vectors)


class _OpenAIClient:
    def __init__(self) -> None:
        self.embeddings = _EmbeddingsClient()


class _RateLimitError(Exception):
    status_code = 429

    def __init__(self, retry_after: str = "2") -> None:
        self.response = type(
            "Response",
            (),
            {"status_code": 429, "headers": {"retry-after": retry_after}},
        )()
        super().__init__("rate limit")


@pytest.mark.asyncio
async def test_openai_embed_batch_uses_batch_and_cache() -> None:
    client = _OpenAIClient()
    cache = EmbeddingCache(maxsize=10)
    provider = OpenAIEmbeddingProvider(
        model="test-model",
        client=client,
        timeout=10,
        max_retries=0,
        cache=cache,
    )

    texts = ["a", "b", "a"]
    vectors1 = await provider.embed_batch(texts, batch_size=2)
    vectors2 = await provider.embed_batch(texts, batch_size=2)

    assert len(vectors1) == 3
    assert vectors2 == vectors1
    assert len(client.embeddings.calls) == 1


@pytest.mark.asyncio
async def test_run_with_retry_retries_timeout_then_success() -> None:
    attempts = {"count": 0}

    async def _op() -> str:
        attempts["count"] += 1
        if attempts["count"] < 3:
            raise TimeoutError("timeout")
        return "ok"

    result = await run_with_retry(
        _op,
        timeout=1,
        max_retries=3,
        initial_delay=0,
        max_delay=0,
    )

    assert result == "ok"
    assert attempts["count"] == 3


@pytest.mark.asyncio
async def test_run_with_retry_honors_retry_after_header(monkeypatch: pytest.MonkeyPatch) -> None:
    attempts = {"count": 0}
    delays: list[float] = []

    async def _fake_sleep(delay: float) -> None:
        delays.append(delay)

    # Mock reason: avoid real delay while asserting retry-after handling.
    monkeypatch.setattr(asyncio, "sleep", _fake_sleep)

    async def _op() -> str:
        attempts["count"] += 1
        if attempts["count"] == 1:
            raise _RateLimitError("3")
        return "ok"

    result = await run_with_retry(
        _op,
        timeout=1,
        max_retries=2,
        initial_delay=0,
        max_delay=0,
    )

    assert result == "ok"
    assert attempts["count"] == 2
    assert delays == [3.0]


@pytest.mark.asyncio
async def test_with_retry_decorator_supports_async_method() -> None:
    class _Worker:
        def __init__(self) -> None:
            self.calls = 0

        @with_retry(timeout=1, max_retries=2, initial_delay=0, max_delay=0)
        async def run(self) -> str:
            self.calls += 1
            if self.calls < 3:
                raise TimeoutError("timeout")
            return "done"

    worker = _Worker()
    result = await worker.run()

    assert result == "done"
    assert worker.calls == 3


class _ChatResponse:
    def __init__(self, content: str) -> None:
        self.choices = [
            type(
                "Choice",
                (),
                {"message": type("Message", (), {"content": content})()},
            )
        ]


class _ChatCompletionsClient:
    def __init__(self) -> None:
        self.calls = 0

    async def create(self, *, model, messages, stream: bool | None = None, **_kwargs):  # noqa: ANN001
        self.calls += 1
        assert stream in {None, False}
        if self.calls == 1:
            raise TimeoutError("timeout")
        return _ChatResponse("chat-ok")

class _ChatClient:
    def __init__(self) -> None:
        self.completions = _ChatCompletionsClient()


class _OpenAIChatClient:
    def __init__(self) -> None:
        self.chat = _ChatClient()


@pytest.mark.asyncio
async def test_openai_chat_provider_retries_timeout_and_returns_success() -> None:
    client = _OpenAIChatClient()
    provider = OpenAIChatProvider(
        model="chat-model",
        client=client,
        timeout=1,
        max_retries=2,
    )

    result = await provider.chat([ChatMessage(role="user", content="hello")])

    assert result == "chat-ok"
    assert client.chat.completions.calls == 2
