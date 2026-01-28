"""Integration smoke tests for common frontend-backend workflows."""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from pydantic_ai import models
from pydantic_ai.models.test import TestModel

from crystalith.agents import output_graph
from crystalith.config import Settings
from crystalith.outputs import OutputType


@pytest.fixture(autouse=True)
def _mock_agent_model(monkeypatch) -> None:
    """Mock the agent model for all tests in this module."""
    models.ALLOW_MODEL_REQUESTS = False
    test_model = TestModel()
    monkeypatch.setattr(output_graph, "build_chat_model", lambda _settings: test_model)


async def create_notebook(client: AsyncClient, name: str = "Test Notebook") -> int:
    response = await client.post("/v1/notebooks", json={"name": name})
    assert response.status_code == 201
    return response.json()["id"]


async def upload_source(
    client: AsyncClient,
    notebook_id: int,
    content: bytes = b"hello world test content",
    filename: str = "test.md",
) -> int:
    upload = await client.post(
        f"/v1/notebooks/{notebook_id}/sources",
        files={"file": (filename, content, "text/markdown")},
    )
    assert upload.status_code == 201
    return upload.json()["id"]


async def create_session(client: AsyncClient, notebook_id: int) -> int:
    response = await client.post(f"/v1/notebooks/{notebook_id}/sessions", json={})
    assert response.status_code == 201
    return response.json()["id"]


@pytest.mark.asyncio
async def test_end_to_end_notebook_flow(
    test_client: AsyncClient,
    test_settings: Settings,
) -> None:
    openapi = await test_client.get(test_settings.app.openapi_path)
    assert openapi.status_code == 200
    assert "paths" in openapi.json()

    notebook_id = await create_notebook(test_client)
    source_id = await upload_source(test_client, notebook_id)

    sources_response = await test_client.get(f"/v1/notebooks/{notebook_id}/sources")
    assert sources_response.status_code == 200
    assert len(sources_response.json()) == 1

    session_id = await create_session(test_client, notebook_id)
    qa_response = await test_client.post(
        f"/v1/notebooks/{notebook_id}/qa",
        json={"question": "What is the content about?", "session_id": session_id},
    )
    assert qa_response.status_code == 200
    qa_payload = qa_response.json()
    assert qa_payload["evidence"] is True
    assert qa_payload["answer"]
    assert qa_payload["citations"]

    messages_response = await test_client.get(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/messages"
    )
    assert messages_response.status_code == 200
    assert len(messages_response.json()) == 2

    output_response = await test_client.post(
        f"/v1/notebooks/{notebook_id}/outputs/{OutputType.FAQ.value}",
        json={"prompt": "Generate FAQ from sources"},
    )
    assert output_response.status_code == 201
    output_payload = output_response.json()
    assert output_payload["type"] == OutputType.FAQ.value

    outputs_response = await test_client.get(f"/v1/notebooks/{notebook_id}/outputs")
    assert outputs_response.status_code == 200
    assert any(o["id"] == output_payload["id"] for o in outputs_response.json())

    refine_response = await test_client.post(
        f"/v1/notebooks/{notebook_id}/refine/batch",
        json={"prompt": "Summarize", "formats": ["paragraph", "bullets"]},
    )
    assert refine_response.status_code == 200
    refine_payload = refine_response.json()
    assert refine_payload["evidence"] is True
    assert refine_payload["outputs"]

    delete_response = await test_client.request(
        "DELETE",
        f"/v1/notebooks/{notebook_id}/sources",
        json={"source_ids": [source_id]},
    )
    assert delete_response.status_code == 200
    assert delete_response.json()["deleted_count"] == 1

    invalid_output = await test_client.post(
        f"/v1/notebooks/{notebook_id}/outputs/INVALID_TYPE",
        json={"prompt": "test"},
    )
    assert invalid_output.status_code == 422

    not_found = await test_client.post(
        "/v1/notebooks/99999/qa",
        json={"question": "test"},
    )
    assert not_found.status_code == 404

    empty_notebook_id = await create_notebook(test_client, "Empty Notebook")
    empty_qa = await test_client.post(
        f"/v1/notebooks/{empty_notebook_id}/qa",
        json={"question": "What is this about?"},
    )
    assert empty_qa.status_code == 200
    empty_payload = empty_qa.json()
    assert empty_payload["evidence"] is False
    assert empty_payload["citations"] == []
