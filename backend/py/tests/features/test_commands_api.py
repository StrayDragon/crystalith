from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_commands_lists_builtin_and_custom_presets(client):
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

    create_resp = await client.post(
        "/v1/prompt-presets",
        json={
            "trigger": "demo",
            "description": "Demo preset",
            "system_prompt": "Answer using bullet points.",
            "enabled": False,
        },
    )
    assert create_resp.status_code == 201

    resp2 = await client.get("/v1/commands")
    assert resp2.status_code == 200
    items2 = resp2.json()
    triggers = [item["trigger"] for item in items2]
    assert triggers == sorted(triggers)
    assert any(
        item["kind"] == "prompt_preset"
        and item["trigger"] == "/prompt:demo"
        and item["source"] == "custom"
        and item["enabled"] is False
        and item["description"] == "Demo preset"
        for item in items2
    )
