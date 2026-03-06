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
async def test_workspace_slides_config_comes_from_unified_tool_config(client):
    tools_resp = await client.get("/v1/workspace/tools")
    assert tools_resp.status_code == 200
    tools_payload = tools_resp.json()

    slides_tool = next(tool for tool in tools_payload["tools"] if tool["output_type"] == "SLIDES")

    resp = await client.get("/v1/workspace/tools/slides/config")
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["tool_id"] == "slides"
    assert payload["defaults"] == slides_tool["config_schema"]["defaults"]
    assert payload["engine"] == slides_tool["config_schema"]["engine"]
    assert payload["preview"] == slides_tool["config_schema"]["preview"]
    assert payload["quantity_options"] == slides_tool["config_schema"]["quantity_options"]


@pytest.mark.asyncio
async def test_tool_config_endpoint_matches_tools_config_schema(client):
    tools_resp = await client.get("/v1/workspace/tools")
    assert tools_resp.status_code == 200
    tools_payload = tools_resp.json()

    for tool in tools_payload["tools"]:
        tool_id = tool["id"]
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



@pytest.mark.asyncio
async def test_workspace_tools_reports_slides_unavailable_diagnostics(client, app) -> None:
    from crystalith.shared.plugins import PluginRegistry

    original_plugins = app.state.plugins
    app.state.plugins = PluginRegistry()
    try:
        resp = await client.get("/v1/workspace/tools")
    finally:
        app.state.plugins = original_plugins

    assert resp.status_code == 200
    payload = resp.json()
    assert all(tool["output_type"] != "SLIDES" for tool in payload["tools"])
    assert payload["diagnostics"]["slides"]["error_code"] == "slides_plugin_required"
    assert payload["diagnostics"]["official"]["slides-slidev"]["status"] == "not_installed"


@pytest.mark.asyncio
async def test_workspace_slides_config_returns_structured_detail_when_unavailable(client, app) -> None:
    from crystalith.shared.plugins import PluginRegistry

    original_plugins = app.state.plugins
    app.state.plugins = PluginRegistry()
    try:
        resp = await client.get("/v1/workspace/tools/slides/config")
    finally:
        app.state.plugins = original_plugins

    assert resp.status_code == 404
    payload = resp.json(); payload = payload.get("detail", payload)
    assert payload["error_code"] == "slides_plugin_required"
    assert "hint" in payload
    assert payload["details"]["available_plugin_ids"] == []
