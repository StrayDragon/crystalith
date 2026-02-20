from __future__ import annotations

from typing import Any, TypeVar

from pydantic import BaseModel
from pydantic_ai.settings import ModelSettings

from crystalith.shared.config import CompletionOptions, ModelConfig, RequestOptions, Settings

TModel = TypeVar("TModel", bound=BaseModel)


def _explicit_fields(model: TModel | None) -> dict[str, Any]:
    if model is None:
        return {}

    fields_set = getattr(model, "model_fields_set", set())
    data: dict[str, Any] = {}
    for field in fields_set:
        value = getattr(model, field, None)
        if value is None:
            continue
        data[str(field)] = value
    return data


def resolve_completion_options(
    model_config: ModelConfig,
    *,
    overrides: CompletionOptions | None = None,
) -> CompletionOptions | None:
    merged: dict[str, Any] = {}
    merged.update(_explicit_fields(model_config.completion_options))
    merged.update(_explicit_fields(overrides))
    if not merged:
        return None
    return CompletionOptions(**merged)


def resolve_request_options(
    settings: Settings,
    model_config: ModelConfig,
    *,
    overrides: RequestOptions | None = None,
) -> RequestOptions:
    merged: dict[str, Any] = {"timeout": int(settings.ai.timeout)}
    merged.update(_explicit_fields(model_config.request_options))
    merged.update(_explicit_fields(overrides))
    return RequestOptions(**merged)


def completion_options_to_pydantic_model_settings(
    completion_options: CompletionOptions | None,
    *,
    request_options: RequestOptions | None = None,
) -> tuple[ModelSettings | None, tuple[str, ...]]:
    if completion_options is None and request_options is None:
        return None, ()

    model_settings: ModelSettings = {}
    unsupported: list[str] = []

    if completion_options is not None:
        if completion_options.temperature is not None:
            model_settings["temperature"] = float(completion_options.temperature)
        if completion_options.max_tokens is not None:
            model_settings["max_tokens"] = int(completion_options.max_tokens)
        if completion_options.top_p is not None:
            model_settings["top_p"] = float(completion_options.top_p)
        if completion_options.stop is not None:
            model_settings["stop_sequences"] = list(completion_options.stop)

        if completion_options.context_length is not None:
            unsupported.append("context_length")
        if completion_options.top_k is not None:
            unsupported.append("top_k")
        if completion_options.reasoning is not None:
            unsupported.append("reasoning")

    if request_options is not None:
        if request_options.timeout is not None:
            model_settings["timeout"] = float(request_options.timeout)
        if request_options.headers is not None:
            model_settings["extra_headers"] = dict(request_options.headers)

        # proxy/verify_ssl are applied at the HTTP client level, not ModelSettings.

    return (model_settings or None), tuple(unsupported)


def completion_options_to_openai_chat_kwargs(
    completion_options: CompletionOptions | None,
) -> tuple[dict[str, Any], tuple[str, ...]]:
    if completion_options is None:
        return {}, ()

    kwargs: dict[str, Any] = {}
    unsupported: list[str] = []

    if completion_options.temperature is not None:
        kwargs["temperature"] = float(completion_options.temperature)
    if completion_options.max_tokens is not None:
        # OpenAI SDK supports both max_tokens and max_completion_tokens; follow pydantic-ai behavior.
        kwargs["max_completion_tokens"] = int(completion_options.max_tokens)
    if completion_options.top_p is not None:
        kwargs["top_p"] = float(completion_options.top_p)
    if completion_options.stop is not None:
        kwargs["stop"] = list(completion_options.stop)

    if completion_options.context_length is not None:
        unsupported.append("context_length")
    if completion_options.top_k is not None:
        unsupported.append("top_k")
    if completion_options.reasoning is not None:
        unsupported.append("reasoning")

    return kwargs, tuple(unsupported)


def completion_options_to_ollama_options(
    completion_options: CompletionOptions | None,
) -> tuple[dict[str, Any], tuple[str, ...]]:
    if completion_options is None:
        return {}, ()

    options: dict[str, Any] = {}
    unsupported: list[str] = []

    if completion_options.temperature is not None:
        options["temperature"] = float(completion_options.temperature)
    if completion_options.max_tokens is not None:
        # Ollama uses num_predict for generation length.
        options["num_predict"] = int(completion_options.max_tokens)
    if completion_options.top_p is not None:
        options["top_p"] = float(completion_options.top_p)
    if completion_options.top_k is not None:
        options["top_k"] = int(completion_options.top_k)
    if completion_options.stop is not None:
        options["stop"] = list(completion_options.stop)

    if completion_options.context_length is not None:
        unsupported.append("context_length")
    if completion_options.reasoning is not None:
        unsupported.append("reasoning")

    return options, tuple(unsupported)
