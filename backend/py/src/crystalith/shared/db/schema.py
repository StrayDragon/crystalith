from __future__ import annotations

import json

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine

from cl_sqlalchemyx.base.dal import AsyncSqlATableBase

from . import models as _models  # noqa: F401


async def _sqlite_table_names(conn: AsyncConnection) -> set[str]:
    result = await conn.exec_driver_sql("SELECT name FROM sqlite_master WHERE type='table'")
    return {row[0] for row in result.fetchall()}


async def _sqlite_column_names(conn: AsyncConnection, table: str) -> set[str]:
    result = await conn.exec_driver_sql(f"PRAGMA table_info('{table}')")
    return {row[1] for row in result.fetchall()}


async def _sqlite_table_has_rows(conn: AsyncConnection, table: str) -> bool:
    result = await conn.exec_driver_sql(f'SELECT 1 FROM "{table}" LIMIT 1')
    return result.first() is not None


def _compile_sql(element: sa.ClauseElement, dialect: sa.engine.Dialect) -> str:
    return str(element.compile(dialect=dialect, compile_kwargs={"literal_binds": True}))


def _sqlite_default_sql(column: sa.Column, dialect: sa.engine.Dialect) -> str | None:
    info_default = column.info.get("sqlite_default")
    if isinstance(info_default, str) and info_default:
        return info_default
    if column.server_default is not None:
        return _compile_sql(column.server_default.arg, dialect)
    if column.default is not None and column.default.is_scalar:
        return _compile_sql(sa.literal(column.default.arg), dialect)
    return None


def _sqlite_fallback_default(column: sa.Column, dialect: sa.engine.Dialect) -> str | None:
    coltype = column.type
    if isinstance(coltype, sa.Enum) and coltype.enums:
        return _compile_sql(sa.literal(coltype.enums[0]), dialect)
    if isinstance(coltype, (sa.String, sa.Text, sa.Unicode, sa.UnicodeText)):
        return _compile_sql(sa.literal(""), dialect)
    if isinstance(coltype, (sa.Integer, sa.BigInteger, sa.SmallInteger)):
        return "0"
    if isinstance(coltype, (sa.Float, sa.Numeric, sa.DECIMAL, sa.REAL)):
        return "0"
    if isinstance(coltype, sa.Boolean):
        return "0"
    if isinstance(coltype, sa.DateTime):
        return "CURRENT_TIMESTAMP"
    if isinstance(coltype, sa.JSON):
        return _compile_sql(sa.literal(json.dumps({})), dialect)
    return None


def _sqlite_add_column_ddl(
    column: sa.Column,
    *,
    dialect: sa.engine.Dialect,
    table_has_rows: bool,
) -> str | None:
    if column.primary_key:
        return None

    default_sql = _sqlite_default_sql(column, dialect)
    nullable = column.nullable

    if not nullable and default_sql is None and table_has_rows:
        default_sql = _sqlite_fallback_default(column, dialect)
        if default_sql is None:
            nullable = True

    colname = dialect.identifier_preparer.quote(column.name)
    coltype = column.type.compile(dialect=dialect)
    parts = [colname, coltype]
    if not nullable:
        parts.append("NOT NULL")
    if default_sql is not None:
        parts.append(f"DEFAULT {default_sql}")
    return " ".join(parts)


async def _ensure_sqlite_schema(conn: AsyncConnection, dialect: sa.engine.Dialect) -> None:
    tables = await _sqlite_table_names(conn)
    for table in AsyncSqlATableBase.metadata.sorted_tables:
        if table.name not in tables:
            continue
        existing = await _sqlite_column_names(conn, table.name)
        if not existing:
            continue
        needs_row_check = any(
            column.name not in existing
            and not column.nullable
            and _sqlite_default_sql(column, dialect) is None
            for column in table.columns
        )
        table_has_rows = await _sqlite_table_has_rows(conn, table.name) if needs_row_check else False
        for column in table.columns:
            if column.name in existing:
                continue
            ddl = _sqlite_add_column_ddl(column, dialect=dialect, table_has_rows=table_has_rows)
            if ddl is None:
                continue
            await conn.exec_driver_sql(f'ALTER TABLE "{table.name}" ADD COLUMN {ddl}')


async def create_all(engine: AsyncEngine) -> None:
    async with engine.begin() as conn:
        await conn.run_sync(AsyncSqlATableBase.metadata.create_all)
        if engine.dialect.name == "sqlite":
            await _ensure_sqlite_schema(conn, engine.dialect)
