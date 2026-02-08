from __future__ import annotations

import asyncio
from pathlib import Path

import sqlalchemy as sa
from alembic import command
from alembic.config import Config as AlembicConfig

from crystalith.shared.db.manager import create_db_manager


def _resolve_alembic_ini_path() -> Path:
    fallback = Path(__file__).resolve().parents[4] / "alembic.ini"
    if fallback.is_file():
        return fallback

    for parent in (Path.cwd(), *Path.cwd().parents):
        candidate = parent / "alembic.ini"
        if candidate.is_file():
            return candidate

    raise FileNotFoundError("alembic.ini not found")


def _make_alembic_config(database_url: str) -> AlembicConfig:
    config = AlembicConfig(str(_resolve_alembic_ini_path()))
    config.set_main_option("sqlalchemy.url", database_url)
    return config


async def _list_tables(database_url: str) -> set[str]:
    manager = create_db_manager(database_url)
    try:
        async with manager.async_engine.connect() as connection:

            def _inspect(sync_connection: sa.engine.Connection) -> set[str]:
                inspector = sa.inspect(sync_connection)
                return set(inspector.get_table_names())

            return await connection.run_sync(_inspect)
    finally:
        await manager.close()


def upgrade_head(database_url: str) -> None:
    tables = asyncio.run(_list_tables(database_url))
    config = _make_alembic_config(database_url)

    if tables and "alembic_version" not in tables:
        command.stamp(config, "head")

    command.upgrade(config, "head")


def downgrade(database_url: str, revision: str = "-1") -> None:
    config = _make_alembic_config(database_url)
    command.downgrade(config, revision)
