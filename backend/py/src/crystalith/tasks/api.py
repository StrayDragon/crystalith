from __future__ import annotations

import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crystalith.tasks.models import Task
from crystalith.tasks.types import TaskStatus, TaskType

from crystalith.api.deps import get_db_session


router = APIRouter(prefix="/v1", tags=["tasks"])


class TaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    notebook_id: int | None
    type: TaskType
    status: TaskStatus
    payload: dict
    result: dict | None
    error: str | None
    progress: int
    created_at: datetime.datetime
    updated_at: datetime.datetime


@router.get("/tasks/{task_id}", response_model=TaskRead)
async def get_task(
    task_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> TaskRead:
    task = await session.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return TaskRead.model_validate(task)


@router.get("/notebooks/{notebook_id}/tasks", response_model=list[TaskRead])
async def list_tasks(
    notebook_id: int,
    session: AsyncSession = Depends(get_db_session),
) -> list[TaskRead]:
    rows = await session.execute(
        select(Task).where(Task.notebook_id == notebook_id).order_by(Task.id.desc())
    )
    return [TaskRead.model_validate(item) for item in rows.scalars().all()]
