from __future__ import annotations

import datetime
from enum import StrEnum
from typing import Any

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from cl_sqlalchemyx.base.dal import AsyncSqlATableBase
from crystalith.outputs.types import OutputType


class SourceStatus(StrEnum):
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


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
    parser_type: Mapped[str] = mapped_column(sa.String(64), nullable=False)
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
