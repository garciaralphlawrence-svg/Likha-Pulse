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


def smtp_ready() -> bool:
    s = get_settings()
    return bool(s.smtp_host and s.smtp_from)


def send_email(recipients: list[str], subject: str, text: str, html: str | None = None) -> tuple[bool, str]:
    """Send one email through the SMTP server in .env. Without SMTP settings nothing is sent; it is only logged."""
    s = get_settings()
    if not recipients:
        return False, "No recipient email address."
    if not smtp_ready():
        log.info("Email not sent (SMTP_HOST / SMTP_FROM not set): %s -> %s", subject, ", ".join(recipients))
        return False, "Email is not set up on the server yet (SMTP), so nothing was sent."
    msg = EmailMessage()
    msg["Subject"], msg["From"], msg["To"] = subject, s.smtp_from, ", ".join(recipients)
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")
    try:
        with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=20) as smtp:
            if s.smtp_tls:
                smtp.starttls()
            if s.smtp_user:
                smtp.login(s.smtp_user, s.smtp_password)
            smtp.send_message(msg)
    except (smtplib.SMTPException, OSError) as e:
        log.warning("Email failed: %s", e)
        return False, f"The email server refused the message: {e}"
    return True, f"Sent to {', '.join(recipients)}."


def owner_emails(db: Session, roles: tuple[str, ...] = ("SUPER_ADMIN",)) -> list[str]:
    return [u.email for u in db.scalars(select(User).where(User.is_active.is_(True))) if u.role.name in roles]


def _email(db: Session, title: str, message: str) -> None:
    send_email(owner_emails(db, ("SUPER_ADMIN", "ADMIN")), f"[Likha Pulse] {title}", message)


def on_new_feedback(db: Session, fb: Feedback) -> None:
    level = fb.priority.final_level if fb.priority else "low"
    snippet = (fb.content[:140] + "…") if len(fb.content) > 140 else fb.content
    from app.services.watch import hits, watch_words
    found = hits(fb.content, watch_words(db))
    if found:
        _push(db, "keyword_match", "high", f"Watch word: {', '.join(found)}", f"{snippet}\nOn {fb.platform.name}", f"keyword:{fb.id}", fb.id)
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
    # keyword watch: recent messages that contain a watch word (also catches words added after a message arrived)
    from app.services.watch import hits, watch_words
    words = watch_words(db)
    if words:
        for fb in db.scalars(select(Feedback).where(Feedback.created_at >= now - timedelta(hours=48), Feedback.is_imported.is_(False))).unique().all():
            found = hits(fb.content, words)
            if found:
                snip = fb.content if len(fb.content) <= 140 else fb.content[:140] + "…"
                created += _push(db, "keyword_match", "high", f"Watch word: {', '.join(found)}", f"{snip}\nOn {fb.platform.name}", f"keyword:{fb.id}", fb.id)
    from app.services.cases import clock_checks
    return created + clock_checks(db, _push)
