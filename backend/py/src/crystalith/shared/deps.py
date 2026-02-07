from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import TYPE_CHECKING

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from cl_sqlalchemyx.mgrs import AsyncDBManager

from crystalith.shared.ai.factory import create_chat_provider, create_embedding_provider
from crystalith.shared.ai.interfaces import ChatProvider, EmbeddingProvider
from crystalith.shared.cache import CacheProvider, create_cache_provider
from crystalith.shared.config import Settings
from crystalith.shared.parsers import TranscriptionProvider, create_transcription_provider
from crystalith.shared.vector_storage import VectorStore

if TYPE_CHECKING:
    from crystalith.features.tasks.queue import TaskQueue


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_cache_provider(request: Request) -> CacheProvider:
    provider = getattr(request.app.state, "cache", None)
    if provider is None:
        provider = create_cache_provider(request.app.state.settings)
        request.app.state.cache = provider
    return provider


async def get_db_session(request: Request) -> AsyncGenerator[AsyncSession, None]:
    manager: AsyncDBManager = request.app.state.db
    async with manager.got_manual_session() as session:
        yield session


def get_embedding_provider(request: Request) -> EmbeddingProvider:
    provider = getattr(request.app.state, "embedding_provider", None)
    if provider is None:
        provider = create_embedding_provider(request.app.state.settings)
        request.app.state.embedding_provider = provider
    return provider


def get_ai_provider(request: Request) -> ChatProvider:
    provider = getattr(request.app.state, "ai_provider", None)
    if provider is None:
        provider = create_chat_provider(request.app.state.settings)
        request.app.state.ai_provider = provider
    return provider


def get_chat_provider(request: Request) -> ChatProvider:
    return get_ai_provider(request)


def get_transcription_provider(settings: Settings = Depends(get_settings)) -> TranscriptionProvider:
    return create_transcription_provider(settings)


def get_vector_store(request: Request) -> VectorStore:
    return request.app.state.vector_store


def get_task_queue(request: Request) -> "TaskQueue":
    return request.app.state.task_queue
