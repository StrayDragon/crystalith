from __future__ import annotations

import os
from collections.abc import AsyncGenerator
from typing import TYPE_CHECKING

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from cl_sqlalchemyx.mgrs import AsyncDBManager

from crystalith.shared.ai.factory import create_chat_provider, create_embedding_provider
from crystalith.shared.ai.interfaces import ChatProvider, EmbeddingProvider
from crystalith.shared.ai.wrappers import CachedEmbeddingProvider, DefaultBatchEmbeddingProvider
from crystalith.shared.cache import CacheProvider
from crystalith.shared.concurrency import StageLimiters
from crystalith.shared.config import Settings
from crystalith.shared.parsers import TranscriptionProvider, create_transcription_provider
from crystalith.shared.plugins import PluginRegistry
from crystalith.shared.vector_storage import VectorStore

if TYPE_CHECKING:
    from crystalith.features.tasks.queue import TaskQueue


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_plugin_registry(request: Request) -> PluginRegistry:
    return request.app.state.plugins


def get_cache_provider(request: Request) -> CacheProvider:
    return request.app.state.cache


async def get_db_session(request: Request) -> AsyncGenerator[AsyncSession, None]:
    manager: AsyncDBManager = request.app.state.db
    async with manager.got_manual_session() as session:
        yield session


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() not in {"0", "false", "no", "off"}


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return int(raw.strip())
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return float(raw.strip())
    except ValueError:
        return default


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

        if settings.cache.provider == "redis" and _env_bool("CRYSTALITH_EMBEDDING_CACHE_ENABLED", True):
            cache = get_cache_provider(request)
            ttl_s = _env_float("CRYSTALITH_EMBEDDING_CACHE_TTL_S", 600.0)
            max_texts = _env_int("CRYSTALITH_EMBEDDING_CACHE_MAX_TEXTS", 8)
            max_chars = _env_int("CRYSTALITH_EMBEDDING_CACHE_MAX_CHARS", 2000)
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
