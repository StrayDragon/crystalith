from __future__ import annotations

from collections.abc import AsyncGenerator

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from cl_sqlalchemyx.mgrs import AsyncDBManager

from crystalith.ai.factory import create_chat_provider, create_embedding_provider
from crystalith.ai.interfaces import ChatProvider, EmbeddingProvider
from crystalith.config import Settings
from crystalith.vector_index import InMemoryVectorIndex


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


def get_vector_index(request: Request) -> InMemoryVectorIndex:
    return request.app.state.vector_index
