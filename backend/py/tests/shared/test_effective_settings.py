from __future__ import annotations

import pytest

from crystalith.shared.ai.effective_settings import (
    completion_options_to_ollama_options,
    completion_options_to_openai_chat_kwargs,
    completion_options_to_pydantic_model_settings,
    resolve_completion_options,
    resolve_request_options,
)
from crystalith.shared.ai.openai_client_manager import OpenAIClientManager
from crystalith.shared.config import CompletionOptions, RequestOptions, Settings


def test_resolve_request_options_priority_model_over_global() -> None:
    settings = Settings(
        ai={"timeout": 60, "max_retries": 3},
        models={
            "available": [
                {
                    "id": "m1",
                    "provider": "openai",
                    "model": "gpt-test",
                    "display_name": "M1",
                    "roles": ["chat"],
                    "provider_config": {"api_key": "sk-test"},
                    "request_options": {"timeout": 12},
                }
            ]
        },
    )
    model_config = settings.get_model_config("m1")
    assert model_config is not None

    resolved = resolve_request_options(settings, model_config)
    assert resolved.timeout == 12


def test_resolve_request_options_priority_overrides_model() -> None:
    settings = Settings(
        ai={"timeout": 60, "max_retries": 3},
        models={
            "available": [
                {
                    "id": "m1",
                    "provider": "openai",
                    "model": "gpt-test",
                    "display_name": "M1",
                    "roles": ["chat"],
                    "provider_config": {"api_key": "sk-test"},
                    "request_options": {"timeout": 12, "verify_ssl": False},
                }
            ]
        },
    )
    model_config = settings.get_model_config("m1")
    assert model_config is not None

    resolved = resolve_request_options(settings, model_config, overrides=RequestOptions(timeout=5))
    assert resolved.timeout == 5
    # verify_ssl stays from model-level since overrides didn't explicitly set it
    assert resolved.verify_ssl is False


def test_resolve_completion_options_priority_overrides_model() -> None:
    settings = Settings(
        models={
            "available": [
                {
                    "id": "m1",
                    "provider": "openai",
                    "model": "gpt-test",
                    "display_name": "M1",
                    "roles": ["chat"],
                    "provider_config": {"api_key": "sk-test"},
                    "completion_options": {"temperature": 0.7},
                }
            ]
        },
    )
    model_config = settings.get_model_config("m1")
    assert model_config is not None

    resolved = resolve_completion_options(model_config, overrides=CompletionOptions(temperature=0.2))
    assert resolved is not None
    assert resolved.temperature == 0.2


def test_completion_options_to_pydantic_model_settings_maps_and_reports_unsupported() -> None:
    completion_options = CompletionOptions(
        context_length=8000,
        top_k=40,
        reasoning=True,
        temperature=0.3,
        max_tokens=120,
        top_p=0.9,
        stop=["END"],
    )
    request_options = RequestOptions(timeout=10, headers={"X-Test": "1"})

    model_settings, unsupported = completion_options_to_pydantic_model_settings(
        completion_options,
        request_options=request_options,
    )
    assert model_settings is not None
    assert model_settings["temperature"] == 0.3
    assert model_settings["max_tokens"] == 120
    assert model_settings["top_p"] == 0.9
    assert model_settings["stop_sequences"] == ["END"]
    assert model_settings["timeout"] == 10.0
    assert model_settings["extra_headers"] == {"X-Test": "1"}
    assert set(unsupported) == {"context_length", "top_k", "reasoning"}


def test_completion_options_to_openai_chat_kwargs_maps_and_reports_unsupported() -> None:
    completion_options = CompletionOptions(
        context_length=8000,
        top_k=40,
        reasoning=True,
        temperature=0.3,
        max_tokens=120,
        top_p=0.9,
        stop=["END"],
    )

    kwargs, unsupported = completion_options_to_openai_chat_kwargs(completion_options)
    assert kwargs == {
        "temperature": 0.3,
        "max_completion_tokens": 120,
        "top_p": 0.9,
        "stop": ["END"],
    }
    assert set(unsupported) == {"context_length", "top_k", "reasoning"}


def test_completion_options_to_ollama_options_maps_and_reports_unsupported() -> None:
    completion_options = CompletionOptions(
        context_length=8000,
        reasoning=True,
        temperature=0.3,
        max_tokens=120,
        top_p=0.9,
        top_k=40,
        stop=["END"],
    )

    options, unsupported = completion_options_to_ollama_options(completion_options)
    assert options == {
        "temperature": 0.3,
        "num_predict": 120,
        "top_p": 0.9,
        "top_k": 40,
        "stop": ["END"],
    }
    assert set(unsupported) == {"context_length", "reasoning"}


@pytest.mark.asyncio
async def test_openai_client_manager_caches_clients_by_key() -> None:
    manager = OpenAIClientManager()
    client1 = manager.get(
        api_key="sk-test",
        base_url="http://localhost:1234/v1",
        organization=None,
        project=None,
        timeout=5,
        proxy=None,
        verify_ssl=True,
        headers=None,
        max_retries=0,
    )
    client2 = manager.get(
        api_key="sk-test",
        base_url="http://localhost:1234/v1",
        organization=None,
        project=None,
        timeout=5,
        proxy=None,
        verify_ssl=True,
        headers=None,
        max_retries=0,
    )
    client3 = manager.get(
        api_key="sk-test",
        base_url="http://localhost:1234/v1",
        organization=None,
        project=None,
        timeout=5,
        proxy=None,
        verify_ssl=True,
        headers={"X-Test": "1"},
        max_retries=0,
    )

    assert client1 is client2
    assert client1 is not client3
    await manager.aclose()
