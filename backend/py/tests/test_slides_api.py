from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_slides_draft_generation_config_roundtrip(test_client: AsyncClient) -> None:
    create = await test_client.post("/v1/notebooks", json={"name": "Slides"})
    assert create.status_code == 201
    notebook_id = create.json()["id"]

    payload = {
        "title": "演示主题",
        "prompt": "生成演示",
        "generation_config": {
            "quantity": "short",
            "audience": "executive",
            "structure": "story",
            "tone": "inspiring",
            "language": "en",
            "density": "dense",
            "theme_preset": "business-brief",
            "frontmatter": "theme: custom\ntransition: zoom",
        },
    }

    response = await test_client.post(
        f"/v1/notebooks/{notebook_id}/slides/drafts",
        json=payload,
    )
    assert response.status_code == 201
    draft = response.json()
    assert draft["generation_config"]["quantity"] == "short"
    assert draft["generation_config"]["theme_preset"] == "business-brief"
    assert "frontmatter" in draft["generation_config"]

    update = await test_client.patch(
        f"/v1/notebooks/{notebook_id}/slides/drafts/{draft['id']}",
        json={"generation_config": {"quantity": "detailed", "theme_preset": "creative-visual"}},
    )
    assert update.status_code == 200
    updated = update.json()
    assert updated["generation_config"]["quantity"] == "detailed"
    assert updated["generation_config"]["theme_preset"] == "creative-visual"
