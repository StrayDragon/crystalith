from __future__ import annotations

from crystalith.shared.config import Settings

from .interfaces import VectorStore
from .chroma import ChromaVectorStore
from .memory import InMemoryVectorStore


def create_vector_store(settings: Settings) -> VectorStore:
    match settings.vector_storage.provider:
        case "memory":
            return InMemoryVectorStore()
        case "chroma":
            return ChromaVectorStore(
                path=settings.vector_storage.chroma.path,
                telemetry=settings.vector_storage.chroma.telemetry,
            )
        case "sqlite":
            return ChromaVectorStore(
                path=settings.vector_storage.chroma.path,
                telemetry=settings.vector_storage.chroma.telemetry,
            )
        case provider:
            raise ValueError(f"Unsupported vector storage provider: {provider}")
