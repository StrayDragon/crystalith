from __future__ import annotations

import datetime
from typing import Any

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from cl_sqlalchemyx.base.dal import AsyncSqlATableBase
from cl_stdx.enumx import MetaInfoStrEnum, XMetaInfo
from crystalith.outputs.types import OutputType


class SourceStatus(MetaInfoStrEnum):
    """Status of a document source."""

    PROCESSING = "processing", XMetaInfo(description="正在处理", display_text="处理中")
    READY = "ready", XMetaInfo(description="处理完成", display_text="就绪")
    FAILED = "failed", XMetaInfo(description="处理失败", display_text="失败")


class ResearchStatus(MetaInfoStrEnum):
    """Status of a research session."""

    PLANNING = "planning", XMetaInfo(description="正在规划搜索", display_text="规划中")
    SEARCHING = "searching", XMetaInfo(description="正在执行搜索", display_text="搜索中")
    ANALYZING = "analyzing", XMetaInfo(description="正在分析结果", display_text="分析中")
    WAITING_USER = "waiting_user", XMetaInfo(description="等待用户确认", display_text="待确认")
    COMPLETED = "completed", XMetaInfo(description="研究完成", display_text="已完成")
    CANCELLED = "cancelled", XMetaInfo(description="已取消", display_text="已取消")


class ResearchStepType(MetaInfoStrEnum):
    """Type of research step."""

    PLAN = "plan", XMetaInfo(description="搜索计划", display_text="计划")
    SEARCH = "search", XMetaInfo(description="执行搜索", display_text="搜索")
    ANALYZE = "analyze", XMetaInfo(description="分析结果", display_text="分析")
    USER_INPUT = "user_input", XMetaInfo(description="用户输入", display_text="用户输入")
    SUMMARY = "summary", XMetaInfo(description="生成报告", display_text="报告")


class ResearchStepStatus(MetaInfoStrEnum):
    """Status of a research step."""

    PENDING = "pending", XMetaInfo(description="等待执行", display_text="待执行")
    RUNNING = "running", XMetaInfo(description="正在执行", display_text="执行中")
    COMPLETED = "completed", XMetaInfo(description="执行完成", display_text="已完成")
    SKIPPED = "skipped", XMetaInfo(description="已跳过", display_text="已跳过")


class SlideStage(MetaInfoStrEnum):
    """Stage of a studio slide draft."""

    INPUT = "input", XMetaInfo(description="输入阶段", display_text="输入")
    OUTLINE = "outline", XMetaInfo(description="大纲阶段", display_text="大纲")
    MARKDOWN = "markdown", XMetaInfo(description="Markdown 阶段", display_text="Markdown")


class SlideStatus(MetaInfoStrEnum):
    """Status of a studio slide draft."""

    IDLE = "idle", XMetaInfo(description="空闲", display_text="空闲")
    RUNNING = "running", XMetaInfo(description="生成中", display_text="生成中")
    ERROR = "error", XMetaInfo(description="失败", display_text="失败")


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
        sa.Enum(OutputType, name="output_type"),
        nullable=False,
    )
    prompt: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    chunk_ids: Mapped[list[int] | None] = mapped_column(sa.JSON, nullable=True)
    content: Mapped[dict] = mapped_column(sa.JSON, nullable=False)

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
    outline: Mapped[dict[str, Any] | None] = mapped_column(sa.JSON, nullable=True)
    markdown: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    generation_config: Mapped[dict[str, Any] | None] = mapped_column(sa.JSON, nullable=True)
    stage: Mapped[SlideStage] = mapped_column(
        sa.Enum(SlideStage, name="slide_stage"),
        nullable=False,
        server_default=sa.text(f"'{SlideStage.INPUT.value}'"),
    )
    status: Mapped[SlideStatus] = mapped_column(
        sa.Enum(SlideStatus, name="slide_status"),
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
        sa.Enum(SourceStatus, name="source_status"),
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


class ResearchSession(AsyncSqlATableBase):
    """Deep research session for multi-round iterative search."""

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
        sa.Enum(ResearchStatus, name="research_status"),
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

    # Lock and timeout management
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
    """Individual step in a research session."""

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
        sa.Enum(ResearchStepType, name="research_step_type"),
        nullable=False,
    )
    input_data: Mapped[dict[str, Any] | None] = mapped_column(sa.JSON, nullable=True)
    output_data: Mapped[dict[str, Any] | None] = mapped_column(sa.JSON, nullable=True)
    status: Mapped[ResearchStepStatus] = mapped_column(
        sa.Enum(ResearchStepStatus, name="research_step_status"),
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
