"""add source failure diagnostics

Revision ID: e4d3b7a9c2f1
Revises: d8c0e6b1f2a3
Create Date: 2026-02-27 00:00:00.000000

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e4d3b7a9c2f1"
down_revision: str | None = "d8c0e6b1f2a3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "sources" not in set(inspector.get_table_names()):
        return

    columns = {col["name"] for col in inspector.get_columns("sources")}

    with op.batch_alter_table("sources", schema=None) as batch_op:
        if "error_code" not in columns:
            batch_op.add_column(sa.Column("error_code", sa.String(length=64), nullable=True))
        if "recovery_hint" not in columns:
            batch_op.add_column(sa.Column("recovery_hint", sa.Text(), nullable=True))
        if "last_error_at" not in columns:
            batch_op.add_column(sa.Column("last_error_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    # Non-destructive migration: keep downgrade no-op.
    return
