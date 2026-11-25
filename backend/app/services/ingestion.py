"""Stores collected feedback (with duplicate detection) and runs analysis on it."""
from __future__ import annotations

import hashlib
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import anonymize
from app.integrations.base import FetchedItem, IntegrationError
from app.integrations.platforms import REGISTRY
from app.models import Feedback, Platform
from app.nlp.pipeline import analyze_feedback
from app.nlp.rule_engine import normalize
from app.services import notifications

PLATFORM_NAMES = {"google_business": "Google Business Profile", "facebook_page": "Facebook Page comments",
                  "messenger": "Facebook Messenger", "manual": "Manual entry"}


def ensure_platforms(db: Session) -> None:
    existing = {p.code for p in db.scalars(select(Platform))}
    for code, name in PLATFORM_NAMES.items():
        if code not in existing:
            db.add(Platform(code=code, name=name, status="connected" if code == "manual" else "not_connected"))
    db.commit()


def content_hash(platform_code: str, external_id: str | None, content: str, author: str | None) -> str:
    key = f"{platform_code}|{external_id}" if external_id else f"{platform_code}|{author or ''}|{normalize(content)}"
    return hashlib.sha256(key.encode()).hexdigest()


def ingest(db: Session, platform_code: str, item: FetchedItem, is_sample: bool = False, notify: bool = True) -> Feedback | None:
    platform = db.scalar(select(Platform).where(Platform.code == platform_code))
    h = content_hash(platform_code, item.external_id, item.content, item.author)
    if db.scalar(select(Feedback.id).where(Feedback.platform_id == platform.id, Feedback.content_hash == h)):
        return None  # duplicate
    fb = Feedback(platform_id=platform.id, external_id=item.external_id, parent_reference=item.parent_reference,
                  source_url=item.source_url, author_ref=anonymize(item.author), content=item.content.strip()[:5000],
                  rating=item.rating, content_hash=h, is_sample=is_sample,
                  created_at=item.created_at or datetime.now(timezone.utc))
    db.add(fb)
    db.flush()
    analyze_feedback(db, fb, commit=True)
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
                           author=row["author"], rating=row["rating"])
        if ingest(db, row["platform"], item, is_sample=True, notify=False):
            n += 1
    notifications.run_periodic_checks(db)
    return n
