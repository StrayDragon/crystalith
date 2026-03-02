"""add prompt presets

Revision ID: f7d3a1b9c4e2
Revises: b6c1f2a8d3e9
Create Date: 2026-03-02 03:00:00.000000

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f7d3a1b9c4e2"
down_revision: str | None = "b6c1f2a8d3e9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "prompt_presets" not in inspector.get_table_names():
        op.create_table(
            "prompt_presets",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("trigger", sa.String(length=64), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("system_prompt", sa.Text(), nullable=False),
            sa.Column("enabled", sa.Boolean(), server_default=sa.true(), nullable=False),
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
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("trigger", name="uq_prompt_presets_trigger"),
        )

    existing_indexes = {idx["name"] for idx in inspector.get_indexes("prompt_presets")}
    if "ix_prompt_presets_enabled" not in existing_indexes:
        with op.batch_alter_table("prompt_presets", schema=None) as batch_op:
            batch_op.create_index("ix_prompt_presets_enabled", ["enabled"], unique=False)
    if "ix_prompt_presets_trigger" not in existing_indexes:
        with op.batch_alter_table("prompt_presets", schema=None) as batch_op:
            batch_op.create_index("ix_prompt_presets_trigger", ["trigger"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "prompt_presets" not in inspector.get_table_names():
        return

    existing_indexes = {idx["name"] for idx in inspector.get_indexes("prompt_presets")}
    if "ix_prompt_presets_enabled" in existing_indexes:
        with op.batch_alter_table("prompt_presets", schema=None) as batch_op:
            batch_op.drop_index("ix_prompt_presets_enabled")
    if "ix_prompt_presets_trigger" in existing_indexes:
        with op.batch_alter_table("prompt_presets", schema=None) as batch_op:
            batch_op.drop_index("ix_prompt_presets_trigger")

    op.drop_table("prompt_presets")
