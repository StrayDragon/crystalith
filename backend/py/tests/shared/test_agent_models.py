from __future__ import annotations

import pytest
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.models.test import TestModel

from crystalith.shared.agents.models import (
    ModelConfigurationError,
    build_chat_model,
    build_chat_model_from_model_id,
)
from tests._support.settings import make_settings


def test_build_chat_model_supports_test_provider() -> None:
    settings = make_settings(
        {
            "models": {
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
        }
    )
    model = build_chat_model(settings)
    assert isinstance(model, TestModel)


def test_build_chat_model_builds_openai_model_without_network() -> None:
    settings = make_settings(
        {
            "models": {
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
                ],
            }
        }
    )

    openai_model = build_chat_model(settings)
    assert isinstance(openai_model, OpenAIChatModel)


def test_build_chat_model_applies_completion_and_request_options_to_model_settings() -> None:
    settings = make_settings(
        {
            "ai": {"timeout": 60, "max_retries": 3},
            "models": {
                "defaults": {"chat": "openai-chat"},
                "available": [
                    {
                        "id": "openai-chat",
                        "provider": "openai",
                        "model": "gpt-test",
                        "display_name": "OpenAI",
                        "roles": ["chat"],
                        "provider_config": {"api_key": "sk-test", "base_url": "http://localhost:1234/v1"},
                        "completion_options": {
                            "temperature": 0.25,
                            "max_tokens": 123,
                            "top_p": 0.9,
                            "stop": ["END"],
                        },
                        "request_options": {
                            "timeout": 12,
                            "headers": {"X-Test": "1"},
                        },
                    }
                ],
            },
        }
    )

    model = build_chat_model(settings)
    assert isinstance(model, OpenAIChatModel)

    assert model.settings is not None
    assert model.settings.get("temperature") == 0.25
    assert model.settings.get("max_tokens") == 123
    assert model.settings.get("top_p") == 0.9
    assert model.settings.get("stop_sequences") == ["END"]
    assert model.settings.get("timeout") == 12.0
    assert model.settings.get("extra_headers") == {"X-Test": "1"}

    assert model.client.timeout == 12.0
    assert model.client.max_retries == 0
    assert model.client.default_headers.get("X-Test") == "1"


def test_build_chat_model_validates_provider_config() -> None:
    settings = make_settings(
        {
            "models": {
                "available": [
                    {
                        "id": "bad-openai",
                        "provider": "openai",
                        "model": "gpt-test",
                        "display_name": "Bad",
                        "roles": ["chat"],
                        "provider_config": {"api_key": "   "},
                    },
                ]
            }
        }
    )

    with pytest.raises(ModelConfigurationError, match="Missing api_key"):
        build_chat_model_from_model_id(settings, "bad-openai")


def test_build_chat_model_rejects_unsupported_provider() -> None:
    settings = make_settings(
        {
            "models": {
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
        }
    )

    with pytest.raises(ModelConfigurationError, match="Unsupported chat provider"):
        build_chat_model_from_model_id(settings, "bad")
