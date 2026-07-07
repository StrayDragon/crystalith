from __future__ import annotations

from crystalith.shared.config import Settings

from .interfaces import VectorStore


def create_vector_store(settings: Settings) -> VectorStore:
    try:
        from .chroma import ChromaVectorStore
    except ModuleNotFoundError as exc:  # pragma: no cover
        raise ValueError(
            "Chroma vector store requires the 'chromadb' dependency. "
            "Install it to use vector_storage.provider=chroma."
        ) from exc

    return ChromaVectorStore(
        path=settings.vector_storage.chroma.path,
        telemetry=settings.vector_storage.chroma.telemetry,
    )
