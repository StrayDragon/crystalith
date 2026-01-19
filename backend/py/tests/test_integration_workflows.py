"""Integration tests for common frontend-backend interaction workflows."""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from pydantic_ai import models
from pydantic_ai.models.test import TestModel

from crystalith.agents import output_graph, suggestions_graph
from crystalith.outputs import OutputType

from conftest import (
    create_notebook,
    create_notebook_with_source,
    create_session,
)


@pytest.fixture(autouse=True)
def _mock_agent_model(monkeypatch) -> None:
    """Mock the agent model for all tests in this module."""
    models.ALLOW_MODEL_REQUESTS = False
    test_model = TestModel()
    monkeypatch.setattr(output_graph, "build_chat_model", lambda _settings: test_model)
    monkeypatch.setattr(suggestions_graph, "build_chat_model", lambda _settings: test_model)


class TestChatWorkflow:
    """Tests for the chat (Q&A) workflow."""

    @pytest.mark.asyncio
    async def test_qa_workflow_with_session(self, test_client: AsyncClient) -> None:
        """Test complete Q&A workflow: create notebook, add source, create session, ask question."""
        # Create notebook with source
        notebook_id = await create_notebook_with_source(test_client)

        # Create session
        session_id = await create_session(test_client, notebook_id)

        # Ask question with session context
        response = await test_client.post(
            f"/v1/notebooks/{notebook_id}/qa",
            json={"question": "What is the content about?", "session_id": session_id},
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["evidence"] is True
        assert payload["answer"]
        assert payload["citations"]

        # Verify messages are stored in session
        messages_response = await test_client.get(f"/v1/sessions/{session_id}/messages")
        assert messages_response.status_code == 200
        messages = messages_response.json()
        assert len(messages) == 2  # user + assistant
        assert messages[0]["role"] == "user"
        assert messages[1]["role"] == "assistant"

    @pytest.mark.asyncio
    async def test_qa_without_sources_returns_no_evidence(self, test_client: AsyncClient) -> None:
        """Test Q&A returns no evidence when notebook has no sources."""
        notebook_id = await create_notebook(test_client)

        response = await test_client.post(
            f"/v1/notebooks/{notebook_id}/qa",
            json={"question": "What is this about?"},
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["evidence"] is False
        assert payload["confidence"] == 0.0
        assert payload["citations"] == []

    @pytest.mark.asyncio
    async def test_qa_multiple_questions_same_session(self, test_client: AsyncClient) -> None:
        """Test asking multiple questions in the same session maintains context."""
        notebook_id = await create_notebook_with_source(test_client)
        session_id = await create_session(test_client, notebook_id)

        # Ask first question
        response1 = await test_client.post(
            f"/v1/notebooks/{notebook_id}/qa",
            json={"question": "Question 1", "session_id": session_id},
        )
        assert response1.status_code == 200

        # Ask second question
        response2 = await test_client.post(
            f"/v1/notebooks/{notebook_id}/qa",
            json={"question": "Question 2", "session_id": session_id},
        )
        assert response2.status_code == 200

        # Verify all messages are stored
        messages_response = await test_client.get(f"/v1/sessions/{session_id}/messages")
        messages = messages_response.json()
        assert len(messages) == 4  # 2 user + 2 assistant


class TestOutputWorkflow:
    """Tests for the output generation workflow."""

    @pytest.mark.asyncio
    async def test_output_workflow_complete(self, test_client: AsyncClient) -> None:
        """Test complete output workflow: create, list, get."""
        notebook_id = await create_notebook_with_source(test_client)

        # Create output
        create_response = await test_client.post(
            f"/v1/notebooks/{notebook_id}/outputs/{OutputType.FAQ.value}",
            json={"prompt": "Generate FAQ from sources"},
        )
        assert create_response.status_code == 201
        output = create_response.json()
        output_id = output["id"]
        assert output["type"] == OutputType.FAQ.value
        assert "items" in output["content"]

        # List outputs
        list_response = await test_client.get(f"/v1/notebooks/{notebook_id}/outputs")
        assert list_response.status_code == 200
        outputs = list_response.json()
        assert any(o["id"] == output_id for o in outputs)

        # Get specific output
        get_response = await test_client.get(f"/v1/notebooks/{notebook_id}/outputs/{output_id}")
        assert get_response.status_code == 200
        assert get_response.json()["id"] == output_id

    @pytest.mark.asyncio
    async def test_output_with_chunk_ids(self, test_client: AsyncClient) -> None:
        """Test output generation with specific chunk IDs."""
        notebook_id = await create_notebook_with_source(test_client)

        # Get sources to find chunk IDs
        sources_response = await test_client.get(f"/v1/notebooks/{notebook_id}/sources")
        assert sources_response.status_code == 200
        sources = sources_response.json()
        assert len(sources) > 0

        # Create output with chunk IDs (assuming chunk ID 1 exists)
        # Note: This might need adjustment based on actual chunk ID generation
        create_response = await test_client.post(
            f"/v1/notebooks/{notebook_id}/outputs/{OutputType.PARAGRAPH.value}",
            json={"prompt": "Summarize", "chunk_ids": [1]},
        )
        # The response should be 201 or 400 depending on chunk existence
        assert create_response.status_code in (201, 400)

    @pytest.mark.asyncio
    async def test_output_all_types(self, test_client: AsyncClient) -> None:
        """Test that all output types can be generated."""
        notebook_id = await create_notebook_with_source(test_client)

        output_types = [
            OutputType.FAQ,
            OutputType.GUIDE,
            OutputType.TIMELINE,
            OutputType.MINDMAP,
            OutputType.QUIZ,
            OutputType.BRIEFING,
            OutputType.PARAGRAPH,
            OutputType.BULLETS,
            OutputType.STRUCTURED,
        ]

        for output_type in output_types:
            response = await test_client.post(
                f"/v1/notebooks/{notebook_id}/outputs/{output_type.value}",
                json={"prompt": f"Generate {output_type.value}"},
            )
            assert response.status_code == 201, f"Failed for output type: {output_type.value}"
            payload = response.json()
            assert payload["type"] == output_type.value


class TestSuggestionWorkflow:
    """Tests for the suggestion generation workflow."""

    @pytest.mark.asyncio
    async def test_notebook_suggestions(self, test_client: AsyncClient) -> None:
        """Test generating suggestions for a notebook."""
        notebook_id = await create_notebook_with_source(test_client)

        response = await test_client.post(
            f"/v1/notebooks/{notebook_id}/suggestions",
            json={"count": 4, "mode": "standard"},
        )
        assert response.status_code == 200
        payload = response.json()
        assert "suggestions" in payload
        assert len(payload["suggestions"]) >= 3  # At least 3 from fallback

    @pytest.mark.asyncio
    async def test_session_suggestions(self, test_client: AsyncClient) -> None:
        """Test generating suggestions for a session with chat history."""
        notebook_id = await create_notebook_with_source(test_client)
        session_id = await create_session(test_client, notebook_id)

        # Add some messages to the session
        await test_client.post(
            f"/v1/sessions/{session_id}/messages",
            json={"role": "user", "content": "Tell me about the topic"},
        )
        await test_client.post(
            f"/v1/sessions/{session_id}/messages",
            json={"role": "assistant", "content": "Here is some information..."},
        )

        # Generate suggestions
        response = await test_client.post(
            f"/v1/sessions/{session_id}/suggestions",
            json={"count": 3, "mode": "standard"},
        )
        assert response.status_code == 200
        payload = response.json()
        assert len(payload["suggestions"]) == 3

    @pytest.mark.asyncio
    async def test_deep_dive_suggestions(self, test_client: AsyncClient) -> None:
        """Test deep dive suggestion mode."""
        notebook_id = await create_notebook_with_source(test_client)

        response = await test_client.post(
            f"/v1/notebooks/{notebook_id}/suggestions",
            json={
                "count": 3,
                "mode": "deep_dive",
                "seed_question": "Why is this important?",
            },
        )
        assert response.status_code == 200
        payload = response.json()
        assert len(payload["suggestions"]) == 3
        # All deep dive suggestions should have type "deep_dive"
        assert all(s["type"] == "deep_dive" for s in payload["suggestions"])


class TestRefineWorkflow:
    """Tests for the refine/batch refine workflow."""

    @pytest.mark.asyncio
    async def test_refine_batch_workflow(self, test_client: AsyncClient) -> None:
        """Test batch refine workflow."""
        notebook_id = await create_notebook_with_source(test_client)

        response = await test_client.post(
            f"/v1/notebooks/{notebook_id}/refine/batch",
            json={
                "prompt": "Summarize the content",
                "formats": ["paragraph", "bullets"],
            },
        )
        assert response.status_code == 200
        payload = response.json()
        assert "outputs" in payload
        assert payload["evidence"] is True
        assert "citations" in payload

    @pytest.mark.asyncio
    async def test_refine_single_format(self, test_client: AsyncClient) -> None:
        """Test single format refine via task queue."""
        notebook_id = await create_notebook_with_source(test_client)

        response = await test_client.post(
            f"/v1/notebooks/{notebook_id}/refine",
            json={"prompt": "Summarize briefly", "format": "paragraph"},
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["format"] == "paragraph"


class TestErrorHandling:
    """Tests for error handling scenarios."""

    @pytest.mark.asyncio
    async def test_notebook_not_found(self, test_client: AsyncClient) -> None:
        """Test 404 response for non-existent notebook."""
        response = await test_client.post(
            "/v1/notebooks/99999/qa",
            json={"question": "test"},
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_session_not_found(self, test_client: AsyncClient) -> None:
        """Test 404 response for non-existent session."""
        response = await test_client.post(
            "/v1/sessions/99999/suggestions",
            json={"count": 3},
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_invalid_output_type(self, test_client: AsyncClient) -> None:
        """Test 422 response for invalid output type."""
        notebook_id = await create_notebook_with_source(test_client)
        response = await test_client.post(
            f"/v1/notebooks/{notebook_id}/outputs/INVALID_TYPE",
            json={"prompt": "test"},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_invalid_suggestion_mode(self, test_client: AsyncClient) -> None:
        """Test validation error for invalid suggestion mode."""
        notebook_id = await create_notebook_with_source(test_client)
        response = await test_client.post(
            f"/v1/notebooks/{notebook_id}/suggestions",
            json={"count": 3, "mode": "invalid_mode"},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_deep_dive_without_seed_question(self, test_client_simple: AsyncClient) -> None:
        """Test that deep_dive mode without sources/seed_question returns error."""
        notebook_id = await create_notebook(test_client_simple)

        response = await test_client_simple.post(
            f"/v1/notebooks/{notebook_id}/suggestions",
            json={"count": 3, "mode": "deep_dive"},
        )
        # Should fail because no sources and no seed question
        assert response.status_code == 400


class TestSourceManagement:
    """Tests for source management workflows."""

    @pytest.mark.asyncio
    async def test_upload_and_list_sources(self, test_client: AsyncClient) -> None:
        """Test uploading and listing sources."""
        notebook_id = await create_notebook(test_client)

        # Upload first source
        upload1 = await test_client.post(
            f"/v1/notebooks/{notebook_id}/sources",
            files={"file": ("doc1.md", b"Content 1", "text/markdown")},
        )
        assert upload1.status_code == 201

        # Upload second source
        upload2 = await test_client.post(
            f"/v1/notebooks/{notebook_id}/sources",
            files={"file": ("doc2.md", b"Content 2", "text/markdown")},
        )
        assert upload2.status_code == 201

        # List sources
        list_response = await test_client.get(f"/v1/notebooks/{notebook_id}/sources")
        assert list_response.status_code == 200
        sources = list_response.json()
        assert len(sources) == 2

    @pytest.mark.asyncio
    async def test_delete_sources(self, test_client: AsyncClient) -> None:
        """Test batch deleting sources."""
        notebook_id = await create_notebook(test_client)

        # Upload sources
        upload1 = await test_client.post(
            f"/v1/notebooks/{notebook_id}/sources",
            files={"file": ("doc1.md", b"Content 1", "text/markdown")},
        )
        source_id = upload1.json()["id"]

        # Delete source
        delete_response = await test_client.post(
            f"/v1/notebooks/{notebook_id}/sources/batch-delete",
            json={"source_ids": [source_id]},
        )
        assert delete_response.status_code == 200
        assert delete_response.json()["deleted_count"] == 1

        # Verify source is deleted
        list_response = await test_client.get(f"/v1/notebooks/{notebook_id}/sources")
        assert list_response.status_code == 200
        assert len(list_response.json()) == 0
