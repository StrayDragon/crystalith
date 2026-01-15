from __future__ import annotations

from collections.abc import AsyncGenerator

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from cl_sqlalchemyx.mgrs import AsyncDBManager

from crystalith.ai.factory import create_chat_provider, create_embedding_provider
from crystalith.ai.interfaces import ChatProvider, EmbeddingProvider
from crystalith.config import Settings
from crystalith.parsers import TranscriptionProvider, create_transcription_provider
from crystalith.tasks import TaskQueue
from crystalith.vector_storage import VectorStore


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


async def get_db_session(request: Request) -> AsyncGenerator[AsyncSession, None]:
    manager: AsyncDBManager = request.app.state.db
    async with manager.got_manual_session() as session:
        yield session


def get_embedding_provider(settings: Settings = Depends(get_settings)) -> EmbeddingProvider:
    return create_embedding_provider(settings)


def get_chat_provider(settings: Settings = Depends(get_settings)) -> ChatProvider:
    return create_chat_provider(settings)


def get_transcription_provider(settings: Settings = Depends(get_settings)) -> TranscriptionProvider:
    return create_transcription_provider(settings)


def get_vector_store(request: Request) -> VectorStore:
    return request.app.state.vector_store


def get_task_queue(request: Request) -> TaskQueue:
    return request.app.state.task_queue
