from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_error_envelope_shape_for_not_found(client):
    resp = await client.get("/v1/notebooks/999999")

    assert resp.status_code == 404
    payload = resp.json()
    assert payload["error_code"] == "NOT_FOUND"
    assert isinstance(payload.get("message"), str)
    assert "details" not in payload or payload["details"] is None
