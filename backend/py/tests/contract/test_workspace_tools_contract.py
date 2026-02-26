from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_workspace_tools_response_shape(client):
    resp = await client.get("/v1/workspace/tools")
    assert resp.status_code == 200
    payload = resp.json()

    tools = payload.get("tools")
    assert isinstance(tools, list)
    assert tools, "Expected at least one workspace tool"

    tool = tools[0]
    assert isinstance(tool.get("id"), str) and tool["id"]
    assert isinstance(tool.get("label"), str) and tool["label"]
    assert isinstance(tool.get("description"), str)
    assert isinstance(tool.get("tone"), str)
    assert "output_type" in tool
    assert isinstance(tool.get("prompt"), str)

    assert "render_descriptor" in tool
    assert "config_schema" in tool
