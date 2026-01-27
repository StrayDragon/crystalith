from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_qa_no_sources(client):
    create_resp = await client.post("/v1/notebooks", json={"name": "QA Notebook"})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()["id"]

    resp = await client.post(
        f"/v1/notebooks/{notebook_id}/qa",
        json={"question": "什么是测试？"},
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["answer"] == "来源中未找到相关证据"
    assert payload["evidence"] is False
