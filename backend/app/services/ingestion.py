"""Stores collected feedback (with duplicate detection) and runs analysis on it."""
from __future__ import annotations

import hashlib
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import anonymize
from app.integrations.base import FetchedItem, IntegrationError
from app.integrations.platforms import REGISTRY
from app.models import Feedback, Platform
from app.nlp.pipeline import analyze_feedback
from app.nlp.rule_engine import normalize
from app.services import notifications

PLATFORM_NAMES = {"facebook_page": "Facebook Page comments", "messenger": "Facebook Messenger",
                  "manual": "Manual entry", "import": "Imported file"}
LOCAL_SOURCES = ("manual", "import")  # always available, nothing to connect


def ensure_platforms(db: Session) -> None:
    existing = {p.code for p in db.scalars(select(Platform))}
    for code, name in PLATFORM_NAMES.items():
        if code not in existing:
            db.add(Platform(code=code, name=name, status="connected" if code in LOCAL_SOURCES else "not_connected"))
    db.commit()


def retire_google(db: Session) -> int:
    """Google reviews are no longer part of Likha Pulse (Facebook comments and Messenger only).
    Sample Google rows are removed; any real ones are kept as imported history. Runs once, then does nothing."""
    g = db.scalar(select(Platform).where(Platform.code == "google_business"))
    if not g:
        return 0
    imp = db.scalar(select(Platform).where(Platform.code == "import"))
    moved = 0
    for fb in db.scalars(select(Feedback).where(Feedback.platform_id == g.id)).unique().all():
        if fb.is_sample:
            db.delete(fb)
        else:
            fb.platform, fb.is_imported = imp, True
            moved += 1
    db.flush()
    db.delete(g)
    db.commit()
    return moved


def content_hash(platform_code: str, external_id: str | None, content: str, author: str | None) -> str:
    key = f"{platform_code}|{external_id}" if external_id else f"{platform_code}|{author or ''}|{normalize(content)}"
    return hashlib.sha256(key.encode()).hexdigest()


def ingest(db: Session, platform_code: str, item: FetchedItem, is_sample: bool = False, notify: bool = True,
           history: bool = False) -> Feedback | None:
    """Store and analyze one message. `history=True` is for imported past feedback: it counts in trends and
    client history, but it is saved as already handled, so it never opens a Response Clock case or an alert."""
    platform = db.scalar(select(Platform).where(Platform.code == platform_code))
    h = content_hash(platform_code, item.external_id, item.content, item.author)
    if db.scalar(select(Feedback.id).where(Feedback.platform_id == platform.id, Feedback.content_hash == h)):
        return None  # duplicate
    keep_name = is_sample or not get_settings().anonymize_authors
    fb = Feedback(platform_id=platform.id, external_id=item.external_id, parent_reference=item.parent_reference,
                  source_url=item.source_url, author_ref=anonymize(item.author), content=item.content.strip()[:5000],
                  rating=item.rating, content_hash=h, is_sample=is_sample, is_imported=history,
                  author_name=((item.author_name or "").strip()[:120] or None) if keep_name else None,
                  created_at=item.created_at or datetime.now(timezone.utc))
    db.add(fb)
    db.flush()
    analyze_feedback(db, fb, commit=True)
    if history:
        fb.action_status, fb.resolved_at = "resolved", fb.created_at
        db.commit()
        return fb
    from app.services.cases import open_case
    if open_case(db, fb):
        db.commit()
    if notify:
        notifications.on_new_feedback(db, fb)
    return fb


def sync_platform(db: Session, code: str) -> dict:
    integ = REGISTRY[code]
    platform = db.scalar(select(Platform).where(Platform.code == code))
    st = integ.status()
    if not st.connected:
        platform.status, platform.status_detail = "not_connected", st.detail
        db.commit()
        return {"platform": code, "status": "not_connected", "detail": st.detail, "missing": st.missing, "added": 0}
    try:
        items = integ.fetch(since=platform.last_sync_at)
    except IntegrationError as e:
        platform.status, platform.status_detail = "error", str(e)
        db.commit()
        return {"platform": code, "status": "error", "detail": str(e), "added": 0}
    added = sum(1 for it in items if ingest(db, code, it))
    platform.status, platform.status_detail = "connected", f"Last sync fetched {len(items)} item(s), {added} new."
    platform.last_sync_at = datetime.now(timezone.utc)
    db.commit()
    return {"platform": code, "status": "connected", "fetched": len(items), "added": added}


def seed_sample(db: Session) -> int:
    from app.integrations.sample_data import generate
    n = 0
    for row in generate():
        item = FetchedItem(external_id=row["external_id"], content=row["content"], created_at=row["created_at"],
                           author=row["author"], rating=row["rating"], author_name=row.get("author_name"))
        if ingest(db, row["platform"], item, is_sample=True, notify=False):
            n += 1
    from app.services.cases import seed_cases
    n += seed_cases(db)
    notifications.run_periodic_checks(db)
    return n
