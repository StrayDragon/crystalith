from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_workspace_tools_and_config(client):
    tools_resp = await client.get("/v1/workspace/tools")
    assert tools_resp.status_code == 200
    tools_payload = tools_resp.json()
    assert tools_payload["tools"]
    assert tools_payload["tools"][0]["config_schema"] is not None

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


@pytest.mark.asyncio
async def test_tool_config_endpoint_matches_tools_config_schema(client):
    tools_resp = await client.get("/v1/workspace/tools")
    assert tools_resp.status_code == 200
    tools_payload = tools_resp.json()

    for tool in tools_payload["tools"]:
        tool_id = tool["id"]
        if tool_id == "slides":
            # `/v1/workspace/tools/slides/config` is reserved for the slides-specific
            # configuration endpoint.
            continue
        schema = tool.get("config_schema")
        assert schema is not None

        config_resp = await client.get(f"/v1/workspace/tools/{tool_id}/config")
        assert config_resp.status_code == 200
        config = config_resp.json()

        assert config["tool_id"] == tool_id
        assert config.get("topic_placeholder") == schema.get("topic_placeholder")
        assert config.get("supports_topic") == schema.get("supports_topic")
        assert (config.get("quantity_options") or []) == (schema.get("quantity_options") or [])
        assert (config.get("difficulty_options") or []) == (schema.get("difficulty_options") or [])
