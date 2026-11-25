"""Database tables. One class per table listed in docs/ARCHITECTURE.md."""
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import (JSON, Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Table, Text,
                        UniqueConstraint, Column)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def now() -> datetime:
    return datetime.now(timezone.utc)


def uid() -> str:
    return uuid4().hex


role_permissions = Table(
    "role_permissions", Base.metadata,
    Column("role_id", ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
)


class Role(Base):
    __tablename__ = "roles"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(40), unique=True)
    description: Mapped[str] = mapped_column(String(200), default="")
    permissions: Mapped[list["Permission"]] = relationship(secondary=role_permissions, lazy="selectin")


class Permission(Base):
    __tablename__ = "permissions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(60), unique=True)
    description: Mapped[str] = mapped_column(String(200), default="")


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    email: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(200))
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    reset_token_hash: Mapped[str | None] = mapped_column(String(200), nullable=True)
    reset_token_expires: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    role: Mapped[Role] = relationship(lazy="selectin")


class Platform(Base):
    __tablename__ = "platforms"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(40), unique=True)  # google_business, facebook_page, messenger
    name: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(30), default="not_connected")  # connected | not_connected | error
    status_detail: Mapped[str] = mapped_column(Text, default="")
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class PlatformAccount(Base):
    __tablename__ = "platform_accounts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    platform_id: Mapped[int] = mapped_column(ForeignKey("platforms.id", ondelete="CASCADE"))
    external_account_id: Mapped[str] = mapped_column(String(120))
    display_name: Mapped[str] = mapped_column(String(160), default="")
    credential_env_var: Mapped[str] = mapped_column(String(80), default="")  # name of env var, never the secret
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Feedback(Base):
    __tablename__ = "feedback"
    __table_args__ = (
        UniqueConstraint("platform_id", "content_hash", name="uq_feedback_platform_hash"),
        Index("ix_feedback_platform_created", "platform_id", "created_at"),
    )
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    platform_id: Mapped[int] = mapped_column(ForeignKey("platforms.id"))
    external_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    parent_reference: Mapped[str | None] = mapped_column(String(200), nullable=True)  # post or conversation id
    source_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    author_ref: Mapped[str] = mapped_column(String(80), default="anonymous")
    content: Mapped[str] = mapped_column(Text)
    rating: Mapped[float | None] = mapped_column(Float, nullable=True)  # e.g. Google star rating
    language: Mapped[str] = mapped_column(String(20), default="unknown")
    content_hash: Mapped[str] = mapped_column(String(64), index=True)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
    collected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    review_status: Mapped[str] = mapped_column(String(30), default="unreviewed")  # unreviewed | pending_review | reviewed
    action_status: Mapped[str] = mapped_column(String(30), default="open")  # open | pending_action | resolved
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    platform: Mapped[Platform] = relationship(lazy="joined")
    sentiment: Mapped["SentimentResult | None"] = relationship(back_populates="feedback", uselist=False, lazy="joined", cascade="all, delete-orphan")
    emotion: Mapped["EmotionResult | None"] = relationship(uselist=False, lazy="joined", cascade="all, delete-orphan")
    intent: Mapped["IntentResult | None"] = relationship(uselist=False, lazy="joined", cascade="all, delete-orphan")
    topics: Mapped[list["TopicResult"]] = relationship(lazy="selectin", cascade="all, delete-orphan")
    priority: Mapped["PriorityAssessment | None"] = relationship(uselist=False, lazy="joined", cascade="all, delete-orphan")
    reviews: Mapped[list["HumanReview"]] = relationship(lazy="selectin", cascade="all, delete-orphan", order_by="HumanReview.created_at")


class SentimentResult(Base):
    __tablename__ = "sentiment_results"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    feedback_id: Mapped[str] = mapped_column(ForeignKey("feedback.id", ondelete="CASCADE"), unique=True)
    label: Mapped[str] = mapped_column(String(20), index=True)  # positive | negative | neutral (AI prediction)
    score: Mapped[int] = mapped_column(Integer)  # -100..100
    confidence: Mapped[float] = mapped_column(Float)  # 0..1
    possible_sarcasm: Mapped[bool] = mapped_column(Boolean, default=False)
    reason: Mapped[str] = mapped_column(Text, default="")
    recommended_action: Mapped[str] = mapped_column(Text, default="")
    engine: Mapped[str] = mapped_column(String(30))  # rule | claude
    model_version: Mapped[str] = mapped_column(String(80))
    final_label: Mapped[str] = mapped_column(String(20), index=True)  # after human correction
    analyzed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    feedback: Mapped[Feedback] = relationship(back_populates="sentiment")


class EmotionResult(Base):
    __tablename__ = "emotion_results"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    feedback_id: Mapped[str] = mapped_column(ForeignKey("feedback.id", ondelete="CASCADE"), unique=True)
    emotion: Mapped[str] = mapped_column(String(30))
    final_emotion: Mapped[str] = mapped_column(String(30), index=True)
    scores: Mapped[dict] = mapped_column(JSON, default=dict)


class IntentResult(Base):
    __tablename__ = "intent_results"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    feedback_id: Mapped[str] = mapped_column(ForeignKey("feedback.id", ondelete="CASCADE"), unique=True)
    intent: Mapped[str] = mapped_column(String(40))
    final_intent: Mapped[str] = mapped_column(String(40), index=True)
    reason: Mapped[str] = mapped_column(Text, default="")


class TopicResult(Base):
    __tablename__ = "topic_results"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    feedback_id: Mapped[str] = mapped_column(ForeignKey("feedback.id", ondelete="CASCADE"), index=True)
    topic: Mapped[str] = mapped_column(String(60), index=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)


class PriorityAssessment(Base):
    __tablename__ = "priority_assessments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    feedback_id: Mapped[str] = mapped_column(ForeignKey("feedback.id", ondelete="CASCADE"), unique=True)
    level: Mapped[str] = mapped_column(String(20))  # critical | high | medium | low
    final_level: Mapped[str] = mapped_column(String(20), index=True)
    reason: Mapped[str] = mapped_column(Text, default="")


class HumanReview(Base):
    __tablename__ = "human_reviews"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    feedback_id: Mapped[str] = mapped_column(ForeignKey("feedback.id", ondelete="CASCADE"), index=True)
    reviewer_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    field: Mapped[str] = mapped_column(String(30))  # sentiment | emotion | intent | priority | confirm
    original_value: Mapped[str] = mapped_column(String(60))
    corrected_value: Mapped[str] = mapped_column(String(60))
    note: Mapped[str] = mapped_column(Text, default="")
    use_for_evaluation: Mapped[bool] = mapped_column(Boolean, default=False)  # approved-process flag
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    reviewer: Mapped[User] = relationship(lazy="joined")


class AIInsight(Base):
    __tablename__ = "ai_insights"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    filters: Mapped[dict] = mapped_column(JSON, default=dict)
    summary: Mapped[dict] = mapped_column(JSON, default=dict)  # sections of text
    aggregates: Mapped[dict] = mapped_column(JSON, default=dict)  # numbers the text is based on
    engine: Mapped[str] = mapped_column(String(30))
    created_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    kind: Mapped[str] = mapped_column(String(40))  # critical_feedback | high_priority | negative_spike | repeated_complaint | unresolved
    severity: Mapped[str] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(Text)
    feedback_id: Mapped[str | None] = mapped_column(ForeignKey("feedback.id", ondelete="SET NULL"), nullable=True)
    dedupe_key: Mapped[str] = mapped_column(String(200), unique=True)
    read_by: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)


class GeneratedReport(Base):
    __tablename__ = "generated_reports"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    report_type: Mapped[str] = mapped_column(String(40))
    file_format: Mapped[str] = mapped_column(String(10))
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    file_path: Mapped[str] = mapped_column(String(400))
    created_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    actor_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    actor_email: Mapped[str] = mapped_column(String(200), default="system")
    action: Mapped[str] = mapped_column(String(60), index=True)
    entity: Mapped[str] = mapped_column(String(60), default="")
    entity_id: Mapped[str] = mapped_column(String(80), default="")
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    ip: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)


class SystemSetting(Base):
    __tablename__ = "system_settings"
    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)
