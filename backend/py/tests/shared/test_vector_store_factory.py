from __future__ import annotations

import sys

import pytest

from crystalith.shared.vector_storage import create_vector_store
from crystalith.shared.vector_storage.chroma_http import ChromaHttpVectorStore


@pytest.mark.asyncio
async def test_create_vector_store_uses_http_when_chroma_host_is_remote(app):
    settings = app.state.settings.model_copy(deep=True)
    settings.vector_storage.provider = "chroma"  # type: ignore[assignment]
    settings.vector_storage.chroma.host = "chromadb"
    settings.vector_storage.chroma.port = 8000

    chroma_module = sys.modules.pop("crystalith.shared.vector_storage.chroma", None)
    chromadb_module = sys.modules.pop("chromadb", None)

    try:
        store = create_vector_store(settings)
        assert isinstance(store, ChromaHttpVectorStore)
        assert "chromadb" not in sys.modules
        assert "crystalith.shared.vector_storage.chroma" not in sys.modules
    finally:
        if chroma_module is not None:
            sys.modules["crystalith.shared.vector_storage.chroma"] = chroma_module
        if chromadb_module is not None:
            sys.modules["chromadb"] = chromadb_module
