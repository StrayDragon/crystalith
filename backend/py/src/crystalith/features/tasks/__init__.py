from __future__ import annotations

from typing import TYPE_CHECKING

from .models import Task
from .types import TaskStatus, TaskType

if TYPE_CHECKING:
    from .queue import TaskQueue

__all__ = ["Task", "TaskQueue", "TaskStatus", "TaskType"]


def __getattr__(name: str):
    if name == "TaskQueue":
        from .queue import TaskQueue

        return TaskQueue
    raise AttributeError(f"module 'crystalith.features.tasks' has no attribute {name!r}")
