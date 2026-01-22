from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import ollama
from openai import AsyncOpenAI

from crystalith.config import ModelConfig, OpenAIProviderSettings, Settings

from .interfaces import ChatProvider, EmbeddingProvider
from .ollama_provider import OllamaChatProvider, OllamaEmbeddingProvider
from .openai_provider import OpenAIChatProvider, OpenAIEmbeddingProvider


@dataclass(frozen=True, slots=True)
class Providers:
    embedding: EmbeddingProvider
    chat: ChatProvider


def get_model_config_by_id(settings: Settings, model_id: str) -> ModelConfig | None:
    """Get a model configuration by its ID."""
    for model in settings.models.available:
        if model.id == model_id:
            return model
    return None


def _create_openai_client(
    settings: Settings,
    *,
    reason: str,
    override: OpenAIProviderSettings | None = None,
) -> AsyncOpenAI:
    config = override or settings.openai
    api_key = config.api_key
    if api_key is None or not api_key.strip():
        raise ValueError(
            f"Missing YAML config `openai.api_key` (required when {reason} provider is 'openai')."
        )

    base_url = config.base_url or "https://api.openai.com/v1"
    organization = config.organization or ""
    project = config.project or ""

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
                client=_create_openai_client(
                    settings,
                    reason="embedding",
                    override=settings.embedding.openai,
                ),
            )
        case "ollama":
            return OllamaEmbeddingProvider(
                model=settings.embedding.model,
                client=_create_ollama_client(settings),
                options=settings.embedding.ollama_options.to_options(),
            )
        case provider:
            raise ValueError(f"Unsupported embedding provider: {provider}")


def create_chat_provider(settings: Settings) -> ChatProvider:
    match settings.chat.provider:
        case "openai":
            return OpenAIChatProvider(
                model=settings.chat.model,
                client=_create_openai_client(
                    settings,
                    reason="chat",
                    override=settings.chat.openai,
                ),
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


def create_chat_provider_by_model_id(
    settings: Settings,
    model_id: str,
) -> ChatProvider:
    """
    Create a chat provider for a specific model ID.

    Looks up the model in settings.models.available and creates
    the appropriate provider based on the model's configuration.
    """
    model_config = get_model_config_by_id(settings, model_id)
    if model_config is None:
        raise ValueError(f"Model not found: {model_id}")

    if "chat" not in model_config.capabilities:
        raise ValueError(f"Model {model_id} does not support chat capability")

    match model_config.provider:
        case "openai":
            return OpenAIChatProvider(
                model=model_config.model,
                client=_create_openai_client(
                    settings,
                    reason=f"model:{model_id}",
                ),
            )
        case "ollama":
            return OllamaChatProvider(
                model=model_config.model,
                client=_create_ollama_client(settings),
            )
        case provider:
            raise ValueError(f"Unsupported provider for model {model_id}: {provider}")


def create_embedding_provider_by_model_id(
    settings: Settings,
    model_id: str,
) -> EmbeddingProvider:
    """
    Create an embedding provider for a specific model ID.

    Looks up the model in settings.models.available and creates
    the appropriate provider based on the model's configuration.
    """
    model_config = get_model_config_by_id(settings, model_id)
    if model_config is None:
        raise ValueError(f"Model not found: {model_id}")

    if "embedding" not in model_config.capabilities:
        raise ValueError(f"Model {model_id} does not support embedding capability")

    match model_config.provider:
        case "openai":
            return OpenAIEmbeddingProvider(
                model=model_config.model,
                client=_create_openai_client(
                    settings,
                    reason=f"embedding:{model_id}",
                ),
            )
        case "ollama":
            return OllamaEmbeddingProvider(
                model=model_config.model,
                client=_create_ollama_client(settings),
                options=None,  # Use defaults for dynamic model
            )
        case provider:
            raise ValueError(f"Unsupported provider for model {model_id}: {provider}")
