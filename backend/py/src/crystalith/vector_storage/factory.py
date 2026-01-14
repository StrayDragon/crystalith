from __future__ import annotations

from crystalith.config import Settings

from .interfaces import VectorStore
from .memory import InMemoryVectorStore
from .sqlite import SQLiteVectorStore


def create_vector_store(settings: Settings) -> VectorStore:
    match settings.vector_storage.provider:
        case "memory":
            return InMemoryVectorStore()
        case "sqlite":
            return SQLiteVectorStore(path=settings.vector_storage.sqlite.path)
        case "chroma":
            raise ValueError("Chroma vector storage is not implemented yet")
        case provider:
            raise ValueError(f"Unsupported vector storage provider: {provider}")
