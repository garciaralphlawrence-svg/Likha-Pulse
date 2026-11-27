"""Stores customer messages, Response Clock cases and suggested replies; receives Facebook/Messenger messages;
opens cases from customers' own words; sends the weekly report."""
from __future__ import annotations

import hashlib
import logging
import smtplib
from email.message import EmailMessage

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import CaseRecord, Counter, CustomerMessage, ReplyTemplate, Role, SystemSetting, TravelRequest, User
from app.quotes import care as C
from app.quotes import clock as K
from app.quotes.workflow import iso, now_iso, parse_iso

log = logging.getLogger(__name__)


# ---------- running numbers ----------
def next_number(db: Session, name: str) -> int:
    row = db.execute(select(Counter).where(Counter.name == name).with_for_update()).scalar_one_or_none()
    if not row:
        row = Counter(name=name, last=0)
        db.add(row)
    row.last += 1
    db.flush()
    return row.last


def bump_counter(db: Session, name: str, at_least: int) -> None:
    row = db.get(Counter, name) or Counter(name=name, last=0)
    row.last = max(row.last or 0, at_least)
    db.add(row)


def next_case_id(db: Session) -> str:
    return f"CASE-{next_number(db, 'case'):04d}"


def next_msg_id(db: Session) -> str:
    return f"msg-{next_number(db, 'msg')}"


# ---------- rows <-> dicts ----------
def msg_row(row: CustomerMessage | None, m: dict) -> CustomerMessage:
    row = row or CustomerMessage(id=m["id"])
    row.channel, row.client_key, row.at = m["channel"], m["client_key"], parse_iso(m["at"])
    row.is_sample, row.is_imported, row.request_id, row.case_id = m["is_sample"], m["is_imported"], m["request_id"], m["case_id"]
    row.external_id = m.get("external_id") or None
    row.data = m
    return row


def case_row(row: CaseRecord | None, c: dict) -> CaseRecord:
    row = row or CaseRecord(id=c["id"])
    row.request_id, row.message_id, row.client_key = c["request_id"], c["message_id"], c["client_key"]
    row.owner_id = (c.get("owner") or {}).get("id")
    row.opened_at = parse_iso(c["opened_at"])
    row.resolved_at = parse_iso(c["resolved_at"]) if c["resolved_at"] else None
    row.is_sample, row.data = c["is_sample"], c
    return row


def all_messages(db: Session) -> list[dict]:
    return [r.data for r in db.scalars(select(CustomerMessage).order_by(CustomerMessage.at))]


def all_cases(db: Session) -> list[dict]:
    return [r.data for r in db.scalars(select(CaseRecord).order_by(CaseRecord.opened_at))]


def save_many(db: Session, messages: list[dict], cases: list[dict]) -> None:
    for m in messages:
        db.add(msg_row(None, m))
    for c in cases:
        db.add(case_row(None, c))


# ---------- who may see a case ----------
def can_see(user: User, c: dict, assignee_of: dict) -> bool:
    """Owner sees every case; others see cases they own, cases on requests assigned to them, and unassigned open ones."""
    if user.role.name == "ADMIN":
        return True
    if (c.get("owner") or {}).get("id") == user.id:
        return True
    if c.get("request_id") and assignee_of.get(c["request_id"]) == user.id:
        return True
    return not c.get("owner") and not c.get("resolved_at")


def request_assignees(db: Session) -> dict:
    return {r.id: r.assignee_id for r in db.scalars(select(TravelRequest))}


# ---------- messages from Facebook / Messenger ----------
def author_key(author_id: str | None, name: str | None) -> tuple[str, str]:
    """(client_key, display name). Real people are a salted code unless ANONYMIZE_AUTHORS=false."""
    s = get_settings()
    if not s.anonymize_authors and name:
        return C.name_key(name), name[:120]
    raw = author_id or name or "anonymous"
    key = "a:" + hashlib.sha256((s.author_hash_salt + raw).encode()).hexdigest()[:10]
    return key, C.client_label(name or "Client", key, True, False)


def receive_live(db: Session, *, channel: str, text: str, at: str, author_id: str | None, author_name: str | None, external_id: str,
                 settings: dict) -> dict | None:
    """Save one fetched message (skips duplicates by external id); an unhappy one opens a case right away."""
    if db.scalar(select(CustomerMessage.id).where(CustomerMessage.external_id == external_id)):
        return None
    key, client = author_key(author_id, author_name)
    got = C.receive_message(id=next_msg_id(db), channel=channel, client=client, text=text, at=at, external_id=external_id,
                            case_id="", s=settings, client_key=key)
    m, c = got["message"], got["case"]
    if c:
        c["id"] = m["case_id"] = next_case_id(db)
        db.add(case_row(None, c))
    db.add(msg_row(None, m))
    db.commit()
    return m


def sync_platform(db: Session, code: str, settings: dict) -> dict:
    """Fetch new items from one connected platform. Never raises: returns {status, added, detail}."""
    from datetime import datetime, timezone

    from app.integrations.base import IntegrationError
    from app.integrations.platforms import REGISTRY

    integ = REGISTRY.get(code)
    if not integ:
        return {"status": "error", "added": 0, "detail": "Unknown connection."}
    st = integ.status()
    if not st.connected:
        return {"status": "not_connected", "added": 0, "detail": st.detail}
    state = (db.get(SystemSetting, "integrations") or SystemSetting(key="integrations", value={}))
    value = dict(state.value or {})
    last = (value.get(code) or {}).get("last_sync_at")
    try:
        items = integ.fetch(parse_iso(last) if last else None)
    except IntegrationError as e:
        value[code] = {**(value.get(code) or {}), "error": str(e)[:300]}
        state.value = value
        db.merge(state)
        db.commit()
        return {"status": "error", "added": 0, "detail": str(e)[:300]}
    added = 0
    for it in items:
        if receive_live(db, channel=code, text=it.content, at=iso(it.created_at), author_id=it.author, author_name=it.author_name,
                        external_id=f"{code}:{it.external_id}", settings=settings):
            added += 1
    value[code] = {"last_sync_at": iso(datetime.now(timezone.utc)), "error": ""}
    state.value = value
    db.merge(state)
    db.commit()
    return {"status": "connected", "added": added, "detail": f"{added} new message{'s' if added != 1 else ''}."}


# ---------- cases opened by the customer's own words on a request ----------
def auto_case(db: Session, req: dict, action: str, note: str, rating, settings: dict) -> dict | None:
    a = K.auto_case_for(action, note or "", rating)
    if not a:
        return None
    c = K.open_case(id=next_case_id(db), now=now_iso(), source=a["source"], situation=a["situation"], text=note or f"{rating} of 5 stars",
                    client=req["customer"]["name"], client_key=C.contact_key(req["customer"]["contact"]), by="PAPH AI",
                    request={"id": req["id"], "ref": req["ref"]}, owner=req.get("assignee"), is_sample=req["is_sample"], rating=rating, s=settings)
    db.add(case_row(None, c))
    db.commit()
    return c


# ---------- suggested replies ----------
def template_out(t: ReplyTemplate) -> dict:
    return {"id": t.id, "situation": t.situation, "language": t.language, "title": t.title, "body": t.body, "is_default": t.is_default,
            "updated_by": t.updated_by, "updated_at": iso(t.updated_at) if t.updated_at else None}


def seed_templates(db: Session) -> int:
    if db.scalar(select(ReplyTemplate.id).limit(1)):
        return 0
    for t in C.DEFAULT_REPLIES:
        db.add(ReplyTemplate(situation=t["situation"], language=t["language"], title=t["title"], body=t["body"], is_default=True, updated_by="PAPH"))
    db.commit()
    return len(C.DEFAULT_REPLIES)


# ---------- weekly report ----------
def weekly_recipients(db: Session, settings: dict) -> list[str]:
    listed = [x.strip() for x in str(settings.get("weekly_recipients") or "").replace(";", ",").split(",") if x.strip()]
    if listed:
        return listed
    admin = db.scalar(select(Role.id).where(Role.name == "ADMIN"))
    return [u.email for u in db.scalars(select(User).where(User.role_id == admin, User.is_active.is_(True))) if not u.email.endswith("@example.com")]


def send_weekly(db: Session, settings: dict, requests: list[dict]) -> dict:
    """Email the weekly report when SMTP is set; otherwise write it to the log. Returns {sent, detail}."""
    rep = C.weekly_report(requests, all_messages(db), all_cases(db), settings, now_iso())
    body = C.weekly_text(rep)
    to = weekly_recipients(db, settings)
    s = get_settings()
    if not settings.get("weekly_enabled", True):
        return {"sent": False, "detail": "The weekly report is turned off in Settings."}
    if not s.smtp_host or not to:
        log.info("Weekly report (email not set up, so it is only logged):\n%s", body)
        why = "Email is not set up on the server (SMTP_HOST)" if not s.smtp_host else "No one to send it to"
        return {"sent": False, "detail": f"{why}, so the report was written to the server log instead."}
    msg = EmailMessage()
    msg["Subject"], msg["From"], msg["To"] = rep["subject"], s.smtp_from or s.smtp_user, ", ".join(to)
    msg.set_content(body)
    try:
        with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=30) as smtp:
            if s.smtp_tls:
                smtp.starttls()
            if s.smtp_user:
                smtp.login(s.smtp_user, s.smtp_password)
            smtp.send_message(msg)
    except (OSError, smtplib.SMTPException) as e:
        log.warning("Weekly report email failed: %s", e)
        return {"sent": False, "detail": f"The email could not be sent: {str(e)[:200]}"}
    return {"sent": True, "detail": f"Sent to {', '.join(to)}."}
