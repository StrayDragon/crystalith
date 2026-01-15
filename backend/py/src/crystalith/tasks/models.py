from __future__ import annotations

import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from cl_sqlalchemyx.base.dal import AsyncSqlATableBase

from .types import TaskStatus, TaskType


class Task(AsyncSqlATableBase):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    notebook_id: Mapped[int | None] = mapped_column(
        sa.Integer,
        sa.ForeignKey("notebooks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    type: Mapped[TaskType] = mapped_column(
        sa.Enum(TaskType, name="task_type"),
        nullable=False,
    )
    status: Mapped[TaskStatus] = mapped_column(
        sa.Enum(TaskStatus, name="task_status"),
        nullable=False,
        server_default=sa.text(f"'{TaskStatus.PENDING.value}'"),
    )
    payload: Mapped[dict] = mapped_column(sa.JSON, nullable=False)
    result: Mapped[dict | None] = mapped_column(sa.JSON, nullable=True)
    error: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    progress: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default="0")

    created_at: Mapped[datetime.datetime] = mapped_column(
        sa.DateTime,
        nullable=False,
        server_default=sa.sql.func.now(),
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        sa.DateTime,
        nullable=False,
        server_default=sa.sql.func.now(),
        onupdate=sa.sql.func.now(),
    )

    __table_args__ = (sa.Index("ix_tasks_notebook_id_status", "notebook_id", "status"),)
