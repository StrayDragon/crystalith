from __future__ import annotations

from lush_logx.logging import get_logger
from pydantic import BaseModel
from pydantic_ai.models import Model
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.models.test import TestModel
from pydantic_ai.providers.openai import OpenAIProvider

from crystalith.shared.ai.effective_settings import (
    completion_options_to_pydantic_model_settings,
    resolve_completion_options,
    resolve_request_options,
)
from crystalith.shared.ai.openai_client_manager import get_openai_client_manager
from crystalith.shared.config import ModelConfig, OpenAIProviderSettings, Settings

log = get_logger(__name__)


class ModelConfigurationError(Exception):
    """Raised when model configuration is invalid or missing."""


def _validate_openai_settings(openai_settings: OpenAIProviderSettings, model_id: str) -> None:
    """Validate that required OpenAI settings are present."""
    if not openai_settings.api_key or not openai_settings.api_key.strip():
        raise ModelConfigurationError(
            f"Missing api_key in provider_config for model '{model_id}'"
        )


def build_chat_model(settings: Settings) -> Model:
    """Build the default chat model from settings.

    Uses models.defaults.chat to determine which model to use.

    Args:
        settings: Application settings

    Returns:
        Configured chat model instance

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
) -> Model:
    """Build a chat model from a specific model ID.

    Looks up the model configuration from settings.models.available and
    builds the appropriate model with its specific provider_config.

    Args:
        settings: Application settings
        model_id: The model ID to use (must exist in settings.models.available)

    Returns:
        Configured chat model instance

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

    return _build_chat_model_with_config(settings, model_config)


_WARNED_UNSUPPORTED_COMPLETION_OPTIONS: set[tuple[str, tuple[str, ...]]] = set()


def _warn_unsupported_completion_options_once(model_id: str, unsupported: tuple[str, ...]) -> None:
    if not unsupported:
        return
    key = (model_id, unsupported)
    if key in _WARNED_UNSUPPORTED_COMPLETION_OPTIONS:
        return
    _WARNED_UNSUPPORTED_COMPLETION_OPTIONS.add(key)
    log.warning(
        "unsupported completion_options ignored for provider",
        model_id=model_id,
        unsupported_completion_options=list(unsupported),
    )


def _build_chat_model_with_config(settings: Settings, model_config: ModelConfig) -> Model:
    """Build a chat model using model-specific configuration."""
    provider = model_config.provider
    model_name = model_config.model

    if provider == "test":
        return TestModel(seed=0, model_name=model_name)

    completion_options = resolve_completion_options(model_config)
    request_options = resolve_request_options(settings, model_config)
    timeout_s = (
        float(request_options.timeout)
        if request_options.timeout is not None
        else float(settings.ai.timeout)
    )
    model_settings, unsupported = completion_options_to_pydantic_model_settings(
        completion_options,
        request_options=request_options,
    )
    _warn_unsupported_completion_options_once(model_config.id, unsupported)

    if provider == "openai":
        openai_settings = model_config.get_openai_config()
        _validate_openai_settings(openai_settings, model_config.id)
        openai_client = get_openai_client_manager().get(
            api_key=(openai_settings.api_key or "").strip(),
            base_url=openai_settings.base_url or "https://api.openai.com/v1",
            organization=openai_settings.organization,
            project=openai_settings.project,
            timeout=timeout_s,
            proxy=request_options.proxy,
            verify_ssl=request_options.verify_ssl,
            headers=request_options.headers,
            # Disable SDK retries; rely on business retry policy.
            max_retries=0,
        )
        return OpenAIChatModel(
            model_name,
            provider=OpenAIProvider(openai_client=openai_client),
            settings=model_settings,
        )

    raise ModelConfigurationError(f"Unsupported chat provider: {provider}")


def extract_effective_model_settings_for_log(model: Model) -> dict[str, object]:
    settings_obj: object = {}
    if isinstance(model, OpenAIChatModel):
        settings_obj = model.settings or {}

    if isinstance(settings_obj, dict):
        settings: dict[str, object] = {str(k): v for k, v in settings_obj.items()}
    elif isinstance(settings_obj, BaseModel):
        settings = settings_obj.model_dump()
    else:
        settings = {}

    stop_sequences = settings.get("stop_sequences")
    extra_headers = settings.get("extra_headers")

    header_keys: list[str] | None = None
    if isinstance(extra_headers, dict):
        header_keys = sorted(str(k) for k in extra_headers)

    stop_count: int | None = None
    if isinstance(stop_sequences, (list, tuple)):
        stop_count = len(stop_sequences)

    payload: dict[str, object] = {
        "model_timeout_s": settings.get("timeout"),
        "model_temperature": settings.get("temperature"),
        "model_max_tokens": settings.get("max_tokens"),
        "model_top_p": settings.get("top_p"),
        "model_stop_sequences_count": stop_count,
        "model_header_keys": header_keys,
    }
    return {k: v for k, v in payload.items() if v is not None}
