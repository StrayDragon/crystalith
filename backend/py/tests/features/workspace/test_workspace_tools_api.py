from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_workspace_tools_and_config(client):
    tools_resp = await client.get("/v1/workspace/tools")
    assert tools_resp.status_code == 200
    tools_payload = tools_resp.json()
    assert tools_payload["tools"]

    tool_id = tools_payload["tools"][0]["id"]
    config_resp = await client.get(f"/v1/workspace/tools/{tool_id}/config")
    assert config_resp.status_code == 200
    config_payload = config_resp.json()
    assert config_payload["tool_id"] == tool_id


@pytest.mark.asyncio
async def test_workspace_slides_config(client):
    resp = await client.get("/v1/workspace/tools/slides/config")
    assert resp.status_code == 200
    payload = resp.json()
    assert "defaults" in payload
    assert payload["quantity_options"]
