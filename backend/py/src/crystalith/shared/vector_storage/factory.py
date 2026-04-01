from __future__ import annotations

from crystalith.shared.config import Settings

from .interfaces import VectorStore
from .memory import InMemoryVectorStore


def _is_local_host(host: str) -> bool:
    """Return True only when host is empty (meaning embedded Chroma).

    Any explicit host value — including localhost / 127.0.0.1 — is treated
    as a remote HTTP endpoint so that the lightweight ``chroma_http`` client
    is used instead of the heavy ``chromadb`` Python package.
    """
    return not host or not host.strip()


def create_vector_store(settings: Settings) -> VectorStore:
    match settings.vector_storage.provider:
        case "memory":
            return InMemoryVectorStore()
        case "chroma":
            host = settings.vector_storage.chroma.host
            if host and not _is_local_host(host):
                from .chroma_http import ChromaHttpVectorStore

                return ChromaHttpVectorStore(
                    host=host,
                    port=settings.vector_storage.chroma.port,
                )

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
        case provider:
            raise ValueError(f"Unsupported vector storage provider: {provider}")
