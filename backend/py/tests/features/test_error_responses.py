from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from crystalith.shared.db import Chunk, Source
from crystalith.shared.deps import get_ai_provider
from crystalith.shared.types import SourceStatus


class _RateLimitError(Exception):
    status_code = 429

    def __init__(self, retry_after: str = "5") -> None:
        self.response = type(
            "Response",
            (),
            {"status_code": 429, "headers": {"retry-after": retry_after}},
        )()
        super().__init__("rate limit")


class _FailingChatProvider:
    provider = "test"
    model = "failing"

    async def chat(self, messages):  # noqa: ANN001
        raise _RateLimitError("5")

    async def chat_stream(self, messages):  # noqa: ANN001
        if False:
            yield ""


@pytest.mark.asyncio
async def test_http_exception_response_is_standardized(client):
    resp = await client.post(
        "/v1/notebooks/99999/qa",
        json={"question": "what is this"},
    )

    assert resp.status_code == 404
    payload = resp.json()
    assert payload["error_code"] == "NOT_FOUND"
    assert payload["message"] == "Notebook not found"
    assert "details" not in payload or payload["details"] is None


@pytest.mark.asyncio
async def test_validation_error_response_is_standardized(client):
    resp = await client.post(
        "/v1/notebooks/1/qa",
        json={"question": ""},
    )

    assert resp.status_code == 422
    payload = resp.json()
    assert payload["error_code"] == "VALIDATION_ERROR"
    assert payload["message"] == "请求参数验证失败"
    assert isinstance(payload.get("details"), list)


@pytest.mark.asyncio
async def test_provider_rate_limit_includes_retry_after(db_session, app):
    transport = ASGITransport(app=app, raise_app_exceptions=False)

    async with AsyncClient(transport=transport, base_url="http://test") as http_client:
        create_resp = await http_client.post("/v1/notebooks", json={"name": "Error QA Notebook"})
        notebook_id = create_resp.json()["id"]

        source = Source(
            notebook_id=notebook_id,
            filename="Doc.md",
            status=SourceStatus.READY,
        )
        db_session.add(source)
        await db_session.flush()

        chunk = Chunk(source_id=source.id, chunk_index=1, text="Test chunk")
        db_session.add(chunk)
        await db_session.commit()

        await app.state.vector_store.add(
            notebook_id=notebook_id,
            source_id=source.id,
            chunk_ids=[chunk.id],
            vectors=[[1.0, 0.0, 0.0]],
        )

        app.dependency_overrides[get_ai_provider] = lambda: _FailingChatProvider()

        try:
            resp = await http_client.post(
                f"/v1/notebooks/{notebook_id}/qa",
                json={"question": "test", "source_ids": [source.id]},
            )
        finally:
            app.dependency_overrides.pop(get_ai_provider, None)

        assert resp.status_code == 429
        payload = resp.json()
        assert payload["error_code"] == "RATE_LIMITED"
        assert payload["message"] == "rate limit"
        assert payload["retry_after"] == 5
        assert resp.headers.get("Retry-After") == "5"
