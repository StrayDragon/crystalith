from __future__ import annotations

from typing import Literal

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
        return OpenAIChatModel(
            model_name,
            provider=OpenAIProvider(
                api_key=openai_settings.api_key,
                base_url=openai_settings.base_url,
                organization=openai_settings.organization,
                project=openai_settings.project,
            ),
        )

    if provider == "ollama":
        _validate_ollama_settings(settings.ollama.host)
        base_url = _normalize_ollama_base_url(settings.ollama.host)
        return OpenAIChatModel(
            model_name,
            provider=OllamaProvider(base_url=base_url),
        )

    raise ValueError(f"Unsupported chat provider: {provider}")
