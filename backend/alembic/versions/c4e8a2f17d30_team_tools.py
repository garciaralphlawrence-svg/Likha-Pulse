"""team tools: client names, reply tracking, imported history, reply templates; retire Google reviews

Revision ID: c4e8a2f17d30
Revises: b2c7e41d9a10
Create Date: 2026-11-27 12:00:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c4e8a2f17d30"
down_revision: Union[str, Sequence[str], None] = "b2c7e41d9a10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("feedback") as b:
        b.add_column(sa.Column("author_name", sa.String(length=120), nullable=True))
        b.add_column(sa.Column("first_reply_at", sa.DateTime(timezone=True), nullable=True))
        b.add_column(sa.Column("handled_by_id", sa.String(length=32), nullable=True))
        b.add_column(sa.Column("is_imported", sa.Boolean(), nullable=False, server_default=sa.false()))
        b.create_foreign_key("fk_feedback_handled_by", "users", ["handled_by_id"], ["id"], ondelete="SET NULL")
        b.create_index("ix_feedback_handled_by_id", ["handled_by_id"])
    op.create_table(
        "reply_templates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("situation", sa.String(length=30), nullable=False),
        sa.Column("language", sa.String(length=10), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False),
        sa.Column("updated_by", sa.String(length=120), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_reply_templates_situation", "reply_templates", ["situation"])

    # Google reviews are no longer collected (Facebook comments and Messenger only).
    # Sample Google rows are removed; real ones are kept as imported history. Child rows cascade.
    conn = op.get_bind()
    g = conn.execute(sa.text("SELECT id FROM platforms WHERE code = 'google_business'")).scalar()
    if g is not None:
        imp = conn.execute(sa.text("SELECT id FROM platforms WHERE code = 'import'")).scalar()
        if imp is None:
            conn.execute(sa.text("INSERT INTO platforms (code, name, status, status_detail, enabled) "
                                 "VALUES ('import', 'Imported file', 'connected', '', :t)"), {"t": True})
            imp = conn.execute(sa.text("SELECT id FROM platforms WHERE code = 'import'")).scalar()
        sample_ids = sa.text("SELECT id FROM feedback WHERE platform_id = :g AND is_sample = :t")
        for table in ("sentiment_results", "emotion_results", "intent_results", "topic_results", "priority_assessments", "human_reviews", "cases"):
            conn.execute(sa.text(f"DELETE FROM {table} WHERE feedback_id IN ({sample_ids.text})"), {"g": g, "t": True})
        conn.execute(sa.text(f"UPDATE notifications SET feedback_id = NULL WHERE feedback_id IN ({sample_ids.text})"), {"g": g, "t": True})
        conn.execute(sa.text("DELETE FROM feedback WHERE platform_id = :g AND is_sample = :t"), {"g": g, "t": True})
        conn.execute(sa.text("UPDATE feedback SET platform_id = :imp, is_imported = :t WHERE platform_id = :g"), {"imp": imp, "g": g, "t": True})
        conn.execute(sa.text("DELETE FROM platforms WHERE id = :g"), {"g": g})


def downgrade() -> None:
    op.drop_index("ix_reply_templates_situation", table_name="reply_templates")
    op.drop_table("reply_templates")
    with op.batch_alter_table("feedback") as b:
        b.drop_index("ix_feedback_handled_by_id")
        b.drop_constraint("fk_feedback_handled_by", type_="foreignkey")
        b.drop_column("is_imported")
        b.drop_column("handled_by_id")
        b.drop_column("first_reply_at")
        b.drop_column("author_name")
