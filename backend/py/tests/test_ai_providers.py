from __future__ import annotations

from types import SimpleNamespace

import pytest

from crystalith.ai.factory import (
    create_chat_provider,
    create_chat_provider_by_model_id,
    create_embedding_provider,
    create_embedding_provider_by_model_id,
)
from crystalith.ai.ollama_provider import OllamaChatProvider, OllamaEmbeddingProvider
from crystalith.ai.openai_provider import OpenAIChatProvider, OpenAIEmbeddingProvider
from crystalith.ai.types import ChatMessage
from crystalith.config.models import (
    ModelConfig,
    ModelDefaults,
    ModelsSettings,
    Settings,
)


def _create_test_settings(
    *,
    openai_api_key: str = "test-api-key",
    openai_base_url: str = "https://api.openai.com/v1",
    ollama_host: str = "http://localhost:11434",
    default_chat: str = "test-openai",
    default_embedding: str = "test-ollama-embed",
) -> Settings:
    """Create Settings with test model configurations."""
    return Settings(
        models=ModelsSettings(
            defaults=ModelDefaults(
                chat=default_chat,
                embedding=default_embedding,
            ),
            available=[
                ModelConfig(
                    id="test-openai",
                    provider="openai",
                    model="gpt-4o-mini",
                    display_name="Test OpenAI",
                    roles=["chat", "edit"],
                    provider_config={
                        "api_key": openai_api_key,
                        "base_url": openai_base_url,
                    },
                ),
                ModelConfig(
                    id="test-ollama",
                    provider="ollama",
                    model="llama3.2",
                    display_name="Test Ollama",
                    roles=["chat"],
                    provider_config={
                        "host": ollama_host,
                    },
                ),
                ModelConfig(
                    id="test-ollama-embed",
                    provider="ollama",
                    model="bge-m3",
                    display_name="Test Embed",
                    roles=["embed"],
                    provider_config={
                        "host": ollama_host,
                    },
                ),
                ModelConfig(
                    id="test-openai-embed",
                    provider="openai",
                    model="text-embedding-3-small",
                    display_name="Test OpenAI Embed",
                    roles=["embed"],
                    provider_config={
                        "api_key": openai_api_key,
                        "base_url": openai_base_url,
                    },
                ),
            ],
        )
    )


def test_factory_defaults_no_models() -> None:
    """Test that factory raises error when no models are configured."""
    settings = Settings(models=ModelsSettings())

    with pytest.raises(ValueError, match="No default embedding model"):
        create_embedding_provider(settings)

    with pytest.raises(ValueError, match="No default chat model"):
        create_chat_provider(settings)


def test_factory_with_configured_models() -> None:
    settings = _create_test_settings()

    embedding = create_embedding_provider(settings)
    chat = create_chat_provider(settings)

    assert isinstance(embedding, OllamaEmbeddingProvider)
    assert isinstance(chat, OpenAIChatProvider)


@pytest.mark.asyncio
async def test_openai_embedding_sorts_by_index() -> None:
    class FakeEmbeddings:
        async def create(self, *, model: str, input: list[str]):
            assert model == "text-embedding-3-small"
            assert input == ["a", "b"]
            return SimpleNamespace(
                data=[
                    SimpleNamespace(index=1, embedding=[1.0]),
                    SimpleNamespace(index=0, embedding=[0.0]),
                ]
            )

    fake_client = SimpleNamespace(embeddings=FakeEmbeddings())
    provider = OpenAIEmbeddingProvider(model="text-embedding-3-small", client=fake_client)

    vectors = await provider.embed(["a", "b"])
    assert vectors == [[0.0], [1.0]]


@pytest.mark.asyncio
async def test_openai_chat_returns_content() -> None:
    class FakeCompletions:
        async def create(self, *, model: str, messages: list[dict[str, str]]):
            assert model == "gpt-4o-mini"
            assert messages == [{"role": "user", "content": "hi"}]
            return SimpleNamespace(
                choices=[SimpleNamespace(message=SimpleNamespace(content="hello"))]
            )

    fake_client = SimpleNamespace(chat=SimpleNamespace(completions=FakeCompletions()))
    provider = OpenAIChatProvider(model="gpt-4o-mini", client=fake_client)

    reply = await provider.chat([ChatMessage(role="user", content="hi")])
    assert reply == "hello"


@pytest.mark.asyncio
async def test_ollama_embedding_returns_vectors() -> None:
    class FakeOllama:
        async def embed(self, *, model: str, input: list[str], options=None):
            assert model == "bge-m3"
            assert input == ["a", "b"]
            assert options is None
            return SimpleNamespace(embeddings=[[0.1], [0.2]])

    provider = OllamaEmbeddingProvider(model="bge-m3", client=FakeOllama())
    vectors = await provider.embed(["a", "b"])
    assert vectors == [[0.1], [0.2]]


@pytest.mark.asyncio
async def test_ollama_chat_returns_content() -> None:
    class FakeOllama:
        async def chat(self, *, model: str, messages: list[dict[str, str]]):
            assert model == "llama3.2"
            assert messages == [{"role": "user", "content": "hi"}]
            return SimpleNamespace(message=SimpleNamespace(content="hello"))

    provider = OllamaChatProvider(model="llama3.2", client=FakeOllama())
    reply = await provider.chat([ChatMessage(role="user", content="hi")])
    assert reply == "hello"


@pytest.mark.asyncio
async def test_chat_empty_messages_rejected() -> None:
    with pytest.raises(ValueError):
        await OpenAIChatProvider(model="gpt-4o-mini", client=SimpleNamespace()).chat([])

    with pytest.raises(ValueError):
        await OllamaChatProvider(model="llama3.2", client=SimpleNamespace()).chat([])


def test_factory_create_by_model_id() -> None:
    """Test creating providers by specific model ID."""
    settings = _create_test_settings()

    # Create chat provider by model ID
    openai_chat = create_chat_provider_by_model_id(settings, "test-openai")
    assert isinstance(openai_chat, OpenAIChatProvider)
    assert openai_chat.model == "gpt-4o-mini"

    ollama_chat = create_chat_provider_by_model_id(settings, "test-ollama")
    assert isinstance(ollama_chat, OllamaChatProvider)
    assert ollama_chat.model == "llama3.2"

    # Create embedding provider by model ID
    ollama_embed = create_embedding_provider_by_model_id(settings, "test-ollama-embed")
    assert isinstance(ollama_embed, OllamaEmbeddingProvider)

    openai_embed = create_embedding_provider_by_model_id(settings, "test-openai-embed")
    assert isinstance(openai_embed, OpenAIEmbeddingProvider)


def test_factory_model_not_found() -> None:
    """Test that factory raises error for unknown model ID."""
    settings = _create_test_settings()

    with pytest.raises(ValueError, match="Model not found"):
        create_chat_provider_by_model_id(settings, "nonexistent")

    with pytest.raises(ValueError, match="Model not found"):
        create_embedding_provider_by_model_id(settings, "nonexistent")


def test_factory_wrong_role() -> None:
    """Test that factory raises error when model doesn't support requested role."""
    settings = _create_test_settings()

    # Embedding model doesn't support chat
    with pytest.raises(ValueError, match="does not support chat role"):
        create_chat_provider_by_model_id(settings, "test-ollama-embed")

    # Chat model doesn't support embed
    with pytest.raises(ValueError, match="does not support embed role"):
        create_embedding_provider_by_model_id(settings, "test-openai")


def test_factory_uses_provider_config() -> None:
    """Test that factory uses model's provider_config settings."""
    settings = _create_test_settings(
        openai_api_key="sk-test",
        openai_base_url="https://example.com/v1",
        ollama_host="http://example:11434",
    )

    openai_chat = create_chat_provider_by_model_id(settings, "test-openai")
    assert isinstance(openai_chat, OpenAIChatProvider)
    assert str(openai_chat._client.base_url) == "https://example.com/v1/"
    assert openai_chat._client.webhook_secret == ""

    ollama_embed = create_embedding_provider_by_model_id(settings, "test-ollama-embed")
    assert isinstance(ollama_embed, OllamaEmbeddingProvider)
    assert str(ollama_embed._client._client.base_url) == "http://example:11434"


def test_factory_openai_client_ignores_environment_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test that OpenAI client uses config values, not environment defaults."""
    monkeypatch.setenv("OPENAI_BASE_URL", "https://env.example/v1")
    monkeypatch.setenv("OPENAI_ORG_ID", "env-org")
    monkeypatch.setenv("OPENAI_PROJECT_ID", "env-project")
    monkeypatch.setenv("OPENAI_WEBHOOK_SECRET", "env-secret")

    settings = _create_test_settings(
        openai_api_key="yaml-key",
        openai_base_url="https://api.openai.com/v1",
    )

    provider = create_chat_provider_by_model_id(settings, "test-openai")
    assert isinstance(provider, OpenAIChatProvider)

    client = provider._client
    assert client.api_key == "yaml-key"
    assert str(client.base_url) == "https://api.openai.com/v1/"
    assert client.organization == ""
    assert client.project == ""
    assert client.webhook_secret == ""
