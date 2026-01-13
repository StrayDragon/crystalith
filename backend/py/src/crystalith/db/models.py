from __future__ import annotations

import datetime
from enum import StrEnum

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from cl_sqlalchemyx.base.dal import AsyncSqlATableBase


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

    __table_args__ = (sa.Index("ix_notebooks_name", "name"),)


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
