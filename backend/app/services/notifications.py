"""Alert rules (Module 9). Each alert has a dedupe key so the same issue is never announced twice."""
from __future__ import annotations

import logging
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Feedback, Notification, PriorityAssessment, User
from app.services.analytics import summarize
from app.services.filters import FeedbackFilters, fetch
from app.services.settings_service import get_setting

log = logging.getLogger(__name__)


def _push(db: Session, kind: str, severity: str, title: str, message: str, dedupe: str, feedback_id: str | None = None) -> bool:
    if db.scalar(select(Notification.id).where(Notification.dedupe_key == dedupe)):
        return False
    db.add(Notification(kind=kind, severity=severity, title=title, message=message, dedupe_key=dedupe, feedback_id=feedback_id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return False
    if get_setting(db, "alerts").get("email_enabled") and severity in ("critical", "high"):
        _email(db, title, message)
    return True


def _email(db: Session, title: str, message: str) -> None:
    s = get_settings()
    if not s.smtp_host or not s.smtp_from:
        return
    recipients = [u.email for u in db.scalars(select(User).where(User.is_active.is_(True))) if u.role.name in ("SUPER_ADMIN", "ADMIN")]
    if not recipients:
        return
    msg = EmailMessage()
    msg["Subject"], msg["From"], msg["To"] = f"[Likha Pulse] {title}", s.smtp_from, ", ".join(recipients)
    msg.set_content(message)
    try:
        with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=20) as smtp:
            smtp.starttls()
            if s.smtp_user:
                smtp.login(s.smtp_user, s.smtp_password)
            smtp.send_message(msg)
    except (smtplib.SMTPException, OSError) as e:
        log.warning("Email notification failed: %s", e)


def on_new_feedback(db: Session, fb: Feedback) -> None:
    level = fb.priority.final_level if fb.priority else "low"
    snippet = (fb.content[:140] + "…") if len(fb.content) > 140 else fb.content
    if level == "critical":
        _push(db, "critical_feedback", "critical", f"Critical feedback on {fb.platform.name}", f"{snippet}\nReason: {fb.priority.reason}",
              f"critical:{fb.id}", fb.id)
    elif level == "high":
        _push(db, "high_priority", "high", f"High-priority feedback on {fb.platform.name}", f"{snippet}\nReason: {fb.priority.reason}",
              f"high:{fb.id}", fb.id)


def run_periodic_checks(db: Session) -> int:
    cfg = get_setting(db, "alerts")
    now = datetime.now(timezone.utc)
    created = 0
    week = now.strftime("%G-W%V")
    # negative spike: last 7 days vs previous 7 days
    cur = summarize(fetch(db, FeedbackFilters(date_from=now - timedelta(days=7), date_to=now)))["kpis"]
    prev = summarize(fetch(db, FeedbackFilters(date_from=now - timedelta(days=14), date_to=now - timedelta(days=7))))["kpis"]
    if cur["total"] >= 5 and prev["total"] >= 5:
        rise = cur["negative_pct"] - prev["negative_pct"]
        if rise >= cfg["negative_spike_pct"] / 2 and cur["negative_pct"] >= prev["negative_pct"] * (1 + cfg["negative_spike_pct"] / 100):
            created += _push(db, "negative_spike", "high", "Negative sentiment increased",
                             f"Negative share rose from {prev['negative_pct']}% to {cur['negative_pct']}% in the last 7 days.", f"spike:{week}")
    # repeated complaints by topic this week
    rows = fetch(db, FeedbackFilters(date_from=now - timedelta(days=7), date_to=now, sentiment="negative"))
    counts: dict[str, int] = {}
    for r in rows:
        for t in r.topics:
            if t.is_primary and t.topic != "General":
                counts[t.topic] = counts.get(t.topic, 0) + 1
    for topic, n in counts.items():
        if n >= cfg["repeated_complaint_count"]:
            created += _push(db, "repeated_complaint", "high", f"Repeated complaints: {topic}",
                             f"{n} negative messages about {topic} in the last 7 days.", f"repeated:{topic}:{week}")
    # unresolved high-priority items older than N days
    cutoff = now - timedelta(days=cfg["unresolved_days"])
    stale = db.scalars(select(Feedback).join(PriorityAssessment).where(
        PriorityAssessment.final_level.in_(["critical", "high"]), Feedback.action_status != "resolved",
        Feedback.created_at <= cutoff, Feedback.created_at >= now - timedelta(days=60))).unique().all()
    for fb in stale:
        created += _push(db, "unresolved", "high", "Unresolved high-priority feedback",
                         f"Open for more than {cfg['unresolved_days']} days: {fb.content[:140]}", f"unresolved:{fb.id}", fb.id)
    return created
