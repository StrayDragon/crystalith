from __future__ import annotations

from dataclasses import dataclass

import ollama
from openai import AsyncOpenAI

from crystalith.config import Settings

from .interfaces import ChatProvider, EmbeddingProvider
from .ollama_provider import OllamaChatProvider, OllamaEmbeddingProvider
from .openai_provider import OpenAIChatProvider, OpenAIEmbeddingProvider


@dataclass(frozen=True, slots=True)
class Providers:
    embedding: EmbeddingProvider
    chat: ChatProvider


def _create_openai_client(settings: Settings, *, reason: str) -> AsyncOpenAI:
    api_key = settings.openai.api_key
    if api_key is None or not api_key.strip():
        raise ValueError(
            f"Missing YAML config `openai.api_key` (required when {reason} provider is 'openai')."
        )

    base_url = settings.openai.base_url or "https://api.openai.com/v1"
    organization = settings.openai.organization or ""
    project = settings.openai.project or ""

    return AsyncOpenAI(
        api_key=api_key,
        base_url=base_url,
        organization=organization,
        project=project,
        webhook_secret="",
    )


def _create_ollama_client(settings: Settings) -> ollama.AsyncClient:
    return ollama.AsyncClient(host=settings.ollama.host)


def create_embedding_provider(settings: Settings) -> EmbeddingProvider:
    match settings.embedding.provider:
        case "openai":
            return OpenAIEmbeddingProvider(
                model=settings.embedding.model,
                client=_create_openai_client(settings, reason="embedding"),
            )
        case "ollama":
            return OllamaEmbeddingProvider(
                model=settings.embedding.model,
                client=_create_ollama_client(settings),
            )
        case provider:
            raise ValueError(f"Unsupported embedding provider: {provider}")


def create_chat_provider(settings: Settings) -> ChatProvider:
    match settings.chat.provider:
        case "openai":
            return OpenAIChatProvider(
                model=settings.chat.model,
                client=_create_openai_client(settings, reason="chat"),
            )
        case "ollama":
            return OllamaChatProvider(
                model=settings.chat.model,
                client=_create_ollama_client(settings),
            )
        case provider:
            raise ValueError(f"Unsupported chat provider: {provider}")


def create_providers(settings: Settings) -> Providers:
    return Providers(
        embedding=create_embedding_provider(settings),
        chat=create_chat_provider(settings),
    )
