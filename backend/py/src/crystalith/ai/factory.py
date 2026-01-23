from __future__ import annotations

from dataclasses import dataclass

import ollama
from openai import AsyncOpenAI

from crystalith.config import ModelConfig, OpenAIProviderSettings, OllamaProviderSettings, Settings

from .interfaces import ChatProvider, EmbeddingProvider
from .ollama_provider import OllamaChatProvider, OllamaEmbeddingProvider
from .openai_provider import OpenAIChatProvider, OpenAIEmbeddingProvider


@dataclass(frozen=True, slots=True)
class Providers:
    embedding: EmbeddingProvider
    chat: ChatProvider


def get_model_config_by_id(settings: Settings, model_id: str) -> ModelConfig | None:
    """Get a model configuration by its ID."""
    return settings.get_model_config(model_id)


def _create_openai_client(
    model_config: ModelConfig,
    *,
    reason: str,
) -> AsyncOpenAI:
    """
    Create an OpenAI client from model configuration.

    The model's provider_config must contain valid OpenAI settings.
    """
    config = model_config.get_openai_config()

    api_key = config.api_key
    if api_key is None or not api_key.strip():
        raise ValueError(
            f"Missing api_key in provider_config for model '{model_config.id}' "
            f"(required when {reason} provider is 'openai')."
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


def _create_ollama_client(model_config: ModelConfig) -> ollama.AsyncClient:
    """
    Create an Ollama client from model configuration.

    Uses the model's provider_config for host settings.
    """
    ollama_settings = model_config.get_ollama_config()
    return ollama.AsyncClient(host=ollama_settings.host)


def create_embedding_provider(settings: Settings) -> EmbeddingProvider:
    """
    Create the default embedding provider from settings.

    Uses models.defaults.embedding to determine which model to use.
    """
    model_config = settings.get_default_embedding_model()
    if model_config is None:
        raise ValueError(
            "No default embedding model configured. "
            "Set models.defaults.embedding or add a model with role 'embed'."
        )

    return create_embedding_provider_by_model_id(settings, model_config.id)


def create_chat_provider(settings: Settings) -> ChatProvider:
    """
    Create the default chat provider from settings.

    Uses models.defaults.chat to determine which model to use.
    """
    model_config = settings.get_default_chat_model()
    if model_config is None:
        raise ValueError(
            "No default chat model configured. "
            "Set models.defaults.chat or add a model with role 'chat'."
        )

    return create_chat_provider_by_model_id(settings, model_config.id)


def create_providers(settings: Settings) -> Providers:
    """Create both embedding and chat providers using default models."""
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

    # Check for chat role
    if not model_config.has_role("chat"):
        raise ValueError(f"Model {model_id} does not support chat role")

    match model_config.provider:
        case "openai":
            return OpenAIChatProvider(
                model=model_config.model,
                client=_create_openai_client(model_config, reason=f"model:{model_id}"),
            )
        case "ollama":
            return OllamaChatProvider(
                model=model_config.model,
                client=_create_ollama_client(model_config),
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

    # Check for embed role
    if not model_config.has_role("embed"):
        raise ValueError(f"Model {model_id} does not support embed role")

    match model_config.provider:
        case "openai":
            return OpenAIEmbeddingProvider(
                model=model_config.model,
                client=_create_openai_client(model_config, reason=f"embedding:{model_id}"),
            )
        case "ollama":
            # Use model's ollama_options if specified
            options = None
            if model_config.ollama_options:
                options = model_config.ollama_options.to_options()

            return OllamaEmbeddingProvider(
                model=model_config.model,
                client=_create_ollama_client(model_config),
                options=options,
            )
        case provider:
            raise ValueError(f"Unsupported provider for model {model_id}: {provider}")
