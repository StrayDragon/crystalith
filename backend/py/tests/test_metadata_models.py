from __future__ import annotations

import sqlalchemy as sa
import pytest
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import selectinload
from sqlalchemy.pool import StaticPool

from cl_sqlalchemyx.shortcuts.meta import get_table_ddl_info

from crystalith.db import Chunk, Notebook, Source, SourceStatus, create_all, create_db_manager


def test_models_compile_for_sqlite_and_postgres() -> None:
    for suffix, dialect_fn in (("sqlite", None), ("postgres", postgresql.dialect)):
        info_notebook = get_table_ddl_info(Notebook, dialect_fn=dialect_fn) if dialect_fn else get_table_ddl_info(Notebook)
        info_source = get_table_ddl_info(Source, dialect_fn=dialect_fn) if dialect_fn else get_table_ddl_info(Source)
        info_chunk = get_table_ddl_info(Chunk, dialect_fn=dialect_fn) if dialect_fn else get_table_ddl_info(Chunk)

        create_sql_notebook = str(info_notebook.create_table).lower()
        assert "create table" in create_sql_notebook
        assert "notebooks" in create_sql_notebook

        create_sql_source = str(info_source.create_table).lower()
        assert "sources" in create_sql_source
        assert "foreign key" in create_sql_source
        assert "on delete cascade" in create_sql_source, f"missing ON DELETE CASCADE for {suffix}"

        create_sql_chunk = str(info_chunk.create_table).lower()
        assert "chunks" in create_sql_chunk
        assert "foreign key" in create_sql_chunk
        assert "on delete cascade" in create_sql_chunk, f"missing ON DELETE CASCADE for {suffix}"

        index_sqls = [str(x).lower() for x in info_chunk.index_ddls]
        assert any("ix_chunks_source_id_chunk_index".lower() in s for s in index_sqls)


@pytest.mark.asyncio
async def test_sqlite_create_all_and_relationship_cascade() -> None:
    manager = create_db_manager(
        "sqlite+aiosqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    try:
        await create_all(manager.async_engine)

        async with manager.got_manual_session() as session:
            nb = Notebook(name="nb1")
            src = Source(filename="doc.md", mime_type="text/markdown", status=SourceStatus.PROCESSING)
            src.chunks.append(Chunk(chunk_index=0, text="hello"))
            src.chunks.append(Chunk(chunk_index=1, text="world"))
            nb.sources.append(src)

            session.add(nb)
            await session.commit()

            stmt = (
                sa.select(Notebook)
                .options(selectinload(Notebook.sources).selectinload(Source.chunks))
                .where(Notebook.name == "nb1")
            )
            loaded = (await session.execute(stmt)).scalar_one()
            assert len(loaded.sources) == 1
            assert loaded.sources[0].filename == "doc.md"
            assert [c.chunk_index for c in loaded.sources[0].chunks] == [0, 1]

            await session.delete(loaded)
            await session.commit()

            assert (await session.execute(sa.select(Notebook))).scalars().all() == []
            assert (await session.execute(sa.select(Source))).scalars().all() == []
            assert (await session.execute(sa.select(Chunk))).scalars().all() == []
    finally:
        await manager.close()
