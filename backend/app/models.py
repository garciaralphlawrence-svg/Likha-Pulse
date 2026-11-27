"""Database tables (see docs/ARCHITECTURE.md)."""
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Integer, String, Table
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


class TravelRequest(Base):
    """One customer request = one reference number. `data` holds the full request (AI recommendation, offer,
    approval and the who/when/why trail) in the same JSON shape the frontend uses; the other columns are for lookups."""
    __tablename__ = "travel_requests"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    ref: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(30), index=True)
    customer_name: Mapped[str] = mapped_column(String(120))
    contact: Mapped[str] = mapped_column(String(160))
    destination: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    assignee_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    data: Mapped[dict] = mapped_column(JSON)


class CustomerMessage(Base):
    """A Facebook comment, Messenger chat or imported message. `data` holds the full message (same shape as the frontend)."""
    __tablename__ = "customer_messages"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    channel: Mapped[str] = mapped_column(String(20), index=True)
    client_key: Mapped[str] = mapped_column(String(200), index=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False)
    is_imported: Mapped[bool] = mapped_column(Boolean, default=False)
    request_id: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    case_id: Mapped[str | None] = mapped_column(String(20), nullable=True)
    external_id: Mapped[str | None] = mapped_column(String(200), nullable=True, unique=True)
    data: Mapped[dict] = mapped_column(JSON)


class CaseRecord(Base):
    """Response Clock case ("CASE-0001"): deadline, owner, playbook steps and updates live in `data`."""
    __tablename__ = "cases"
    id: Mapped[str] = mapped_column(String(20), primary_key=True)
    request_id: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    message_id: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    client_key: Mapped[str] = mapped_column(String(200), index=True)
    owner_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False)
    data: Mapped[dict] = mapped_column(JSON)


class ReplyTemplate(Base):
    """Suggested reply the team can copy (never sent automatically). Defaults come from app/quotes/reply_templates.json."""
    __tablename__ = "reply_templates"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    situation: Mapped[str] = mapped_column(String(40), index=True)
    language: Mapped[str] = mapped_column(String(10), default="en")
    title: Mapped[str] = mapped_column(String(120))
    body: Mapped[str] = mapped_column(String(2000))
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_by: Mapped[str] = mapped_column(String(120), default="PAPH")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class Counter(Base):
    """Running numbers for cases (CASE-0001) and messages (msg-1)."""
    __tablename__ = "counters"
    name: Mapped[str] = mapped_column(String(20), primary_key=True)
    last: Mapped[int] = mapped_column(Integer, default=0)


class RefCounter(Base):
    """Last reference number used per year (PAPH-2026-0001, PAPH-2026-0002, ...)."""
    __tablename__ = "ref_counters"
    year: Mapped[int] = mapped_column(Integer, primary_key=True)
    last: Mapped[int] = mapped_column(Integer, default=0)


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
