from __future__ import annotations

from dataclasses import dataclass

from cl_logs.logging import get_logger

from crystalith.shared.config import CompletionOptions, ModelConfig, RequestOptions, Settings
from crystalith.shared.plugins import PluginRegistry

from .cache import EmbeddingCache
from .effective_settings import (
    completion_options_to_openai_chat_kwargs,
    resolve_completion_options,
    resolve_request_options,
)
from .interfaces import ChatProvider, EmbeddingProvider
from .openai_client_manager import get_openai_client_manager
from .openai_provider import OpenAIChatProvider, OpenAIEmbeddingProvider
from .test_provider import TestChatProvider, TestEmbeddingProvider

log = get_logger(__name__)


@dataclass(frozen=True, slots=True)
class Providers:
    embedding: EmbeddingProvider
    chat: ChatProvider


_EMBEDDING_CACHE = EmbeddingCache(maxsize=10_000)

_WARNED_UNSUPPORTED_OPTIONS: set[tuple[str, str, tuple[str, ...]]] = set()
_WARNED_IGNORED_REQUEST_OPTIONS: set[str] = set()
_WARNED_PLUGIN_OPTIONS: set[str] = set()


def _warn_unsupported_options_once(model_id: str, provider: str, unsupported: tuple[str, ...]) -> None:
    if not unsupported:
        return
    key = (model_id, provider, unsupported)
    if key in _WARNED_UNSUPPORTED_OPTIONS:
        return
    _WARNED_UNSUPPORTED_OPTIONS.add(key)
    log.warning(
        "unsupported completion_options ignored for provider",
        model_id=model_id,
        provider=provider,
        unsupported_completion_options=list(unsupported),
    )


def _warn_ignored_request_options_once(
    model_id: str,
    provider: str,
    *,
    proxy: str | None,
    verify_ssl: bool,
    headers: dict[str, str] | None,
) -> None:
    if proxy is None and verify_ssl is True and headers is None:
        return
    if model_id in _WARNED_IGNORED_REQUEST_OPTIONS:
        return
    _WARNED_IGNORED_REQUEST_OPTIONS.add(model_id)
    log.warning(
        "request_options ignored for provider",
        model_id=model_id,
        provider=provider,
        proxy_configured=proxy is not None,
        verify_ssl=verify_ssl,
        header_keys=sorted(headers.keys()) if isinstance(headers, dict) else None,
    )


def _warn_plugin_options_once(
    model_id: str,
    provider: str,
    *,
    completion_options: CompletionOptions | None,
    request_options: RequestOptions | None,
) -> None:
    if completion_options is None and request_options is None:
        return
    key = f"{model_id}:{provider}"
    if key in _WARNED_PLUGIN_OPTIONS:
        return
    _WARNED_PLUGIN_OPTIONS.add(key)

    completion_fields = list(completion_options.model_fields_set) if completion_options is not None else []
    request_fields = list(request_options.model_fields_set) if request_options is not None else []
    if not completion_fields and not request_fields:
        return

    log.warning(
        "plugin provider must apply completion_options/request_options",
        model_id=model_id,
        provider=provider,
        completion_option_fields=sorted(str(f) for f in completion_fields) or None,
        request_option_fields=sorted(str(f) for f in request_fields) or None,
    )


def _resolve_ai_retries(settings: Settings) -> int:
    return int(settings.ai.max_retries)


def get_model_config_by_id(settings: Settings, model_id: str) -> ModelConfig | None:
    """Get a model configuration by its ID."""
    return settings.get_model_config(model_id)


def _create_openai_client(
    model_config: ModelConfig,
    *,
    reason: str,
    timeout_s: float,
    request_options: RequestOptions,
):
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
    return get_openai_client_manager().get(
        api_key=api_key.strip(),
        base_url=base_url,
        organization=config.organization,
        project=config.project,
        timeout=timeout_s,
        proxy=request_options.proxy,
        verify_ssl=request_options.verify_ssl,
        headers=request_options.headers,
        # We run our own retry policy in providers.run_with_retry; disable SDK retries
        # to avoid nested backoff and inflated tail latencies.
        max_retries=0,
    )


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

    request_options = resolve_request_options(settings, model_config)
    timeout_s = (
        float(request_options.timeout)
        if request_options.timeout is not None
        else float(settings.ai.timeout)
    )
    completion_options = resolve_completion_options(model_config)

    match model_config.provider:
        case "openai":
            completion_kwargs, unsupported = completion_options_to_openai_chat_kwargs(completion_options)
            _warn_unsupported_options_once(model_id, "openai", unsupported)
            return OpenAIChatProvider(
                model=model_config.model,
                client=_create_openai_client(
                    model_config,
                    reason=f"model:{model_id}",
                    timeout_s=timeout_s,
                    request_options=request_options,
                ),
                timeout=timeout_s,
                max_retries=_resolve_ai_retries(settings),
                completion_kwargs=completion_kwargs or None,
            )
        case "test":
            return TestChatProvider(model=model_config.model)
        case provider:
            if plugins is None:
                raise ValueError(f"Unsupported provider for model {model_id}: {provider}")

            plugin = plugins.ai_providers.get(provider)
            if plugin is None:
                raise ValueError(f"Unsupported provider for model {model_id}: {provider}")

            _warn_plugin_options_once(
                model_id,
                provider,
                completion_options=model_config.completion_options,
                request_options=model_config.request_options,
            )
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

    request_options = resolve_request_options(settings, model_config)
    timeout_s = (
        float(request_options.timeout)
        if request_options.timeout is not None
        else float(settings.ai.timeout)
    )

    match model_config.provider:
        case "openai":
            return OpenAIEmbeddingProvider(
                model=model_config.model,
                client=_create_openai_client(
                    model_config,
                    reason=f"embedding:{model_id}",
                    timeout_s=timeout_s,
                    request_options=request_options,
                ),
                timeout=timeout_s,
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

            _warn_plugin_options_once(
                model_id,
                provider,
                completion_options=model_config.completion_options,
                request_options=model_config.request_options,
            )
            return plugin.create_embedding_provider(settings, model_config)
