from __future__ import annotations

import asyncio
import os
from logging.config import fileConfig

import sqlalchemy as sa
from alembic import context

from cl_sqlalchemyx.base.dal import AsyncSqlATableBase

from crystalith.shared.db import create_db_manager

from crystalith.shared.db import models as _db_models  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = AsyncSqlATableBase.metadata


def _resolve_database_url() -> str:
    url = os.environ.get("CRYSTALITH_DATABASE__URL") or config.get_main_option("sqlalchemy.url")
    if url is None or not url.strip():
        raise ValueError("Database URL not configured. Set CRYSTALITH_DATABASE__URL or sqlalchemy.url.")
    return url


def _render_as_batch(database_url: str) -> bool:
    try:
        url = sa.engine.make_url(database_url)
    except Exception:  # noqa: BLE001
        return False
    return url.get_backend_name() == "sqlite"


def run_migrations_offline() -> None:
    url = _resolve_database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        render_as_batch=_render_as_batch(url),
    )

    with context.begin_transaction():
        context.run_migrations()


def _do_run_migrations(connection: sa.engine.Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        render_as_batch=connection.dialect.name == "sqlite",
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    manager = create_db_manager(_resolve_database_url())
    try:
        async with manager.async_engine.connect() as connection:
            await connection.run_sync(_do_run_migrations)
    finally:
        await manager.close()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
