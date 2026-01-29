from __future__ import annotations

import datetime

import enum
from typing import Any

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from cl_sqlalchemyx.base.dal import AsyncSqlATableBase

from crystalith.shared.types import (
    TaskStatus,
    TaskType,
    OutputType,
    ResearchStatus,
    ResearchStepStatus,
    ResearchStepType,
    SlideStage,
    SlideStatus,
    SourceStatus,
)


def _enum_values(enum_cls: type[enum.Enum]) -> list[str]:
    return [member.value for member in enum_cls]  # type: ignore[return-value]


class Notebook(AsyncSqlATableBase):
    __tablename__ = "notebooks"

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(sa.String(255), nullable=False)

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

    sources: Mapped[list["Source"]] = relationship(
        back_populates="notebook",
        cascade="all, delete-orphan",
        passive_deletes=True,
        lazy="selectin",
    )
    sessions: Mapped[list["Session"]] = relationship(
        back_populates="notebook",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Session.updated_at.desc()",
        lazy="selectin",
    )
    outputs: Mapped[list["Output"]] = relationship(
        back_populates="notebook",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Output.created_at.desc()",
        lazy="selectin",
    )

    __table_args__ = (sa.Index("ix_notebooks_name", "name"),)


class Session(AsyncSqlATableBase):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    notebook_id: Mapped[int] = mapped_column(
        sa.Integer,
        sa.ForeignKey("notebooks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)

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

    notebook: Mapped["Notebook"] = relationship(
        back_populates="sessions",
        lazy="selectin",
    )
    messages: Mapped[list["Message"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Message.created_at",
        lazy="selectin",
    )

    __table_args__ = (sa.Index("ix_sessions_notebook_id_updated_at", "notebook_id", "updated_at"),)


class Message(AsyncSqlATableBase):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        sa.Integer,
        sa.ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(sa.String(32), nullable=False)
    content: Mapped[str] = mapped_column(sa.Text, nullable=False)
    citations: Mapped[dict | None] = mapped_column(sa.JSON, nullable=True)

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

    session: Mapped["Session"] = relationship(
        back_populates="messages",
        lazy="selectin",
    )

    __table_args__ = (sa.Index("ix_messages_session_id_created_at", "session_id", "created_at"),)


class Source(AsyncSqlATableBase):
    __tablename__ = "sources"

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    notebook_id: Mapped[int] = mapped_column(
        sa.Integer,
        sa.ForeignKey("notebooks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    filename: Mapped[str] = mapped_column(sa.String(512), nullable=False)
    mime_type: Mapped[str | None] = mapped_column(sa.String(127), nullable=True)
    parser_type: Mapped[str] = mapped_column(
        sa.String(64),
        nullable=False,
        server_default=sa.text("'text'"),
    )
    metadata_: Mapped[dict[str, Any] | None] = mapped_column(
        "metadata",
        sa.JSON,
        nullable=True,
    )

    status: Mapped[SourceStatus] = mapped_column(
        sa.Enum(SourceStatus, name="source_status", values_callable=_enum_values),
        nullable=False,
        server_default=sa.text(f"'{SourceStatus.PROCESSING.value}'"),
    )
    error_message: Mapped[str | None] = mapped_column(sa.Text, nullable=True)

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

    notebook: Mapped["Notebook"] = relationship(
        back_populates="sources",
        lazy="selectin",
    )
    chunks: Mapped[list["Chunk"]] = relationship(
        back_populates="source",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Chunk.chunk_index",
        lazy="selectin",
    )

    __table_args__ = (sa.Index("ix_sources_notebook_id_status", "notebook_id", "status"),)


class Chunk(AsyncSqlATableBase):
    __tablename__ = "chunks"

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    source_id: Mapped[int] = mapped_column(
        sa.Integer,
        sa.ForeignKey("sources.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    chunk_index: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    text: Mapped[str] = mapped_column(sa.Text, nullable=False)
    start_offset: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    end_offset: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    metadata_: Mapped[dict[str, Any] | None] = mapped_column(
        "metadata",
        sa.JSON,
        nullable=True,
    )

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

    source: Mapped["Source"] = relationship(
        back_populates="chunks",
        lazy="selectin",
    )

    __table_args__ = (
        sa.UniqueConstraint("source_id", "chunk_index", name="uq_chunks_source_id_chunk_index"),
        sa.Index("ix_chunks_source_id_chunk_index", "source_id", "chunk_index"),
    )


class Output(AsyncSqlATableBase):
    __tablename__ = "outputs"

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    notebook_id: Mapped[int] = mapped_column(
        sa.Integer,
        sa.ForeignKey("notebooks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    type: Mapped[OutputType] = mapped_column(
        sa.Enum(OutputType, name="output_type", values_callable=_enum_values),
        nullable=False,
    )
    prompt: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    chunk_ids: Mapped[list[int] | None] = mapped_column(sa.JSON, nullable=True)
    content: Mapped[dict[str, Any]] = mapped_column(sa.JSON, nullable=False)

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

    notebook: Mapped["Notebook"] = relationship(
        back_populates="outputs",
        lazy="selectin",
    )

    __table_args__ = (sa.Index("ix_outputs_notebook_id_created_at", "notebook_id", "created_at"),)


class StudioSlide(AsyncSqlATableBase):
    __tablename__ = "studio_slides"

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    notebook_id: Mapped[int] = mapped_column(
        sa.Integer,
        sa.ForeignKey("notebooks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    output_id: Mapped[int | None] = mapped_column(
        sa.Integer,
        sa.ForeignKey("outputs.id", ondelete="SET NULL"),
        nullable=True,
    )
    title: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    prompt: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    engine: Mapped[str] = mapped_column(
        sa.String(64),
        nullable=False,
        server_default=sa.text("'slidev'"),
    )
    chunk_ids: Mapped[list[int] | None] = mapped_column(sa.JSON, nullable=True)
    source_ids: Mapped[list[int] | None] = mapped_column(sa.JSON, nullable=True)
    outline: Mapped[dict[str, Any] | None] = mapped_column(sa.JSON, nullable=True)
    markdown: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    generation_config: Mapped[dict[str, Any] | None] = mapped_column(sa.JSON, nullable=True)
    stage: Mapped[SlideStage] = mapped_column(
        sa.Enum(SlideStage, name="slide_stage", values_callable=_enum_values),
        nullable=False,
        server_default=sa.text(f"'{SlideStage.INPUT.value}'"),
    )
    status: Mapped[SlideStatus] = mapped_column(
        sa.Enum(SlideStatus, name="slide_status", values_callable=_enum_values),
        nullable=False,
        server_default=sa.text(f"'{SlideStatus.IDLE.value}'"),
    )
    error_message: Mapped[str | None] = mapped_column(sa.Text, nullable=True)

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

    notebook: Mapped["Notebook"] = relationship(
        lazy="selectin",
    )
    output: Mapped["Output"] = relationship(
        lazy="selectin",
    )

    __table_args__ = (sa.Index("ix_studio_slides_notebook_id_updated_at", "notebook_id", "updated_at"),)


class ResearchSession(AsyncSqlATableBase):
    __tablename__ = "research_sessions"

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    notebook_id: Mapped[int] = mapped_column(
        sa.Integer,
        sa.ForeignKey("notebooks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    topic: Mapped[str] = mapped_column(sa.Text, nullable=False)
    status: Mapped[ResearchStatus] = mapped_column(
        sa.Enum(ResearchStatus, name="research_status", values_callable=_enum_values),
        nullable=False,
        server_default=sa.text(f"'{ResearchStatus.PLANNING.value}'"),
    )
    current_iteration: Mapped[int] = mapped_column(
        sa.Integer,
        nullable=False,
        server_default=sa.text("1"),
    )
    max_iterations: Mapped[int] = mapped_column(
        sa.Integer,
        nullable=False,
        server_default=sa.text("4"),
    )
    aggregated_results: Mapped[list[dict[str, Any]] | None] = mapped_column(
        sa.JSON,
        nullable=True,
    )
    final_report: Mapped[str | None] = mapped_column(sa.Text, nullable=True)

    locked_at: Mapped[datetime.datetime | None] = mapped_column(
        sa.DateTime,
        nullable=True,
        default=None,
    )
    lock_expires_at: Mapped[datetime.datetime | None] = mapped_column(
        sa.DateTime,
        nullable=True,
        default=None,
    )

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

    notebook: Mapped["Notebook"] = relationship(
        lazy="selectin",
    )
    steps: Mapped[list["ResearchStep"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="ResearchStep.created_at",
        lazy="selectin",
    )

    __table_args__ = (
        sa.Index("ix_research_sessions_status", "status"),
    )


class ResearchStep(AsyncSqlATableBase):
    __tablename__ = "research_steps"

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        sa.Integer,
        sa.ForeignKey("research_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    iteration: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    type: Mapped[ResearchStepType] = mapped_column(
        sa.Enum(ResearchStepType, name="research_step_type", values_callable=_enum_values),
        nullable=False,
    )
    input_data: Mapped[dict[str, Any] | None] = mapped_column(sa.JSON, nullable=True)
    output_data: Mapped[dict[str, Any] | None] = mapped_column(sa.JSON, nullable=True)
    status: Mapped[ResearchStepStatus] = mapped_column(
        sa.Enum(ResearchStepStatus, name="research_step_status", values_callable=_enum_values),
        nullable=False,
        server_default=sa.text(f"'{ResearchStepStatus.PENDING.value}'"),
    )

    created_at: Mapped[datetime.datetime] = mapped_column(
        sa.DateTime,
        nullable=False,
        server_default=sa.sql.func.now(),
    )

    session: Mapped["ResearchSession"] = relationship(
        back_populates="steps",
        lazy="selectin",
    )

    __table_args__ = (
        sa.Index("ix_research_steps_session_iteration", "session_id", "iteration"),
    )


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
        sa.Enum(TaskType, name="task_type", values_callable=_enum_values),
        nullable=False,
    )
    status: Mapped[TaskStatus] = mapped_column(
        sa.Enum(TaskStatus, name="task_status", values_callable=_enum_values),
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
