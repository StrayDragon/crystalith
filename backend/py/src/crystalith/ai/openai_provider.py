from __future__ import annotations

from typing import Any, Literal, Sequence

from openai import AsyncOpenAI

from cl_logs.logging import get_logger

from .types import ChatMessage


log = get_logger(__name__)


class OpenAIEmbeddingProvider:
    provider: Literal["openai"] = "openai"

    def __init__(
        self,
        model: str,
        *,
        client: Any | None = None,
        api_key: str | None = None,
        base_url: str | None = None,
        organization: str | None = None,
        project: str | None = None,
    ) -> None:
        self.model = model
        self._client = client or AsyncOpenAI(
            api_key=api_key,
            base_url=base_url,
            organization=organization,
            project=project,
        )

    async def embed(self, texts: Sequence[str]) -> list[list[float]]:
        if not texts:
            return []

        try:
            response = await self._client.embeddings.create(
                model=self.model,
                input=list(texts),
            )
        except Exception as error:  # noqa: BLE001 - degrade to empty embeddings
            log.warning("openai embeddings failed", exc_info=error)
            return []

        data = list(response.data)
        if data and hasattr(data[0], "index"):
            data.sort(key=lambda item: item.index)
        return [list(item.embedding) for item in data]


class OpenAIChatProvider:
    provider: Literal["openai"] = "openai"

    def __init__(
        self,
        model: str,
        *,
        client: Any | None = None,
        api_key: str | None = None,
        base_url: str | None = None,
        organization: str | None = None,
        project: str | None = None,
    ) -> None:
        self.model = model
        self._client = client or AsyncOpenAI(
            api_key=api_key,
            base_url=base_url,
            organization=organization,
            project=project,
        )

    async def chat(self, messages: Sequence[ChatMessage]) -> str:
        if not messages:
            raise ValueError("messages must not be empty")

        try:
            response = await self._client.chat.completions.create(
                model=self.model,
                messages=[{"role": m.role, "content": m.content} for m in messages],
            )
        except Exception as error:  # noqa: BLE001 - degrade to empty response
            log.warning("openai chat failed", exc_info=error)
            return ""

        content = response.choices[0].message.content
        return content or ""
