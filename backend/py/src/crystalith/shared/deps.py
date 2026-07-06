from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import TYPE_CHECKING

from fastapi import Depends, HTTPException, Request
from lush_sqlalchemyx.mgrs import AsyncMySQLManager
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.ai.factory import create_chat_provider, create_embedding_provider
from crystalith.shared.ai.interfaces import ChatProvider, EmbeddingProvider
from crystalith.shared.ai.wrappers import CachedEmbeddingProvider, DefaultBatchEmbeddingProvider
from crystalith.shared.cache import CacheProvider
from crystalith.shared.concurrency import StageLimiters
from crystalith.shared.config import Settings
from crystalith.shared.env import (
    CRYSTALITH_EMBEDDING_CACHE_ENABLED,
    CRYSTALITH_EMBEDDING_CACHE_MAX_CHARS,
    CRYSTALITH_EMBEDDING_CACHE_MAX_TEXTS,
    CRYSTALITH_EMBEDDING_CACHE_TTL_S,
    EMBEDDING_CACHE_ENABLED_DEFAULT,
    EMBEDDING_CACHE_MAX_CHARS_DEFAULT,
    EMBEDDING_CACHE_MAX_TEXTS_DEFAULT,
    EMBEDDING_CACHE_TTL_S_DEFAULT,
    env_bool,
    env_float,
    env_int,
)
from crystalith.shared.parsers import TranscriptionProvider, create_transcription_provider
from crystalith.shared.plugins import PluginRegistry
from crystalith.shared.vector_storage import VectorStore

if TYPE_CHECKING:
    from crystalith.features.tasks.queue import TaskQueue


def _raise_provider_config_error(exc: Exception, *, capability: str) -> None:
    message = str(exc)
    if "Missing api_key" not in message:
        raise exc
    raise HTTPException(
        status_code=503,
        detail={
            "error_code": "AI_CONFIG_MISSING",
            "message": f"{capability} 模型未配置 API Key",
            "details": (
                "请在 shell 中 export 对应模型的 API Key 环境变量（如 OMLX_OPENAI_API_KEY）后重启后端"
                "（或确保 shell 中 export 后运行 just upsert-env-configs），然后重启后端。"
            ),
        },
    ) from exc


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_plugin_registry(request: Request) -> PluginRegistry:
    return request.app.state.plugins


def get_cache_provider(request: Request) -> CacheProvider:
    return request.app.state.cache


async def get_db_session(request: Request) -> AsyncGenerator[AsyncSession, None]:
    manager: AsyncMySQLManager = request.app.state.db
    async with manager.got_manual_session() as session:
        yield session


def get_embedding_provider(request: Request) -> EmbeddingProvider:
    provider = request.app.state.embedding_provider
    if provider is None:
        settings: Settings = request.app.state.settings
        try:
            provider = create_embedding_provider(
                settings,
                plugins=request.app.state.plugins,
            )
        except TypeError:
            provider = create_embedding_provider(settings)
        except ValueError as exc:
            _raise_provider_config_error(exc, capability="Embedding")

        if settings.cache.provider == "redis" and env_bool(CRYSTALITH_EMBEDDING_CACHE_ENABLED, EMBEDDING_CACHE_ENABLED_DEFAULT):
            cache = get_cache_provider(request)
            ttl_s = env_float(CRYSTALITH_EMBEDDING_CACHE_TTL_S, EMBEDDING_CACHE_TTL_S_DEFAULT)
            max_texts = env_int(CRYSTALITH_EMBEDDING_CACHE_MAX_TEXTS, EMBEDDING_CACHE_MAX_TEXTS_DEFAULT)
            max_chars = env_int(CRYSTALITH_EMBEDDING_CACHE_MAX_CHARS, EMBEDDING_CACHE_MAX_CHARS_DEFAULT)
            if ttl_s > 0 and max_texts > 0 and max_chars > 0:
                provider = CachedEmbeddingProvider(
                    provider,
                    cache=cache,
                    ttl_s=ttl_s,
                    max_texts=max_texts,
                    max_chars=max_chars,
                )

        provider = DefaultBatchEmbeddingProvider(provider, batch_size=int(settings.embedding.batch_size))

        request.app.state.embedding_provider = provider
    return provider


def get_ai_provider(request: Request) -> ChatProvider:
    provider = request.app.state.ai_provider
    if provider is None:
        try:
            provider = create_chat_provider(
                request.app.state.settings,
                plugins=request.app.state.plugins,
            )
        except TypeError:
            provider = create_chat_provider(request.app.state.settings)
        except ValueError as exc:
            _raise_provider_config_error(exc, capability="Chat")
        request.app.state.ai_provider = provider
    return provider


def get_chat_provider(request: Request) -> ChatProvider:
    return get_ai_provider(request)


def get_transcription_provider(settings: Settings = Depends(get_settings)) -> TranscriptionProvider:
    return create_transcription_provider(settings)


def get_vector_store(request: Request) -> VectorStore:
    return request.app.state.vector_store


def get_stage_limiters(request: Request) -> StageLimiters:
    return request.app.state.limiters


def get_task_queue(request: Request) -> TaskQueue:
    return request.app.state.task_queue
