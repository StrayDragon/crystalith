from __future__ import annotations

import pytest

from crystalith.shared.ai.factory import (
    create_chat_provider_by_model_id,
    create_embedding_provider_by_model_id,
)
from crystalith.shared.ai.ollama_provider import OllamaChatProvider, OllamaEmbeddingProvider
from crystalith.shared.ai.openai_provider import OpenAIChatProvider, OpenAIEmbeddingProvider
from crystalith.shared.ai.test_provider import TestChatProvider, TestEmbeddingProvider
from crystalith.shared.config import Settings
from crystalith.shared.plugins import PluginRegistry


def test_ai_factory_creates_test_providers() -> None:
    settings = Settings(
        models={
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
    )

    chat = create_chat_provider_by_model_id(settings, "test-chat")
    embed = create_embedding_provider_by_model_id(settings, "test-embed")
    assert isinstance(chat, TestChatProvider)
    assert isinstance(embed, TestEmbeddingProvider)


def test_ai_factory_creates_openai_and_ollama_providers_without_network() -> None:
    settings = Settings(
        models={
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
    )

    assert isinstance(create_chat_provider_by_model_id(settings, "openai-chat"), OpenAIChatProvider)
    assert isinstance(create_embedding_provider_by_model_id(settings, "openai-embed"), OpenAIEmbeddingProvider)
    assert isinstance(create_chat_provider_by_model_id(settings, "ollama-chat"), OllamaChatProvider)
    assert isinstance(create_embedding_provider_by_model_id(settings, "ollama-embed"), OllamaEmbeddingProvider)


def test_ai_factory_validates_openai_api_key_presence() -> None:
    settings = Settings(
        models={
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
    )
    with pytest.raises(ValueError, match="Missing api_key"):
        create_chat_provider_by_model_id(settings, "openai-chat")


def test_ai_factory_supports_plugin_providers(monkeypatch) -> None:
    settings = Settings(
        models={
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
    )

    registry = PluginRegistry()

    class _Plugin:
        def create_chat_provider(self, _settings, _model_config):  # noqa: ANN001
            return TestChatProvider(model="plugin")

        def create_embedding_provider(self, _settings, _model_config):  # noqa: ANN001
            return TestEmbeddingProvider(model="plugin")

    registry.ai_providers["my-plugin"] = _Plugin()

    provider = create_chat_provider_by_model_id(settings, "plugin-chat", plugins=registry)
    assert isinstance(provider, TestChatProvider)


def test_ai_factory_rejects_unknown_provider_without_plugin_registry() -> None:
    settings = Settings(
        models={
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
    )
    with pytest.raises(ValueError, match="Unsupported provider"):
        create_chat_provider_by_model_id(settings, "plugin-chat")
