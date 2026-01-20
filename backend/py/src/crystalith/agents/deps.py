from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.ai.interfaces import EmbeddingProvider
from crystalith.config import Settings
from crystalith.vector_storage import VectorStore


@dataclass(frozen=True, slots=True)
class StudioDeps:
    settings: Settings
    session: AsyncSession
    vector_store: VectorStore
    embedder: EmbeddingProvider
    model: Any | None = None
