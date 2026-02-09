"""repair missing schema tables

Revision ID: c1a0c9d5e7f3
Revises: b8acaef4ce96
Create Date: 2026-02-09 15:26:00.000000

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c1a0c9d5e7f3"
down_revision: str | None = "b8acaef4ce96"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "templates" not in existing_tables:
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
        existing_tables.add("templates")

    if "templates" in existing_tables:
        inspector = sa.inspect(bind)
        existing_indexes = {idx["name"] for idx in inspector.get_indexes("templates")}
        if "ix_templates_is_builtin" not in existing_indexes:
            with op.batch_alter_table("templates", schema=None) as batch_op:
                batch_op.create_index("ix_templates_is_builtin", ["is_builtin"], unique=False)

    if "source_tags" not in existing_tables:
        op.create_table(
            "source_tags",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("notebook_id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=64), nullable=False),
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
            sa.UniqueConstraint("notebook_id", "name", name="uq_source_tags_notebook_id_name"),
        )
        existing_tables.add("source_tags")

    if "source_tags" in existing_tables:
        inspector = sa.inspect(bind)
        existing_indexes = {idx["name"] for idx in inspector.get_indexes("source_tags")}
        if "ix_source_tags_notebook_id" not in existing_indexes:
            with op.batch_alter_table("source_tags", schema=None) as batch_op:
                batch_op.create_index("ix_source_tags_notebook_id", ["notebook_id"], unique=False)
        if "ix_source_tags_notebook_id_name" not in existing_indexes:
            with op.batch_alter_table("source_tags", schema=None) as batch_op:
                batch_op.create_index(
                    "ix_source_tags_notebook_id_name",
                    ["notebook_id", "name"],
                    unique=False,
                )

    if "source_tag_map" not in existing_tables:
        op.create_table(
            "source_tag_map",
            sa.Column("source_id", sa.Integer(), nullable=False),
            sa.Column("tag_id", sa.Integer(), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(),
                server_default=sa.text("(CURRENT_TIMESTAMP)"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(["source_id"], ["sources.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["tag_id"], ["source_tags.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("source_id", "tag_id"),
        )
        existing_tables.add("source_tag_map")

    if "source_tag_map" in existing_tables:
        inspector = sa.inspect(bind)
        existing_indexes = {idx["name"] for idx in inspector.get_indexes("source_tag_map")}
        if "ix_source_tag_map_tag_id" not in existing_indexes:
            with op.batch_alter_table("source_tag_map", schema=None) as batch_op:
                batch_op.create_index("ix_source_tag_map_tag_id", ["tag_id"], unique=False)


def downgrade() -> None:
    # This migration is a repair step for existing DBs whose schema drifted from
    # earlier revisions. Downgrading should be non-destructive.
    return
