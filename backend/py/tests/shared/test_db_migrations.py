from __future__ import annotations

import asyncio

import pytest
import sqlalchemy as sa
from sqlalchemy import select

from crystalith.shared.db import Notebook, create_all, create_db_manager
from crystalith.shared.db.migrations import downgrade, upgrade_head


async def _table_names(database_url: str) -> set[str]:
    manager = create_db_manager(database_url)
    try:
        async with manager.async_engine.connect() as connection:

            def _inspect(sync_connection: sa.engine.Connection) -> set[str]:
                inspector = sa.inspect(sync_connection)
                return set(inspector.get_table_names())

            return await connection.run_sync(_inspect)
    finally:
        await manager.close()


@pytest.mark.asyncio
async def test_alembic_upgrade_and_downgrade_roundtrip(tmp_path) -> None:
    db_url = f"sqlite+aiosqlite:///{tmp_path / 'roundtrip.db'}"

    await asyncio.to_thread(upgrade_head, db_url)
    tables_after_upgrade = await _table_names(db_url)

    assert "alembic_version" in tables_after_upgrade
    assert "notebooks" in tables_after_upgrade
    assert "sources" in tables_after_upgrade

    await asyncio.to_thread(downgrade, db_url, "-1")
    tables_after_downgrade = await _table_names(db_url)
    assert "notebooks" not in tables_after_downgrade

    await asyncio.to_thread(upgrade_head, db_url)
    tables_after_second_upgrade = await _table_names(db_url)
    assert "notebooks" in tables_after_second_upgrade


@pytest.mark.asyncio
async def test_upgrade_head_stamps_legacy_database(tmp_path) -> None:
    db_url = f"sqlite+aiosqlite:///{tmp_path / 'legacy.db'}"
    manager = create_db_manager(db_url)
    await create_all(manager.async_engine)

    async with manager.got_manual_session() as session:
        session.add(Notebook(name="Legacy Notebook"))
        await session.commit()

    await manager.close()

    await asyncio.to_thread(upgrade_head, db_url)

    manager_after = create_db_manager(db_url)
    async with manager_after.got_manual_session() as session:
        notebook = (await session.execute(select(Notebook))).scalars().first()
        assert notebook is not None
        assert notebook.name == "Legacy Notebook"

        version = await session.execute(sa.text("SELECT version_num FROM alembic_version"))
        assert version.scalar_one()

    await manager_after.close()
