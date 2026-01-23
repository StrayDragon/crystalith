from __future__ import annotations

from openai import AsyncOpenAI
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.ollama import OllamaProvider
from pydantic_ai.providers.openai import OpenAIProvider

from cl_logs.logging import get_logger

from crystalith.config import ModelConfig, OpenAIProviderSettings, Settings


log = get_logger(__name__)


class ModelConfigurationError(Exception):
    """Raised when model configuration is invalid or missing."""


def _normalize_ollama_base_url(host: str) -> str:
    """Normalize Ollama host URL to include /v1 suffix."""
    trimmed = host.rstrip("/")
    if trimmed.endswith("/v1"):
        return trimmed
    return f"{trimmed}/v1"


def _validate_openai_settings(openai_settings: OpenAIProviderSettings, model_id: str) -> None:
    """Validate that required OpenAI settings are present."""
    if not openai_settings.api_key or not openai_settings.api_key.strip():
        raise ModelConfigurationError(
            f"Missing api_key in provider_config for model '{model_id}'"
        )


def _validate_ollama_host(host: str, model_id: str) -> None:
    """Validate that Ollama host is configured."""
    if not host or not host.strip():
        raise ModelConfigurationError(
            f"Missing host in provider_config for model '{model_id}'"
        )


def build_chat_model(settings: Settings) -> OpenAIChatModel:
    """Build the default chat model from settings.

    Uses models.defaults.chat to determine which model to use.

    Args:
        settings: Application settings

    Returns:
        Configured OpenAIChatModel instance

    Raises:
        ModelConfigurationError: If no default chat model is configured
    """
    model_config = settings.get_default_chat_model()
    if model_config is None:
        raise ModelConfigurationError(
            "No default chat model configured. "
            "Set models.defaults.chat or add a model with role 'chat'."
        )

    return build_chat_model_from_model_id(settings, model_config.id)


def build_chat_model_from_model_id(
    settings: Settings,
    model_id: str,
) -> OpenAIChatModel:
    """Build a chat model from a specific model ID.

    Looks up the model configuration from settings.models.available and
    builds the appropriate model with its specific provider_config.

    Args:
        settings: Application settings
        model_id: The model ID to use (must exist in settings.models.available)

    Returns:
        Configured OpenAIChatModel instance

    Raises:
        ModelConfigurationError: If the model is not found or doesn't support chat
        ValueError: If provider is not supported
    """
    model_config = settings.get_model_config(model_id)
    if model_config is None:
        raise ModelConfigurationError(f"Model not found: {model_id}")

    # Check for chat role
    if not model_config.has_role("chat"):
        raise ModelConfigurationError(f"Model {model_id} does not support chat role")

    log.debug(
        "building chat model from model_id",
        model_id=model_id,
        provider=model_config.provider,
        model=model_config.model,
        roles=model_config.roles,
    )

    return _build_chat_model_with_config(model_config)


def _build_chat_model_with_config(model_config: ModelConfig) -> OpenAIChatModel:
    """Build a chat model using model-specific configuration."""
    provider = model_config.provider
    model_name = model_config.model

    if provider == "openai":
        openai_settings = model_config.get_openai_config()
        _validate_openai_settings(openai_settings, model_config.id)
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
        ollama_settings = model_config.get_ollama_config()
        _validate_ollama_host(ollama_settings.host, model_config.id)
        base_url = _normalize_ollama_base_url(ollama_settings.host)
        return OpenAIChatModel(
            model_name,
            provider=OllamaProvider(base_url=base_url),
        )

    raise ValueError(f"Unsupported chat provider: {provider}")
