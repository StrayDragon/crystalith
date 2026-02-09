from __future__ import annotations

import asyncio
import time
from typing import Any

import pytest

from crystalith.features.tasks.queue import TaskQueue
from crystalith.shared.types import TaskStatus, TaskType


@pytest.mark.asyncio
async def test_task_queue_does_not_create_waiters_until_waited(app):
    async def _worker(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
        return {}

    queue = TaskQueue(
        db_manager=app.state.db,
        settings=app.state.settings,
        vector_store=app.state.vector_store,
        plugins=app.state.plugins,
        worker=_worker,
    )

    for _ in range(5):
        await queue.enqueue(TaskType.REFINE, {"prompt": "hello"}, notebook_id=None)

    assert queue._waiters == {}


@pytest.mark.asyncio
async def test_stop_worker_cancels_in_flight_tasks(app):
    started = asyncio.Event()

    async def _slow_worker(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
        started.set()
        await asyncio.sleep(60)
        return {"ok": True}

    queue = TaskQueue(
        db_manager=app.state.db,
        settings=app.state.settings,
        vector_store=app.state.vector_store,
        plugins=app.state.plugins,
        worker=_slow_worker,
    )

    await queue.start_worker(concurrency=1)
    task_id = await queue.enqueue(TaskType.REFINE, {"prompt": "hello"}, notebook_id=None)

    await asyncio.wait_for(started.wait(), timeout=2.0)

    deadline = time.monotonic() + 2.0
    status = await queue.get_status(task_id)
    while status.status != TaskStatus.RUNNING and time.monotonic() < deadline:
        await asyncio.sleep(0.01)
        status = await queue.get_status(task_id)

    assert status.status == TaskStatus.RUNNING

    await queue.stop_worker()

    assert queue._in_flight == set()
    assert queue._worker_task is None

    final = await queue.get_status(task_id)
    assert final.status == TaskStatus.CANCELLED
