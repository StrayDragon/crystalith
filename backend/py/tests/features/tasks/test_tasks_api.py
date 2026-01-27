from __future__ import annotations

import pytest

from crystalith.shared.db import Task
from crystalith.shared.types import TaskStatus, TaskType


@pytest.mark.asyncio
async def test_tasks_list_and_get(client, db_session):
    create_resp = await client.post("/v1/notebooks", json={"name": "Task Notebook"})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()["id"]

    task = Task(
        notebook_id=notebook_id,
        type=TaskType.REFINE,
        status=TaskStatus.PENDING,
        payload={"prompt": "Hello"},
    )
    db_session.add(task)
    await db_session.commit()
    await db_session.refresh(task)

    list_resp = await client.get(f"/v1/notebooks/{notebook_id}/tasks")
    assert list_resp.status_code == 200
    payload = list_resp.json()
    assert len(payload) == 1
    assert payload[0]["id"] == task.id
    assert payload[0]["type"] == TaskType.REFINE.value

    get_resp = await client.get(f"/v1/tasks/{task.id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == task.id


@pytest.mark.asyncio
async def test_tasks_not_found(client):
    resp = await client.get("/v1/tasks/9999")
    assert resp.status_code == 404
