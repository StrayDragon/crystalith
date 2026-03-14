"""add source connector bindings

Revision ID: d2b4a7c9e8f1
Revises: f1e2d3c4b5a6
Create Date: 2026-03-14 12:00:00.000000

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d2b4a7c9e8f1"
down_revision: str | None = "f1e2d3c4b5a6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "source_connector_bindings" not in inspector.get_table_names():
        op.create_table(
            "source_connector_bindings",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("notebook_id", sa.Integer(), nullable=False),
            sa.Column("connector_id", sa.String(length=128), nullable=False),
            sa.Column("connection_config", sa.JSON(), nullable=False),
            sa.Column("import_scope", sa.JSON(), nullable=True),
            sa.Column("last_confirmed_snapshot", sa.JSON(), nullable=True),
            sa.Column("last_sync_check_result", sa.JSON(), nullable=True),
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
            sa.PrimaryKeyConstraint("id"),
        )

    existing_indexes = {idx["name"] for idx in inspector.get_indexes("source_connector_bindings")}
    if "ix_source_connector_bindings_notebook_id" not in existing_indexes:
        with op.batch_alter_table("source_connector_bindings", schema=None) as batch_op:
            batch_op.create_index("ix_source_connector_bindings_notebook_id", ["notebook_id"], unique=False)
    if "ix_source_connector_bindings_notebook_id_connector_id" not in existing_indexes:
        with op.batch_alter_table("source_connector_bindings", schema=None) as batch_op:
            batch_op.create_index(
                "ix_source_connector_bindings_notebook_id_connector_id",
                ["notebook_id", "connector_id"],
                unique=False,
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "source_connector_bindings" not in inspector.get_table_names():
        return

    existing_indexes = {idx["name"] for idx in inspector.get_indexes("source_connector_bindings")}
    if "ix_source_connector_bindings_notebook_id_connector_id" in existing_indexes:
        with op.batch_alter_table("source_connector_bindings", schema=None) as batch_op:
            batch_op.drop_index("ix_source_connector_bindings_notebook_id_connector_id")
    if "ix_source_connector_bindings_notebook_id" in existing_indexes:
        with op.batch_alter_table("source_connector_bindings", schema=None) as batch_op:
            batch_op.drop_index("ix_source_connector_bindings_notebook_id")

    op.drop_table("source_connector_bindings")
