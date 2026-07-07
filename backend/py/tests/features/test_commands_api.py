from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_commands_lists_builtin_presets(client):
    resp = await client.get("/v1/commands")
    assert resp.status_code == 200
    items = resp.json()
    assert any(
        item["kind"] == "prompt_preset"
        and item["trigger"] == "/prompt:stats"
        and item["source"] == "builtin"
        and item["enabled"] is True
        for item in items
    )
