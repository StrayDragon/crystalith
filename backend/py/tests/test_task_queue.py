from __future__ import annotations

from collections.abc import AsyncGenerator

import asyncio

import pytest
import pytest_asyncio
from sqlalchemy.pool import StaticPool

from crystalith.config import DatabaseSettings, Settings
from crystalith.db import create_all, create_db_manager
from crystalith.tasks import TaskQueue, TaskStatus, TaskType
from crystalith.vector_storage import InMemoryVectorStore

from crystalith.tests_support import create_test_models


@pytest_asyncio.fixture
async def task_queue() -> AsyncGenerator[TaskQueue, None]:
    settings = Settings(database=DatabaseSettings(url="sqlite+aiosqlite:///:memory:"))
    manager = create_db_manager(
        settings.database.url,
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    await create_all(manager.async_engine)
    vector_store = InMemoryVectorStore()

    async def worker(
        task,
        session,
        _settings,
        _vector_store,
        _embedder_factory,
        _chat_factory,
    ) -> dict:
        return {"ok": True, "payload": task.payload}

    queue = TaskQueue(
        db_manager=manager,
        settings=settings,
        vector_store=vector_store,
        worker=worker,
    )
    await queue.start_worker(concurrency=1)

    yield queue
    await manager.close()


@pytest.mark.asyncio
async def test_enqueue_execute(task_queue: TaskQueue) -> None:
    task_id = await task_queue.enqueue(TaskType.REFINE, {"prompt": "hello"})
    await task_queue.wait_for_completion(task_id)
    task = await task_queue.get_status(task_id)
    assert task.status == TaskStatus.COMPLETED
    assert task.result == {"ok": True, "payload": {"prompt": "hello"}}


@pytest.mark.asyncio
async def test_cancel_pending_task() -> None:
    settings = Settings(database=DatabaseSettings(url="sqlite+aiosqlite:///:memory:"))
    manager = create_db_manager(
        settings.database.url,
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    await create_all(manager.async_engine)
    vector_store = InMemoryVectorStore()
    queue = TaskQueue(db_manager=manager, settings=settings, vector_store=vector_store)

    task_id = await queue.enqueue(TaskType.REFINE, {"prompt": "skip"})
    cancelled = await queue.cancel(task_id)
    assert cancelled is True

    task = await queue.get_status(task_id)
    assert task.status == TaskStatus.CANCELLED

    await queue.start_worker(concurrency=1)
    await queue.wait_for_completion(task_id)
    task = await queue.get_status(task_id)
    assert task.status == TaskStatus.CANCELLED
    await manager.close()


@pytest.mark.asyncio
async def test_concurrency_limit() -> None:
    settings = Settings(database=DatabaseSettings(url="sqlite+aiosqlite:///:memory:"))
    manager = create_db_manager(
        settings.database.url,
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    await create_all(manager.async_engine)
    vector_store = InMemoryVectorStore()

    in_flight = 0
    max_in_flight = 0
    lock = asyncio.Lock()
    ready = asyncio.Event()
    release = asyncio.Event()

    async def worker(
        task,
        session,
        _settings,
        _vector_store,
        _embedder_factory,
        _chat_factory,
    ) -> dict:
        nonlocal in_flight, max_in_flight
        async with lock:
            in_flight += 1
            max_in_flight = max(max_in_flight, in_flight)
            if in_flight >= 2:
                ready.set()
        await release.wait()
        async with lock:
            in_flight -= 1
        return {"ok": True}

    queue = TaskQueue(
        db_manager=manager,
        settings=settings,
        vector_store=vector_store,
        worker=worker,
    )
    await queue.start_worker(concurrency=2)

    task_ids = []
    for _ in range(5):
        task_ids.append(await queue.enqueue(TaskType.REFINE, {"prompt": "x"}))

    await asyncio.wait_for(ready.wait(), timeout=2)
    release.set()

    for task_id in task_ids:
        await queue.wait_for_completion(task_id)

    assert max_in_flight <= 2
    await manager.close()
