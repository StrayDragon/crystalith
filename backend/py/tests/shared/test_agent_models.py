from __future__ import annotations

import pytest

from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.models.test import TestModel

from crystalith.shared.agents.models import (
    ModelConfigurationError,
    _normalize_ollama_base_url,
    build_chat_model,
    build_chat_model_from_model_id,
)
from crystalith.shared.config import Settings


def test_normalize_ollama_base_url_appends_v1() -> None:
    assert _normalize_ollama_base_url("http://localhost:11434") == "http://localhost:11434/v1"
    assert _normalize_ollama_base_url("http://localhost:11434/") == "http://localhost:11434/v1"
    assert _normalize_ollama_base_url("http://localhost:11434/v1") == "http://localhost:11434/v1"


def test_build_chat_model_supports_test_provider() -> None:
    settings = Settings(
        models={
            "defaults": {"chat": "test-chat"},
            "available": [
                {
                    "id": "test-chat",
                    "provider": "test",
                    "model": "test-chat",
                    "display_name": "Test Chat",
                    "roles": ["chat"],
                }
            ],
        }
    )
    model = build_chat_model(settings)
    assert isinstance(model, TestModel)


def test_build_chat_model_builds_openai_and_ollama_models_without_network() -> None:
    settings = Settings(
        models={
            "defaults": {"chat": "openai-chat"},
            "available": [
                {
                    "id": "openai-chat",
                    "provider": "openai",
                    "model": "gpt-test",
                    "display_name": "OpenAI",
                    "roles": ["chat"],
                    "provider_config": {"api_key": "sk-test", "base_url": "http://localhost:1234/v1"},
                },
                {
                    "id": "ollama-chat",
                    "provider": "ollama",
                    "model": "qwen:latest",
                    "display_name": "Ollama",
                    "roles": ["chat"],
                    "provider_config": {"host": "http://localhost:11434"},
                },
            ],
        }
    )

    openai_model = build_chat_model(settings)
    assert isinstance(openai_model, OpenAIChatModel)

    ollama_model = build_chat_model_from_model_id(settings, "ollama-chat")
    assert isinstance(ollama_model, OpenAIChatModel)


def test_build_chat_model_validates_provider_config() -> None:
    settings = Settings(
        models={
            "available": [
                {
                    "id": "bad-openai",
                    "provider": "openai",
                    "model": "gpt-test",
                    "display_name": "Bad",
                    "roles": ["chat"],
                    "provider_config": {"api_key": "   "},
                },
                {
                    "id": "bad-ollama",
                    "provider": "ollama",
                    "model": "qwen:latest",
                    "display_name": "Bad",
                    "roles": ["chat"],
                    "provider_config": {"host": "   "},
                },
            ]
        }
    )

    with pytest.raises(ModelConfigurationError, match="Missing api_key"):
        build_chat_model_from_model_id(settings, "bad-openai")

    with pytest.raises(ModelConfigurationError, match="Missing host"):
        build_chat_model_from_model_id(settings, "bad-ollama")


def test_build_chat_model_rejects_unsupported_provider() -> None:
    settings = Settings(
        models={
            "available": [
                {
                    "id": "bad",
                    "provider": "unknown",
                    "model": "x",
                    "display_name": "Bad",
                    "roles": ["chat"],
                }
            ]
        }
    )

    with pytest.raises(ModelConfigurationError, match="Unsupported chat provider"):
        build_chat_model_from_model_id(settings, "bad")
