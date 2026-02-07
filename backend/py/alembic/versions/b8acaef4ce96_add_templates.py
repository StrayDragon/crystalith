"""add templates

Revision ID: b8acaef4ce96
Revises: 963103e80f8e
Create Date: 2026-02-08 15:16:54.606950

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa



# revision identifiers, used by Alembic.
revision: str = 'b8acaef4ce96'
down_revision: str | None = '963103e80f8e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "templates" not in inspector.get_table_names():
        op.create_table(
            "templates",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("config_json", sa.JSON(), nullable=False),
            sa.Column("is_builtin", sa.Boolean(), server_default=sa.false(), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(),
                server_default=sa.text("(CURRENT_TIMESTAMP)"),
                nullable=False,
            ),
            sa.PrimaryKeyConstraint("id"),
        )

    existing_indexes = {idx["name"] for idx in inspector.get_indexes("templates")}
    if "ix_templates_is_builtin" not in existing_indexes:
        with op.batch_alter_table("templates", schema=None) as batch_op:
            batch_op.create_index("ix_templates_is_builtin", ["is_builtin"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "templates" not in inspector.get_table_names():
        return

    existing_indexes = {idx["name"] for idx in inspector.get_indexes("templates")}
    if "ix_templates_is_builtin" in existing_indexes:
        with op.batch_alter_table("templates", schema=None) as batch_op:
            batch_op.drop_index("ix_templates_is_builtin")

    op.drop_table("templates")
