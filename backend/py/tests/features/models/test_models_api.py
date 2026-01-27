from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_models_list(client):
    resp = await client.get("/v1/models")
    assert resp.status_code == 200
    payload = resp.json()
    assert "models" in payload
