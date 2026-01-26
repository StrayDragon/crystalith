"""Tests for session conversion API endpoints."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from crystalith.tests_support import create_notebook, create_session


@pytest.mark.asyncio
async def test_convert_session_to_source_entire_session(test_client: AsyncClient) -> None:
    """Test converting an entire session to source."""
    notebook_id = await create_notebook(test_client)
    session_id = await create_session(test_client, notebook_id, "Test Session")

    # Add some messages
    await test_client.post(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/messages",
        json={"role": "user", "content": "What is machine learning?"},
    )
    await test_client.post(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/messages",
        json={"role": "assistant", "content": "Machine learning is a subset of AI."},
    )

    # Convert entire session to source
    response = await test_client.post(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/convert-to-source",
        json={"message_ids": None},
    )
    assert response.status_code == 201
    result = response.json()
    assert "source_id" in result
    assert "filename" in result
    assert result["chunk_count"] >= 1
    assert "对话" in result["filename"]

    # Verify source was created
    sources = await test_client.get(f"/v1/notebooks/{notebook_id}/sources")
    assert sources.status_code == 200
    source_ids = [s["id"] for s in sources.json()]
    assert result["source_id"] in source_ids


@pytest.mark.asyncio
async def test_convert_session_to_source_specific_messages(test_client: AsyncClient) -> None:
    """Test converting specific messages to source."""
    notebook_id = await create_notebook(test_client)
    session_id = await create_session(test_client, notebook_id)

    # Add messages
    msg1 = await test_client.post(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/messages",
        json={"role": "user", "content": "Question 1"},
    )
    msg2 = await test_client.post(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/messages",
        json={"role": "assistant", "content": "Answer 1"},
    )
    await test_client.post(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/messages",
        json={"role": "user", "content": "Question 2"},
    )

    msg1_id = msg1.json()["id"]
    msg2_id = msg2.json()["id"]

    # Convert only first two messages
    response = await test_client.post(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/convert-to-source",
        json={"message_ids": [msg1_id, msg2_id]},
    )
    assert response.status_code == 201
    result = response.json()
    assert result["chunk_count"] >= 1


@pytest.mark.asyncio
async def test_convert_empty_session_returns_400(test_client: AsyncClient) -> None:
    """Test that converting an empty session returns 400."""
    notebook_id = await create_notebook(test_client)
    session_id = await create_session(test_client, notebook_id)

    # Try to convert without any messages
    response = await test_client.post(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/convert-to-source",
        json={"message_ids": None},
    )
    assert response.status_code == 400
    assert "No messages" in response.json()["detail"]


@pytest.mark.asyncio
async def test_convert_with_invalid_message_ids_returns_404(test_client: AsyncClient) -> None:
    """Test that invalid message IDs return 404."""
    notebook_id = await create_notebook(test_client)
    session_id = await create_session(test_client, notebook_id)

    # Add a message
    msg = await test_client.post(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/messages",
        json={"role": "user", "content": "Hello"},
    )
    valid_msg_id = msg.json()["id"]

    # Try with a mix of valid and non-existent message ID
    response = await test_client.post(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/convert-to-source",
        json={"message_ids": [valid_msg_id, 99999]},
    )
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_convert_session_to_output_paragraph(test_client: AsyncClient) -> None:
    """Test converting session to PARAGRAPH output."""
    notebook_id = await create_notebook(test_client)
    session_id = await create_session(test_client, notebook_id, "Test Session")

    # Add messages
    await test_client.post(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/messages",
        json={"role": "user", "content": "What is Python?"},
    )
    await test_client.post(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/messages",
        json={"role": "assistant", "content": "Python is a programming language."},
    )

    # Convert to PARAGRAPH output
    response = await test_client.post(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/convert-to-output",
        json={"message_ids": None, "output_type": "PARAGRAPH"},
    )
    assert response.status_code == 201
    result = response.json()
    assert "output_id" in result
    assert result["output_type"] == "PARAGRAPH"
    assert "title" in result

    # Verify output was created
    outputs = await test_client.get(f"/v1/notebooks/{notebook_id}/outputs")
    assert outputs.status_code == 200
    output_ids = [o["id"] for o in outputs.json()]
    assert result["output_id"] in output_ids


@pytest.mark.asyncio
async def test_convert_session_to_output_bullets(test_client: AsyncClient) -> None:
    """Test converting session to BULLETS output."""
    notebook_id = await create_notebook(test_client)
    session_id = await create_session(test_client, notebook_id)

    # Add messages
    await test_client.post(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/messages",
        json={"role": "assistant", "content": "Point 1\nPoint 2\nPoint 3"},
    )

    response = await test_client.post(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/convert-to-output",
        json={"message_ids": None, "output_type": "BULLETS"},
    )
    assert response.status_code == 201
    result = response.json()
    assert result["output_type"] == "BULLETS"


@pytest.mark.asyncio
async def test_convert_session_to_output_structured(test_client: AsyncClient) -> None:
    """Test converting session to STRUCTURED output."""
    notebook_id = await create_notebook(test_client)
    session_id = await create_session(test_client, notebook_id)

    await test_client.post(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/messages",
        json={"role": "assistant", "content": "Structured content here"},
    )

    response = await test_client.post(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/convert-to-output",
        json={"message_ids": None, "output_type": "STRUCTURED"},
    )
    assert response.status_code == 201
    result = response.json()
    assert result["output_type"] == "STRUCTURED"


@pytest.mark.asyncio
async def test_convert_empty_session_to_output_returns_400(test_client: AsyncClient) -> None:
    """Test that converting an empty session to output returns 400."""
    notebook_id = await create_notebook(test_client)
    session_id = await create_session(test_client, notebook_id)

    response = await test_client.post(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/convert-to-output",
        json={"message_ids": None, "output_type": "PARAGRAPH"},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_convert_nonexistent_session_returns_404(test_client: AsyncClient) -> None:
    """Test that converting nonexistent session returns 404."""
    notebook_id = await create_notebook(test_client)

    response = await test_client.post(
        f"/v1/notebooks/{notebook_id}/sessions/99999/convert-to-source",
        json={"message_ids": None},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_convert_preserves_citation_chunk_ids(test_client: AsyncClient) -> None:
    """Test that conversion preserves citation chunk IDs in output when present."""
    notebook_id = await create_notebook(test_client)
    session_id = await create_session(test_client, notebook_id)

    # Add user message first
    await test_client.post(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/messages",
        json={"role": "user", "content": "What is the answer?"},
    )

    # Add assistant message with citations (full Citation schema)
    msg_response = await test_client.post(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/messages",
        json={
            "role": "assistant",
            "content": "Answer with citations that reference important sources.",
            "citations": [
                {
                    "source_id": 1,
                    "source_name": "test.md",
                    "chunk_id": 1,
                    "chunk_index": 0,
                    "snippet": "citation 1",
                },
                {
                    "source_id": 1,
                    "source_name": "test.md",
                    "chunk_id": 2,
                    "chunk_index": 1,
                    "snippet": "citation 2",
                },
            ],
        },
    )
    assert msg_response.status_code == 201
    msg_data = msg_response.json()

    # Verify the message was created with citations
    assert msg_data["citations"] is not None
    assert len(msg_data["citations"]) == 2

    response = await test_client.post(
        f"/v1/notebooks/{notebook_id}/sessions/{session_id}/convert-to-output",
        json={"message_ids": None, "output_type": "PARAGRAPH"},
    )
    assert response.status_code == 201

    # Verify the output was created
    output_id = response.json()["output_id"]
    output = await test_client.get(f"/v1/notebooks/{notebook_id}/outputs/{output_id}")
    assert output.status_code == 200
    output_data = output.json()

    # Verify chunk_ids were extracted from citations
    assert output_data["chunk_ids"] is not None
    assert 1 in output_data["chunk_ids"]
    assert 2 in output_data["chunk_ids"]
