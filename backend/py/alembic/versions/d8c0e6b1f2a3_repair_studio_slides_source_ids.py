"""repair studio_slides source_ids

Revision ID: d8c0e6b1f2a3
Revises: c1a0c9d5e7f3
Create Date: 2026-02-19 18:56:30.000000

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d8c0e6b1f2a3"
down_revision: str | None = "c1a0c9d5e7f3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "studio_slides" not in set(inspector.get_table_names()):
        return

    columns = {col["name"] for col in inspector.get_columns("studio_slides")}
    if "source_ids" in columns:
        return

    with op.batch_alter_table("studio_slides", schema=None) as batch_op:
        batch_op.add_column(sa.Column("source_ids", sa.JSON(), nullable=True))


def downgrade() -> None:
    # Repair migration: keep downgrade non-destructive.
    return
