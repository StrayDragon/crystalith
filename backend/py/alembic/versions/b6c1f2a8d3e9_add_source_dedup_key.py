"""add source dedup key

Revision ID: b6c1f2a8d3e9
Revises: e4d3b7a9c2f1
Create Date: 2026-02-27 00:00:00.000000

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b6c1f2a8d3e9"
down_revision: str | None = "e4d3b7a9c2f1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "sources" not in set(inspector.get_table_names()):
        return

    columns = {col["name"] for col in inspector.get_columns("sources")}
    indexes = {idx["name"] for idx in inspector.get_indexes("sources")}

    with op.batch_alter_table("sources", schema=None) as batch_op:
        if "dedup_key" not in columns:
            batch_op.add_column(sa.Column("dedup_key", sa.String(length=128), nullable=True))

    if "ix_sources_notebook_id_dedup_key" not in indexes:
        op.create_index(
            "ix_sources_notebook_id_dedup_key",
            "sources",
            ["notebook_id", "dedup_key"],
            unique=False,
        )


def downgrade() -> None:
    # Non-destructive migration: keep downgrade no-op.
    return
