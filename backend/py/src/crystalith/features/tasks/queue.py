from __future__ import annotations

import asyncio
import itertools
from collections.abc import Awaitable, Callable
from typing import TypeVar, cast

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from cl_logs.logging import get_logger
from cl_sqlalchemyx.mgrs import AsyncDBManager

from crystalith.shared.ai.factory import create_chat_provider, create_embedding_provider
from crystalith.shared.ai.interfaces import ChatProvider, EmbeddingProvider
from crystalith.shared.concurrency import StageLimiters
from crystalith.shared.config import Settings
from crystalith.shared.json_types import JsonDict
from crystalith.shared.plugins import PluginRegistry
from crystalith.shared.vector_storage import VectorStore

from .models import Task
from .types import TaskStatus, TaskType
from .worker import execute_task

TProvider = TypeVar("TProvider")

TaskWorker = Callable[
    [
        Task,
        AsyncSession,
        Settings,
        VectorStore,
        Callable[[Settings], EmbeddingProvider],
        Callable[[Settings], ChatProvider],
        StageLimiters | None,
    ],
    Awaitable[dict[str, object]],
]


class TaskQueue:
    def __init__(
        self,
        *,
        db_manager: AsyncDBManager,
        settings: Settings,
        vector_store: VectorStore,
        plugins: PluginRegistry | None = None,
        worker: TaskWorker | None = None,
        embedder_factory: Callable[[Settings], EmbeddingProvider] = create_embedding_provider,
        chat_factory: Callable[[Settings], ChatProvider] = create_chat_provider,
        limiters: StageLimiters | None = None,
    ) -> None:
        self._db_manager = db_manager
        self._settings = settings
        self._vector_store = vector_store
        self._worker = worker or execute_task
        self._embedder_factory = self._wrap_factory(embedder_factory, plugins=plugins)
        self._chat_factory = self._wrap_factory(chat_factory, plugins=plugins)
        self._limiters = limiters
        self._queue: asyncio.PriorityQueue[tuple[int, int, int]] = asyncio.PriorityQueue()
        self._counter = itertools.count()
        self._semaphore: asyncio.Semaphore | None = None
        self._worker_task: asyncio.Task[None] | None = None
        self._in_flight: set[asyncio.Task[None]] = set()
        self._waiters: dict[int, asyncio.Future[None]] = {}
        self._log = get_logger(__name__)

    @staticmethod
    def _wrap_factory(
        factory: Callable[..., TProvider],
        *,
        plugins: PluginRegistry | None,
    ) -> Callable[[Settings], TProvider]:
        if plugins is None:
            return factory  # type: ignore[return-value]

        def wrapped(settings: Settings) -> TProvider:
            try:
                return factory(settings, plugins=plugins)
            except TypeError:
                return factory(settings)

        return wrapped

    async def enqueue(
        self,
        task_type: TaskType,
        payload: dict[str, object],
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
        priority = 0
        if isinstance(raw_priority, bool):
            priority = 0
        elif isinstance(raw_priority, (int, float, str)):
            try:
                priority = int(raw_priority)
            except ValueError:
                priority = 0
        await self._queue.put((priority, next(self._counter), task.id))
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
        future = self._waiters.setdefault(task_id, asyncio.get_running_loop().create_future())

        async with self._db_manager.got_manual_session() as session:
            task = await session.get(Task, task_id)
            if task is None:
                raise ValueError("Task not found")
            if task.status in {TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED}:
                self._notify_waiter(task_id)
                return

        await future

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

        in_flight = set(self._in_flight)
        for task in in_flight:
            task.cancel()
        if in_flight:
            await asyncio.gather(*in_flight, return_exceptions=True)
        self._in_flight.clear()
        self._semaphore = None
        self._log.info("task queue worker stopped")

    async def _run_loop(self) -> None:
        while True:
            _, _, task_id = await self._queue.get()
            if self._semaphore is None:
                self._semaphore = asyncio.Semaphore(1)
            await self._semaphore.acquire()
            task = asyncio.create_task(self._execute_task(task_id))
            self._in_flight.add(task)
            task.add_done_callback(self._in_flight.discard)

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
                        self._limiters,
                    )
                    task.status = TaskStatus.COMPLETED
                    task.result = cast(JsonDict, result)
                    task.error = None
                    task.progress = 100
                except asyncio.CancelledError:
                    task.status = TaskStatus.CANCELLED
                    task.error = None
                    task.result = None
                    task.progress = 0
                    await session.commit()
                    raise
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
        if future is None:
            return

        if not future.done():
            future.set_result(None)

        if future.done():
            self._waiters.pop(task_id, None)
