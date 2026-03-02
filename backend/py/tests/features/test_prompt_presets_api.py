from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_prompt_presets_list_includes_builtin(client):
    resp = await client.get("/v1/prompt-presets")
    assert resp.status_code == 200
    items = resp.json()
    assert any(item["trigger"] == "stats" and item["source"] == "builtin" for item in items)


@pytest.mark.asyncio
async def test_prompt_presets_crud_roundtrip(client):
    create_resp = await client.post(
        "/v1/prompt-presets",
        json={
            "trigger": "Demo",
            "description": "Demo preset",
            "system_prompt": "Answer using bullet points.",
            "enabled": True,
        },
    )
    assert create_resp.status_code == 201
    created = create_resp.json()
    assert created["source"] == "custom"
    assert created["trigger"] == "demo"
    preset_id = created["preset_id"]
    assert isinstance(preset_id, int)

    list_resp = await client.get("/v1/prompt-presets")
    assert list_resp.status_code == 200
    items = list_resp.json()
    assert any(item["trigger"] == "demo" and item["source"] == "custom" for item in items)

    update_resp = await client.patch(
        f"/v1/prompt-presets/{preset_id}",
        json={"enabled": False, "description": "Updated"},
    )
    assert update_resp.status_code == 200
    updated = update_resp.json()
    assert updated["enabled"] is False
    assert updated["description"] == "Updated"

    delete_resp = await client.delete(f"/v1/prompt-presets/{preset_id}")
    assert delete_resp.status_code == 204

    list_after = await client.get("/v1/prompt-presets")
    assert list_after.status_code == 200
    assert not any(item["source"] == "custom" and item["trigger"] == "demo" for item in list_after.json())


@pytest.mark.asyncio
async def test_prompt_presets_conflicts_and_not_found(client):
    conflict_resp = await client.post(
        "/v1/prompt-presets",
        json={
            "trigger": "stats",
            "description": "Conflict with builtin",
            "system_prompt": "Answer using bullet points.",
            "enabled": True,
        },
    )
    assert conflict_resp.status_code == 409

    create_resp = await client.post(
        "/v1/prompt-presets",
        json={
            "trigger": "dup",
            "description": None,
            "system_prompt": "Answer using bullet points.",
            "enabled": True,
        },
    )
    assert create_resp.status_code == 201
    preset_id = create_resp.json()["preset_id"]

    duplicate_resp = await client.post(
        "/v1/prompt-presets",
        json={
            "trigger": "dup",
            "description": None,
            "system_prompt": "Answer using bullet points.",
            "enabled": True,
        },
    )
    assert duplicate_resp.status_code == 409

    rename_conflict = await client.patch(f"/v1/prompt-presets/{preset_id}", json={"trigger": "stats"})
    assert rename_conflict.status_code == 409

    missing_update = await client.patch("/v1/prompt-presets/999999", json={"enabled": False})
    assert missing_update.status_code == 404

    missing_delete = await client.delete("/v1/prompt-presets/999999")
    assert missing_delete.status_code == 404
