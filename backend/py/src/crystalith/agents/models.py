from __future__ import annotations

from typing import Literal

from openai import AsyncOpenAI
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.ollama import OllamaProvider
from pydantic_ai.providers.openai import OpenAIProvider

from cl_logs.logging import get_logger

from crystalith.config import OpenAIProviderSettings, Settings


log = get_logger(__name__)


class ModelConfigurationError(Exception):
    """Raised when model configuration is invalid or missing."""


def _resolve_openai_settings(settings: Settings) -> OpenAIProviderSettings:
    """Resolve OpenAI settings with fallback to global settings."""
    return settings.chat.openai or settings.openai


def _normalize_ollama_base_url(host: str) -> str:
    """Normalize Ollama host URL to include /v1 suffix."""
    trimmed = host.rstrip("/")
    if trimmed.endswith("/v1"):
        return trimmed
    return f"{trimmed}/v1"


def _validate_openai_settings(openai_settings: OpenAIProviderSettings) -> None:
    """Validate that required OpenAI settings are present."""
    if not openai_settings.api_key or not openai_settings.api_key.strip():
        raise ModelConfigurationError(
            "Missing OpenAI API key. Please configure 'openai.api_key' in config/app.yaml"
        )


def _validate_ollama_settings(host: str) -> None:
    """Validate that Ollama host is configured."""
    if not host or not host.strip():
        raise ModelConfigurationError(
            "Missing Ollama host. Please configure 'ollama.host' in config/app.yaml"
        )


def build_chat_model(
    settings: Settings,
    *,
    provider_override: Literal["openai", "ollama"] | None = None,
    model_override: str | None = None,
) -> OpenAIChatModel:
    """Build a chat model from settings with optional overrides.

    Args:
        settings: Application settings
        provider_override: Override the provider from settings
        model_override: Override the model name from settings

    Returns:
        Configured OpenAIChatModel instance

    Raises:
        ModelConfigurationError: If required configuration is missing
        ValueError: If provider is not supported
    """
    provider = provider_override or settings.chat.provider
    model_name = model_override or settings.chat.model

    log.debug(
        "building chat model",
        provider=provider,
        model=model_name,
        has_override=bool(provider_override or model_override),
    )

    if provider == "openai":
        openai_settings = _resolve_openai_settings(settings)
        _validate_openai_settings(openai_settings)
        # Create AsyncOpenAI client with all settings to support organization/project/base_url
        openai_client = AsyncOpenAI(
            api_key=openai_settings.api_key,
            base_url=openai_settings.base_url,
            organization=openai_settings.organization or None,
            project=openai_settings.project or None,
        )
        return OpenAIChatModel(
            model_name,
            provider=OpenAIProvider(openai_client=openai_client),
        )

    if provider == "ollama":
        _validate_ollama_settings(settings.ollama.host)
        base_url = _normalize_ollama_base_url(settings.ollama.host)
        return OpenAIChatModel(
            model_name,
            provider=OllamaProvider(base_url=base_url),
        )

    raise ValueError(f"Unsupported chat provider: {provider}")


def build_chat_model_from_model_id(
    settings: Settings,
    model_id: str,
) -> OpenAIChatModel:
    """Build a chat model from a specific model ID.

    Looks up the model configuration from settings.models.available and
    builds the appropriate model.

    Args:
        settings: Application settings
        model_id: The model ID to use (must exist in settings.models.available)

    Returns:
        Configured OpenAIChatModel instance

    Raises:
        ModelConfigurationError: If the model is not found or doesn't support chat
        ValueError: If provider is not supported
    """
    from crystalith.ai.factory import get_model_config_by_id

    model_config = get_model_config_by_id(settings, model_id)
    if model_config is None:
        raise ModelConfigurationError(f"Model not found: {model_id}")

    if "chat" not in model_config.capabilities:
        raise ModelConfigurationError(f"Model {model_id} does not support chat capability")

    log.debug(
        "building chat model from model_id",
        model_id=model_id,
        provider=model_config.provider,
        model=model_config.model,
    )

    return build_chat_model(
        settings,
        provider_override=model_config.provider,
        model_override=model_config.model,
    )
