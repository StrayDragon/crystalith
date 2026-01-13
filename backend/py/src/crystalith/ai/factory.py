from __future__ import annotations

from dataclasses import dataclass

from crystalith.config import Settings

from .interfaces import ChatProvider, EmbeddingProvider
from .ollama_provider import OllamaChatProvider, OllamaEmbeddingProvider
from .openai_provider import OpenAIChatProvider, OpenAIEmbeddingProvider


@dataclass(frozen=True, slots=True)
class Providers:
    embedding: EmbeddingProvider
    chat: ChatProvider


def create_embedding_provider(settings: Settings) -> EmbeddingProvider:
    match settings.embedding.provider:
        case "openai":
            return OpenAIEmbeddingProvider(model=settings.embedding.model)
        case "ollama":
            return OllamaEmbeddingProvider(model=settings.embedding.model)
        case provider:
            raise ValueError(f"Unsupported embedding provider: {provider}")


def create_chat_provider(settings: Settings) -> ChatProvider:
    match settings.chat.provider:
        case "openai":
            return OpenAIChatProvider(model=settings.chat.model)
        case "ollama":
            return OllamaChatProvider(model=settings.chat.model)
        case provider:
            raise ValueError(f"Unsupported chat provider: {provider}")


def create_providers(settings: Settings) -> Providers:
    return Providers(
        embedding=create_embedding_provider(settings),
        chat=create_chat_provider(settings),
    )

