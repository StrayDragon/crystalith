from __future__ import annotations

import json
from typing import Literal
from collections.abc import AsyncIterator, Sequence

from .types import ChatMessage


class TestEmbeddingProvider:
    """
    Deterministic embedding provider for tests and local development.

    This provider does not call any external services.
    """

    provider: Literal["test"] = "test"
    __test__ = False

    def __init__(
        self,
        model: str,
        *,
        vector: Sequence[float] | None = None,
    ) -> None:
        self.model = model
        self._vector = list(vector) if vector is not None else [1.0, 0.0, 0.0]
        if not self._vector:
            raise ValueError("vector must not be empty")

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
        return [list(self._vector) for _ in texts]


class TestChatProvider:
    """
    Deterministic chat provider for tests and local development.

    Produces stable outputs based on common prompt patterns used across the app.
    """

    provider: Literal["test"] = "test"
    __test__ = False

    def __init__(self, model: str) -> None:
        self.model = model

    async def chat(self, messages: Sequence[ChatMessage]) -> str:
        if not messages:
            raise ValueError("messages must not be empty")

        system = next((message.content for message in messages if message.role == "system"), "")
        normalized = system.lower()
        last_user = next((message.content for message in reversed(messages) if message.role == "user"), "")
        last_user_normalized = last_user.lower()

        if "return json with keys" in normalized:
            return json.dumps(
                {
                    "title": "Test title",
                    "bullets": ["Test bullet 1", "Test bullet 2"],
                    "terms": ["Test term"],
                },
                ensure_ascii=False,
            )

        if "fallback_markdown" in normalized and "chart" in normalized and "table" in normalized:
            if "invalid_json" in last_user_normalized:
                return "not-json"
            if "invalid_stats" in last_user_normalized:
                return json.dumps({"fallback_markdown": "Bad stats"}, ensure_ascii=False)
            return json.dumps(
                {
                    "fallback_markdown": "Test stats answer [1]",
                    "chart": {
                        "title": "Test chart",
                        "unit": "items",
                        "items": [{"label": "A", "value": 1}, {"label": "B", "value": 2}],
                    },
                    "table": {
                        "columns": ["Name", "Count"],
                        "rows": [["A", 1], ["B", 2]],
                    },
                },
                ensure_ascii=False,
            )

        if "bullet points" in normalized:
            return "- Test bullet 1\n- Test bullet 2\n- Test bullet 3"

        return "Test answer"

    async def chat_stream(self, messages: Sequence[ChatMessage]) -> AsyncIterator[str]:
        text = await self.chat(messages)
        if not text:
            return
        chunk_size = 8
        for idx in range(0, len(text), chunk_size):
            yield text[idx : idx + chunk_size]
