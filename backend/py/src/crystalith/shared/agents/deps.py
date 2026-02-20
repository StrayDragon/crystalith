from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.shared.ai.interfaces import EmbeddingProvider
from crystalith.shared.cache import CacheProvider
from crystalith.shared.concurrency import StageLimiters
from crystalith.shared.config import Settings
from crystalith.shared.plugins import PluginRegistry
from crystalith.shared.vector_storage import VectorStore


@dataclass(frozen=True, slots=True)
class StudioDeps:
    settings: Settings
    session: AsyncSession
    vector_store: VectorStore
    embedder: EmbeddingProvider
    cache: CacheProvider | None = None
    model: Any | None = None
    limiters: StageLimiters | None = None
    plugins: PluginRegistry | None = None
