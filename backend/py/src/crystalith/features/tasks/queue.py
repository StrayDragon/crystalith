from __future__ import annotations

import asyncio
import itertools
from collections.abc import Awaitable, Callable
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from cl_logs.logging import get_logger
from cl_sqlalchemyx.mgrs import AsyncDBManager

from crystalith.shared.ai.factory import create_chat_provider, create_embedding_provider
from crystalith.shared.ai.interfaces import ChatProvider, EmbeddingProvider
from crystalith.shared.config import Settings
from crystalith.shared.vector_storage import VectorStore

from .models import Task
from .types import TaskStatus, TaskType
from .worker import execute_task

TaskWorker = Callable[
    [Task, AsyncSession, Settings, VectorStore, Callable[[Settings], EmbeddingProvider], Callable[[Settings], ChatProvider]],
    Awaitable[dict[str, Any]],
]


class TaskQueue:
    def __init__(
        self,
        *,
        db_manager: AsyncDBManager,
        settings: Settings,
        vector_store: VectorStore,
        worker: TaskWorker | None = None,
        embedder_factory: Callable[[Settings], EmbeddingProvider] = create_embedding_provider,
        chat_factory: Callable[[Settings], ChatProvider] = create_chat_provider,
    ) -> None:
        self._db_manager = db_manager
        self._settings = settings
        self._vector_store = vector_store
        self._worker = worker or execute_task
        self._embedder_factory = embedder_factory
        self._chat_factory = chat_factory
        self._queue: asyncio.PriorityQueue[tuple[int, int, int]] = asyncio.PriorityQueue()
        self._counter = itertools.count()
        self._semaphore: asyncio.Semaphore | None = None
        self._worker_task: asyncio.Task[None] | None = None
        self._waiters: dict[int, asyncio.Future[None]] = {}
        self._log = get_logger(__name__)

    async def enqueue(
        self,
        task_type: TaskType,
        payload: dict[str, Any],
        notebook_id: int | None = None,
    ) -> int:
        async with self._db_manager.got_manual_session() as session:
            task = Task(
                notebook_id=notebook_id,
                type=task_type,
                status=TaskStatus.PENDING,
                payload=payload,
                progress=0,
            )
            session.add(task)
            await session.commit()
            await session.refresh(task)

        raw_priority = payload.get("priority", 0)
        try:
            priority = int(raw_priority)
        except (TypeError, ValueError):
            priority = 0
        await self._queue.put((priority, next(self._counter), task.id))
        self._waiters.setdefault(task.id, asyncio.get_running_loop().create_future())
        return task.id

    async def get_status(self, task_id: int) -> Task:
        async with self._db_manager.got_manual_session() as session:
            task = await session.get(Task, task_id)
            if task is None:
                raise ValueError("Task not found")
            return task

    async def cancel(self, task_id: int) -> bool:
        async with self._db_manager.got_manual_session() as session:
            task = await session.get(Task, task_id)
            if task is None:
                raise ValueError("Task not found")
            if task.status != TaskStatus.PENDING:
                return False
            task.status = TaskStatus.CANCELLED
            task.error = None
            task.progress = 0
            await session.commit()
        self._notify_waiter(task_id)
        return True

    async def wait_for_completion(self, task_id: int) -> None:
        async with self._db_manager.got_manual_session() as session:
            task = await session.get(Task, task_id)
            if task is None:
                raise ValueError("Task not found")
            if task.status in {TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED}:
                return

        future = self._waiters.setdefault(task_id, asyncio.get_running_loop().create_future())
        await future
        self._waiters.pop(task_id, None)

    async def start_worker(self, concurrency: int = 3) -> None:
        if self._worker_task is not None:
            return
        self._semaphore = asyncio.Semaphore(concurrency)
        self._worker_task = asyncio.create_task(self._run_loop())
        self._log.info("task queue worker started", concurrency=concurrency)

    async def stop_worker(self) -> None:
        if self._worker_task is None:
            return
        self._worker_task.cancel()
        try:
            await self._worker_task
        except asyncio.CancelledError:
            pass
        self._worker_task = None
        self._semaphore = None
        self._log.info("task queue worker stopped")

    async def _run_loop(self) -> None:
        while True:
            _, _, task_id = await self._queue.get()
            if self._semaphore is None:
                self._semaphore = asyncio.Semaphore(1)
            await self._semaphore.acquire()
            asyncio.create_task(self._execute_task(task_id))

    async def _execute_task(self, task_id: int) -> None:
        try:
            async with self._db_manager.got_manual_session() as session:
                task = await session.get(Task, task_id)
                if task is None:
                    return
                if task.status != TaskStatus.PENDING:
                    return
                task.status = TaskStatus.RUNNING
                task.progress = 0
                await session.commit()
                await session.refresh(task)

                try:
                    result = await self._worker(
                        task,
                        session,
                        self._settings,
                        self._vector_store,
                        self._embedder_factory,
                        self._chat_factory,
                    )
                    task.status = TaskStatus.COMPLETED
                    task.result = result
                    task.error = None
                    task.progress = 100
                except Exception as exc:  # noqa: BLE001
                    task.status = TaskStatus.FAILED
                    task.error = str(exc)
                    task.result = None
                    task.progress = 0
                    self._log.exception("task failed", task_id=task_id)

                await session.commit()
        finally:
            self._notify_waiter(task_id)
            if self._semaphore is not None:
                self._semaphore.release()

    def _notify_waiter(self, task_id: int) -> None:
        future = self._waiters.get(task_id)
        if future is not None and not future.done():
            future.set_result(None)
