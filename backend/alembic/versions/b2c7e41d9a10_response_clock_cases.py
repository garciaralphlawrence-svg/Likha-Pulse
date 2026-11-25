"""response clock cases

Revision ID: b2c7e41d9a10
Revises: 947fd091b0b1
Create Date: 2026-11-25 21:00:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b2c7e41d9a10"
down_revision: Union[str, Sequence[str], None] = "947fd091b0b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "cases",
        sa.Column("feedback_id", sa.String(length=32), sa.ForeignKey("feedback.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("situation", sa.String(length=30), nullable=False),
        sa.Column("traveling_now", sa.Boolean(), nullable=False),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deadline_hours", sa.Integer(), nullable=False),
        sa.Column("reply_due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("first_reply_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_update_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("assignee_id", sa.String(length=32), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("escalated", sa.Boolean(), nullable=False),
        sa.Column("steps", sa.JSON(), nullable=False),
        sa.Column("updates", sa.JSON(), nullable=False),
    )
    op.create_index("ix_cases_due_at", "cases", ["due_at"])
    op.create_index("ix_cases_resolved_at", "cases", ["resolved_at"])


def downgrade() -> None:
    op.drop_index("ix_cases_resolved_at", table_name="cases")
    op.drop_index("ix_cases_due_at", table_name="cases")
    op.drop_table("cases")
