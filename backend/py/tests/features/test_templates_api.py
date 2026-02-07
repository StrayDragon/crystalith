from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_builtin_templates_seeded(client) -> None:
    resp = await client.get("/v1/templates")
    assert resp.status_code == 200
    data = resp.json()
    names = {item["name"] for item in data}
    assert "论文研究" in names
    assert "项目文档" in names
    assert "知识收集" in names


@pytest.mark.asyncio
async def test_template_crud_and_create_notebook_from_template(client) -> None:
    create_resp = await client.post(
        "/v1/templates",
        json={
            "name": "My Template",
            "description": "Custom template for tests",
            "config_json": {
                "session_titles": ["Session A", "Session B"],
                "output_type": "FAQ",
                "source_tags": ["tag-a", "tag-b"],
            },
        },
    )
    assert create_resp.status_code == 201
    template_id = create_resp.json()["id"]

    list_resp = await client.get("/v1/templates")
    assert list_resp.status_code == 200
    assert any(item["id"] == template_id for item in list_resp.json())

    patch_resp = await client.patch(
        f"/v1/templates/{template_id}",
        json={"description": "Updated description"},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["description"] == "Updated description"

    create_notebook_resp = await client.post(
        f"/v1/notebooks?template_id={template_id}",
        json={"name": "Notebook From Template"},
    )
    assert create_notebook_resp.status_code == 201
    notebook_id = create_notebook_resp.json()["id"]

    sessions_resp = await client.get(f"/v1/notebooks/{notebook_id}/sessions")
    assert sessions_resp.status_code == 200
    session_titles = {item["title"] for item in sessions_resp.json() if item.get("title")}
    assert session_titles == {"Session A", "Session B"}

    tags_resp = await client.get(f"/v1/notebooks/{notebook_id}/sources/tags")
    assert tags_resp.status_code == 200
    tag_names = {item["name"] for item in tags_resp.json()}
    assert tag_names == {"tag-a", "tag-b"}

    delete_resp = await client.delete(f"/v1/templates/{template_id}")
    assert delete_resp.status_code == 204


@pytest.mark.asyncio
async def test_save_notebook_as_template(client) -> None:
    notebook_resp = await client.post("/v1/notebooks", json={"name": "Notebook To Save"})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()["id"]

    session_a = await client.post(
        f"/v1/notebooks/{notebook_id}/sessions",
        json={"title": "Alpha"},
    )
    assert session_a.status_code == 201
    session_b = await client.post(
        f"/v1/notebooks/{notebook_id}/sessions",
        json={"title": "Beta"},
    )
    assert session_b.status_code == 201

    tag_a = await client.post(
        f"/v1/notebooks/{notebook_id}/sources/tags",
        json={"name": "ToRead"},
    )
    assert tag_a.status_code == 201
    tag_b = await client.post(
        f"/v1/notebooks/{notebook_id}/sources/tags",
        json={"name": "Done"},
    )
    assert tag_b.status_code == 201

    save_resp = await client.post(
        f"/v1/notebooks/{notebook_id}/templates",
        json={
            "name": "Saved From Notebook",
            "description": "snapshot",
            "output_type": "GUIDE",
        },
    )
    assert save_resp.status_code == 201
    payload = save_resp.json()
    assert payload["name"] == "Saved From Notebook"
    assert payload["config_json"]["output_type"] == "GUIDE"
    assert set(payload["config_json"]["session_titles"]) == {"Alpha", "Beta"}
    assert set(payload["config_json"]["source_tags"]) == {"ToRead", "Done"}
