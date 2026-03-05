"""add session shared state and ui event receipts

Revision ID: c9a4e6d1b2f3
Revises: f7d3a1b9c4e2
Create Date: 2026-03-06 14:30:00.000000

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision: str = "c9a4e6d1b2f3"
down_revision: str | None = "f7d3a1b9c4e2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    session_columns = {col["name"] for col in inspector.get_columns("sessions")}
    with op.batch_alter_table("sessions", schema=None) as batch_op:
        if "shared_state" not in session_columns:
            batch_op.add_column(
                sa.Column(
                    "shared_state",
                    sa.JSON(),
                    nullable=False,
                    server_default=sa.text("'{}'"),
                )
            )
        if "shared_state_revision" not in session_columns:
            batch_op.add_column(
                sa.Column(
                    "shared_state_revision",
                    sa.Integer(),
                    nullable=False,
                    server_default=sa.text("0"),
                )
            )

    if "ui_event_receipts" not in inspector.get_table_names():
        op.create_table(
            "ui_event_receipts",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("session_id", sa.Integer(), nullable=False),
            sa.Column("client_request_id", sa.String(length=128), nullable=False),
            sa.Column("component_id", sa.String(length=255), nullable=False),
            sa.Column("event_name", sa.String(length=128), nullable=False),
            sa.Column("base_revision", sa.Integer(), nullable=False),
            sa.Column("shared_state_revision", sa.Integer(), nullable=False),
            sa.Column("state_delta", sa.JSON(), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(),
                server_default=sa.text("(CURRENT_TIMESTAMP)"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(["session_id"], ["sessions.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "session_id",
                "client_request_id",
                name="uq_ui_event_receipts_session_id_client_request_id",
            ),
        )

    existing_indexes = {idx["name"] for idx in inspector.get_indexes("ui_event_receipts")} if "ui_event_receipts" in inspector.get_table_names() else set()
    with op.batch_alter_table("ui_event_receipts", schema=None) as batch_op:
        if "ix_ui_event_receipts_session_id" not in existing_indexes:
            batch_op.create_index("ix_ui_event_receipts_session_id", ["session_id"], unique=False)
        if "ix_ui_event_receipts_session_id_created_at" not in existing_indexes:
            batch_op.create_index("ix_ui_event_receipts_session_id_created_at", ["session_id", "created_at"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "ui_event_receipts" in inspector.get_table_names():
        existing_indexes = {idx["name"] for idx in inspector.get_indexes("ui_event_receipts")}
        with op.batch_alter_table("ui_event_receipts", schema=None) as batch_op:
            if "ix_ui_event_receipts_session_id_created_at" in existing_indexes:
                batch_op.drop_index("ix_ui_event_receipts_session_id_created_at")
            if "ix_ui_event_receipts_session_id" in existing_indexes:
                batch_op.drop_index("ix_ui_event_receipts_session_id")
        op.drop_table("ui_event_receipts")

    session_columns = {col["name"] for col in inspector.get_columns("sessions")}
    with op.batch_alter_table("sessions", schema=None) as batch_op:
        if "shared_state_revision" in session_columns:
            batch_op.drop_column("shared_state_revision")
        if "shared_state" in session_columns:
            batch_op.drop_column("shared_state")
