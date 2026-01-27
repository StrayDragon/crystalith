from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_refine_not_found(client):
    resp = await client.post(
        "/v1/notebooks/9999/refine",
        json={"prompt": "test"},
    )
    assert resp.status_code == 404
