from __future__ import annotations

from types import SimpleNamespace

import pytest

from crystalith.ai.factory import create_chat_provider, create_embedding_provider
from crystalith.ai.ollama_provider import OllamaChatProvider, OllamaEmbeddingProvider
from crystalith.ai.openai_provider import OpenAIChatProvider, OpenAIEmbeddingProvider
from crystalith.ai.types import ChatMessage
from crystalith.config.models import (
    ChatSettings,
    EmbeddingSettings,
    OllamaProviderSettings,
    OpenAIProviderSettings,
    Settings,
)


def test_factory_defaults() -> None:
    settings = Settings()
    embedding = create_embedding_provider(settings)

    assert isinstance(embedding, OllamaEmbeddingProvider)

    with pytest.raises(ValueError, match=r"openai\.api_key"):
        create_chat_provider(settings)


def test_factory_defaults_with_openai_api_key() -> None:
    settings = Settings(openai=OpenAIProviderSettings(api_key="test-api-key"))
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


def test_factory_supports_switching_providers() -> None:
    settings = Settings(
        openai=OpenAIProviderSettings(api_key="test-api-key"),
        embedding=EmbeddingSettings(provider="openai", model="text-embedding-3-small"),
        chat=ChatSettings(provider="ollama", model="llama3.2"),
    )

    embedding = create_embedding_provider(settings)
    chat = create_chat_provider(settings)

    assert isinstance(embedding, OpenAIEmbeddingProvider)
    assert isinstance(chat, OllamaChatProvider)


def test_factory_uses_provider_connection_settings() -> None:
    settings = Settings(
        openai=OpenAIProviderSettings(
            api_key="sk-test",
            base_url="https://example.com/v1",
            organization="org-test",
            project="proj-test",
        ),
        ollama=OllamaProviderSettings(host="http://example:11434"),
    )

    openai_chat = create_chat_provider(settings)
    assert isinstance(openai_chat, OpenAIChatProvider)
    assert str(openai_chat._client.base_url) == "https://example.com/v1/"
    assert openai_chat._client.organization == "org-test"
    assert openai_chat._client.project == "proj-test"
    assert openai_chat._client.webhook_secret == ""

    ollama_embed = create_embedding_provider(settings)
    assert isinstance(ollama_embed, OllamaEmbeddingProvider)
    assert str(ollama_embed._client._client.base_url) == "http://example:11434"


def test_factory_openai_client_ignores_environment_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENAI_BASE_URL", "https://env.example/v1")
    monkeypatch.setenv("OPENAI_ORG_ID", "env-org")
    monkeypatch.setenv("OPENAI_PROJECT_ID", "env-project")
    monkeypatch.setenv("OPENAI_WEBHOOK_SECRET", "env-secret")

    settings = Settings(openai=OpenAIProviderSettings(api_key="yaml-key"))

    provider = create_chat_provider(settings)
    assert isinstance(provider, OpenAIChatProvider)

    client = provider._client
    assert client.api_key == "yaml-key"
    assert str(client.base_url) == "https://api.openai.com/v1/"
    assert client.organization == ""
    assert client.project == ""
    assert client.webhook_secret == ""
