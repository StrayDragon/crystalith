from __future__ import annotations

import pytest

from crystalith.shared.ai.factory import (
    create_chat_provider_by_model_id,
    create_embedding_provider_by_model_id,
)
from crystalith.shared.ai.ollama_provider import OllamaChatProvider, OllamaEmbeddingProvider
from crystalith.shared.ai.openai_provider import OpenAIChatProvider, OpenAIEmbeddingProvider
from crystalith.shared.ai.test_provider import TestChatProvider, TestEmbeddingProvider
from crystalith.shared.ai.interfaces import ChatProvider, EmbeddingProvider
from crystalith.shared.config import ModelConfig, Settings
from crystalith.shared.plugins import PluginRegistry
from tests._support.settings import make_settings


def test_ai_factory_creates_test_providers() -> None:
    settings = make_settings(
        {
            "models": {
                "available": [
                    {
                        "id": "test-chat",
                        "provider": "test",
                        "model": "test-chat",
                        "display_name": "Test Chat",
                        "roles": ["chat"],
                    },
                    {
                        "id": "test-embed",
                        "provider": "test",
                        "model": "test-embed",
                        "display_name": "Test Embed",
                        "roles": ["embed"],
                    },
                ]
            }
        }
    )

    chat = create_chat_provider_by_model_id(settings, "test-chat")
    embed = create_embedding_provider_by_model_id(settings, "test-embed")
    assert isinstance(chat, TestChatProvider)
    assert isinstance(embed, TestEmbeddingProvider)


def test_ai_factory_creates_openai_and_ollama_providers_without_network() -> None:
    settings = make_settings(
        {
            "models": {
                "available": [
                    {
                        "id": "openai-chat",
                        "provider": "openai",
                        "model": "gpt-test",
                        "display_name": "OpenAI Chat",
                        "roles": ["chat"],
                        "provider_config": {"api_key": "sk-test"},
                    },
                    {
                        "id": "openai-embed",
                        "provider": "openai",
                        "model": "text-embedding-3",
                        "display_name": "OpenAI Embed",
                        "roles": ["embed"],
                        "provider_config": {"api_key": "sk-test"},
                    },
                    {
                        "id": "ollama-chat",
                        "provider": "ollama",
                        "model": "qwen:latest",
                        "display_name": "Ollama Chat",
                        "roles": ["chat"],
                        "provider_config": {"host": "http://localhost:11434"},
                    },
                    {
                        "id": "ollama-embed",
                        "provider": "ollama",
                        "model": "bge:latest",
                        "display_name": "Ollama Embed",
                        "roles": ["embed"],
                        "provider_config": {"host": "http://localhost:11434"},
                    },
                ]
            }
        }
    )

    assert isinstance(create_chat_provider_by_model_id(settings, "openai-chat"), OpenAIChatProvider)
    assert isinstance(create_embedding_provider_by_model_id(settings, "openai-embed"), OpenAIEmbeddingProvider)
    assert isinstance(create_chat_provider_by_model_id(settings, "ollama-chat"), OllamaChatProvider)
    assert isinstance(create_embedding_provider_by_model_id(settings, "ollama-embed"), OllamaEmbeddingProvider)


def test_ai_factory_validates_openai_api_key_presence() -> None:
    settings = make_settings(
        {
            "models": {
                "available": [
                    {
                        "id": "openai-chat",
                        "provider": "openai",
                        "model": "gpt-test",
                        "display_name": "OpenAI Chat",
                        "roles": ["chat"],
                        "provider_config": {"api_key": "   "},
                    }
                ]
            }
        }
    )
    with pytest.raises(ValueError, match="Missing api_key"):
        create_chat_provider_by_model_id(settings, "openai-chat")


def test_ai_factory_supports_plugin_providers(monkeypatch) -> None:
    settings = make_settings(
        {
            "models": {
                "available": [
                    {
                        "id": "plugin-chat",
                        "provider": "my-plugin",
                        "model": "x",
                        "display_name": "Plugin",
                        "roles": ["chat"],
                    }
                ]
            }
        }
    )

    registry = PluginRegistry()

    class _Plugin:
        api_version = "v1"

        def create_chat_provider(self, settings: Settings, model_config: ModelConfig) -> ChatProvider:
            assert settings
            assert model_config
            return TestChatProvider(model="plugin")

        def create_embedding_provider(self, settings: Settings, model_config: ModelConfig) -> EmbeddingProvider:
            assert settings
            assert model_config
            return TestEmbeddingProvider(model="plugin")

    registry.ai_providers["my-plugin"] = _Plugin()

    provider = create_chat_provider_by_model_id(settings, "plugin-chat", plugins=registry)
    assert isinstance(provider, TestChatProvider)


def test_ai_factory_rejects_unknown_provider_without_plugin_registry() -> None:
    settings = make_settings(
        {
            "models": {
                "available": [
                    {
                        "id": "plugin-chat",
                        "provider": "missing-plugin",
                        "model": "x",
                        "display_name": "Plugin",
                        "roles": ["chat"],
                    }
                ]
            }
        }
    )
    with pytest.raises(ValueError, match="Unsupported provider"):
        create_chat_provider_by_model_id(settings, "plugin-chat")


def test_ai_factory_applies_request_options_timeout_per_model() -> None:
    settings = make_settings(
        {
            "ai": {"timeout": 60, "max_retries": 3},
            "models": {
                "available": [
                    {
                        "id": "openai-chat",
                        "provider": "openai",
                        "model": "gpt-test",
                        "display_name": "OpenAI Chat",
                        "roles": ["chat"],
                        "provider_config": {"api_key": "sk-test"},
                        "request_options": {"timeout": 7},
                    },
                    {
                        "id": "openai-embed",
                        "provider": "openai",
                        "model": "text-embedding-3",
                        "display_name": "OpenAI Embed",
                        "roles": ["embed"],
                        "provider_config": {"api_key": "sk-test"},
                        "request_options": {"timeout": 9},
                    },
                ]
            },
        }
    )

    chat = create_chat_provider_by_model_id(settings, "openai-chat")
    embed = create_embedding_provider_by_model_id(settings, "openai-embed")

    assert isinstance(chat, OpenAIChatProvider)
    assert isinstance(embed, OpenAIEmbeddingProvider)
    assert chat._timeout == 7.0  # noqa: SLF001
    assert embed._timeout == 9.0  # noqa: SLF001


def test_ai_factory_applies_completion_options_to_openai_chat_provider() -> None:
    settings = make_settings(
        {
            "ai": {"timeout": 60, "max_retries": 3},
            "models": {
                "available": [
                    {
                        "id": "openai-chat",
                        "provider": "openai",
                        "model": "gpt-test",
                        "display_name": "OpenAI Chat",
                        "roles": ["chat"],
                        "provider_config": {"api_key": "sk-test"},
                        "completion_options": {
                            "temperature": 0.1,
                            "max_tokens": 50,
                            "top_p": 0.95,
                            "stop": ["END"],
                        },
                    }
                ]
            },
        }
    )

    chat = create_chat_provider_by_model_id(settings, "openai-chat")
    assert isinstance(chat, OpenAIChatProvider)
    assert chat._completion_kwargs == {  # noqa: SLF001
        "temperature": 0.1,
        "max_completion_tokens": 50,
        "top_p": 0.95,
        "stop": ["END"],
    }
    assert getattr(chat._client, "max_retries", None) == 0  # noqa: SLF001


def test_ai_factory_resolves_fallback_host_for_ollama_client(monkeypatch) -> None:
    observed_hosts: list[str] = []

    class _StubAsyncClient:
        def __init__(self, *, host: str | None = None) -> None:
            observed_hosts.append(host or "")

    settings = make_settings(
        {
            "models": {
                "available": [
                    {
                        "id": "ollama-embed",
                        "provider": "ollama",
                        "model": "bge-m3:latest",
                        "display_name": "Ollama Embed",
                        "roles": ["embed"],
                        "provider_config": {"host": "http://host.docker.internal:11434"},
                    },
                ]
            }
        }
    )

    # Mock reason: validate fallback host selection without network dependency.
    monkeypatch.setattr(
        "crystalith.shared.ai.factory.resolve_reachable_ollama_host",
        lambda **_: "http://localhost:11434",
    )
    # Mock reason: verify the resolved host passed to client constructor.
    monkeypatch.setattr("crystalith.shared.ai.factory.ollama.AsyncClient", _StubAsyncClient)

    provider = create_embedding_provider_by_model_id(settings, "ollama-embed")
    assert isinstance(provider, OllamaEmbeddingProvider)
    assert observed_hosts == ["http://localhost:11434"]
