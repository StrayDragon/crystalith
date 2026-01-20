from __future__ import annotations

from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.ollama import OllamaProvider
from pydantic_ai.providers.openai import OpenAIProvider

from crystalith.config import OpenAIProviderSettings, Settings


def _resolve_openai_settings(settings: Settings) -> OpenAIProviderSettings:
    return settings.chat.openai or settings.openai


def _normalize_ollama_base_url(host: str) -> str:
    trimmed = host.rstrip("/")
    if trimmed.endswith("/v1"):
        return trimmed
    return f"{trimmed}/v1"


def build_chat_model(settings: Settings) -> OpenAIChatModel:
    provider = settings.chat.provider
    model_name = settings.chat.model

    if provider == "openai":
        openai_settings = _resolve_openai_settings(settings)
        return OpenAIChatModel(
            model_name,
            provider=OpenAIProvider(
                api_key=openai_settings.api_key,
                base_url=openai_settings.base_url,
                organization=openai_settings.organization,
                project=openai_settings.project,
            ),
        )

    if provider == "ollama":
        base_url = _normalize_ollama_base_url(settings.ollama.host)
        return OpenAIChatModel(
            model_name,
            provider=OllamaProvider(base_url=base_url),
        )

    raise ValueError(f"Unsupported chat provider: {provider}")
