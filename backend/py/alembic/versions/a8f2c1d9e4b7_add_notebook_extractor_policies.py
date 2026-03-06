"""add notebook extractor policies

Revision ID: a8f2c1d9e4b7
Revises: f7d3a1b9c4e2
Create Date: 2026-03-05 00:00:00.000000

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a8f2c1d9e4b7"
down_revision: str | None = "f7d3a1b9c4e2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "notebook_extractor_policies" in set(inspector.get_table_names()):
        return

    op.create_table(
        "notebook_extractor_policies",
        sa.Column("notebook_id", sa.Integer(), nullable=False),
        sa.Column(
            "mode",
            sa.String(length=32),
            nullable=False,
            server_default=sa.text("'inherit_global'"),
        ),
        sa.Column("enabled_extractors", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["notebook_id"], ["notebooks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("notebook_id"),
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "notebook_extractor_policies" not in set(inspector.get_table_names()):
        return

    op.drop_table("notebook_extractor_policies")
