from __future__ import annotations

from httpx import AsyncClient

from .config import ModelConfig, ModelDefaults, ModelsSettings


def create_test_models() -> ModelsSettings:
    """Create default models configuration for tests."""
    return ModelsSettings(
        defaults=ModelDefaults(
            chat="test-chat",
            embedding="test-embed",
        ),
        available=[
            ModelConfig(
                id="test-chat",
                provider="openai",
                model="gpt-4o-mini",
                display_name="Test Chat",
                roles=["chat"],
                provider_config={
                    "api_key": "test-api-key",
                    "base_url": "https://api.openai.com/v1",
                },
            ),
            ModelConfig(
                id="test-embed",
                provider="ollama",
                model="bge-m3",
                display_name="Test Embed",
                roles=["embed"],
                provider_config={
                    "host": "http://localhost:11434",
                },
            ),
        ],
    )


async def create_notebook(client: AsyncClient, name: str = "Test Notebook") -> int:
    """Helper to create a notebook and return its ID."""
    response = await client.post("/v1/notebooks", json={"name": name})
    response.raise_for_status()
    return response.json()["id"]


async def create_notebook_with_source(
    client: AsyncClient,
    name: str = "Test Notebook",
    source_content: bytes = b"hello world test content",
    source_filename: str = "test.md",
) -> int:
    """Helper to create a notebook with a source and return the notebook ID."""
    notebook_id = await create_notebook(client, name)
    upload = await client.post(
        f"/v1/notebooks/{notebook_id}/sources",
        files={"file": (source_filename, source_content, "text/markdown")},
    )
    upload.raise_for_status()
    return notebook_id


async def create_session(client: AsyncClient, notebook_id: int, title: str | None = None) -> int:
    """Helper to create a session and return its ID."""
    response = await client.post(
        f"/v1/notebooks/{notebook_id}/sessions",
        json={"title": title} if title else {},
    )
    response.raise_for_status()
    return response.json()["id"]
