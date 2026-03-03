from __future__ import annotations

import pytest
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import create_async_engine

from crystalith.shared.db.schema import (
    _sqlite_add_column_ddl,
    _sqlite_column_names,
    _sqlite_default_sql,
    _sqlite_fallback_default,
    create_all,
)


def test_sqlite_default_sql_prefers_explicit_info_default() -> None:
    dialect = sa.create_engine("sqlite://").dialect
    col = sa.Column("x", sa.Integer, nullable=False, info={"sqlite_default": "42"})
    assert _sqlite_default_sql(col, dialect) == "42"


def test_sqlite_fallback_default_handles_common_types() -> None:
    dialect = sa.create_engine("sqlite://").dialect

    enum_col = sa.Column("status", sa.Enum("a", "b", name="status"), nullable=False)
    assert _sqlite_fallback_default(enum_col, dialect) == "'a'"

    text_col = sa.Column("name", sa.String, nullable=False)
    assert _sqlite_fallback_default(text_col, dialect) == "''"

    int_col = sa.Column("count", sa.Integer, nullable=False)
    assert _sqlite_fallback_default(int_col, dialect) == "0"

    json_col = sa.Column("meta", sa.JSON, nullable=False)
    assert _sqlite_fallback_default(json_col, dialect) == "'{}'"


def test_sqlite_add_column_ddl_skips_primary_key() -> None:
    dialect = sa.create_engine("sqlite://").dialect
    assert (
        _sqlite_add_column_ddl(
            sa.Column("id", sa.Integer, primary_key=True),
            dialect=dialect,
            table_has_rows=True,
        )
        is None
    )


def test_sqlite_add_column_ddl_adds_fallback_default_for_existing_rows() -> None:
    dialect = sa.create_engine("sqlite://").dialect
    ddl = _sqlite_add_column_ddl(
        sa.Column("name", sa.String, nullable=False),
        dialect=dialect,
        table_has_rows=True,
    )
    assert ddl is not None
    assert "NOT NULL" in ddl
    assert "DEFAULT ''" in ddl


@pytest.mark.asyncio
async def test_create_all_ensures_sqlite_schema_adds_missing_columns(tmp_path) -> None:
    db_url = f"sqlite+aiosqlite:///{tmp_path / 'schema.db'}"
    engine = create_async_engine(db_url)
    try:
        async with engine.begin() as conn:
            # Legacy/partial schema: only the PK column exists.
            await conn.exec_driver_sql('CREATE TABLE sources (id INTEGER PRIMARY KEY)')
            await conn.exec_driver_sql("INSERT INTO sources (id) VALUES (1)")

        await create_all(engine)

        async with engine.connect() as conn:
            columns = await _sqlite_column_names(conn, "sources")
            assert "notebook_id" in columns
            assert "filename" in columns

            result = await conn.exec_driver_sql(
                "SELECT notebook_id, filename FROM sources WHERE id=1"
            )
            row = result.first()
            assert row is not None
            notebook_id, filename = row
            assert notebook_id == 0
            assert filename == ""
    finally:
        await engine.dispose()
