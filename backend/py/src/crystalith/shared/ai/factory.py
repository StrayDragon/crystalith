from __future__ import annotations

from dataclasses import dataclass

import ollama
from openai import AsyncOpenAI

from crystalith.shared.config import ModelConfig, OpenAIProviderSettings, OllamaProviderSettings, Settings
from crystalith.shared.plugins import PluginRegistry

from .cache import EmbeddingCache
from .interfaces import ChatProvider, EmbeddingProvider
from .ollama_provider import OllamaChatProvider, OllamaEmbeddingProvider
from .openai_provider import OpenAIChatProvider, OpenAIEmbeddingProvider
from .test_provider import TestChatProvider, TestEmbeddingProvider


@dataclass(frozen=True, slots=True)
class Providers:
    embedding: EmbeddingProvider
    chat: ChatProvider


_EMBEDDING_CACHE = EmbeddingCache(maxsize=10_000)


def _resolve_ai_timeout(settings: Settings) -> float:
    return float(settings.ai.timeout)


def _resolve_ai_retries(settings: Settings) -> int:
    return int(settings.ai.max_retries)


def get_model_config_by_id(settings: Settings, model_id: str) -> ModelConfig | None:
    """Get a model configuration by its ID."""
    return settings.get_model_config(model_id)


def _create_openai_client(
    settings: Settings,
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
        timeout=_resolve_ai_timeout(settings),
        # We run our own retry policy in providers.run_with_retry; disable SDK retries
        # to avoid nested backoff and inflated tail latencies.
        max_retries=0,
        webhook_secret="",
    )


def _create_ollama_client(model_config: ModelConfig) -> ollama.AsyncClient:
    """
    Create an Ollama client from model configuration.

    Uses the model's provider_config for host settings.
    """
    ollama_settings = model_config.get_ollama_config()
    return ollama.AsyncClient(host=ollama_settings.host)


def create_embedding_provider(settings: Settings, *, plugins: PluginRegistry | None = None) -> EmbeddingProvider:
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

    return create_embedding_provider_by_model_id(settings, model_config.id, plugins=plugins)


def create_chat_provider(settings: Settings, *, plugins: PluginRegistry | None = None) -> ChatProvider:
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

    return create_chat_provider_by_model_id(settings, model_config.id, plugins=plugins)


def create_providers(settings: Settings, *, plugins: PluginRegistry | None = None) -> Providers:
    """Create both embedding and chat providers using default models."""
    return Providers(
        embedding=create_embedding_provider(settings, plugins=plugins),
        chat=create_chat_provider(settings, plugins=plugins),
    )


def create_chat_provider_by_model_id(
    settings: Settings,
    model_id: str,
    *,
    plugins: PluginRegistry | None = None,
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
                client=_create_openai_client(settings, model_config, reason=f"model:{model_id}"),
                timeout=_resolve_ai_timeout(settings),
                max_retries=_resolve_ai_retries(settings),
            )
        case "ollama":
            return OllamaChatProvider(
                model=model_config.model,
                client=_create_ollama_client(model_config),
                timeout=_resolve_ai_timeout(settings),
                max_retries=_resolve_ai_retries(settings),
            )
        case "test":
            return TestChatProvider(model=model_config.model)
        case provider:
            if plugins is None:
                raise ValueError(f"Unsupported provider for model {model_id}: {provider}")

            plugin = plugins.ai_providers.get(provider)
            if plugin is None:
                raise ValueError(f"Unsupported provider for model {model_id}: {provider}")

            return plugin.create_chat_provider(settings, model_config)


def create_embedding_provider_by_model_id(
    settings: Settings,
    model_id: str,
    *,
    plugins: PluginRegistry | None = None,
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
                client=_create_openai_client(settings, model_config, reason=f"embedding:{model_id}"),
                timeout=_resolve_ai_timeout(settings),
                max_retries=_resolve_ai_retries(settings),
                cache=_EMBEDDING_CACHE,
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
                timeout=_resolve_ai_timeout(settings),
                max_retries=_resolve_ai_retries(settings),
                cache=_EMBEDDING_CACHE,
            )
        case "test":
            return TestEmbeddingProvider(model=model_config.model)
        case provider:
            if plugins is None:
                raise ValueError(f"Unsupported provider for model {model_id}: {provider}")

            plugin = plugins.ai_providers.get(provider)
            if plugin is None:
                raise ValueError(f"Unsupported provider for model {model_id}: {provider}")

            return plugin.create_embedding_provider(settings, model_config)
