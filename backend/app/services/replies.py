"""Suggested replies: ready templates in English and Taglish, picked by the situation of each message.

The team copies a reply and sends it themselves in Messenger or on Facebook. Nothing is sent automatically.
Defaults live in reply_templates.json (shared with the browser demo); the team can edit, add and delete them.
Same matching rule as frontend/src/lib/teamtools.ts (replyKey).
"""
from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Feedback, ReplyTemplate
from app.services.cases import situation_of

DATA: dict = json.loads((Path(__file__).parent / "reply_templates.json").read_text(encoding="utf-8"))
SITUATIONS: dict[str, str] = DATA["situations"]
LANGUAGES = {"en": "English", "tl": "Taglish"}


def reply_key(content: str, topic: str, intent: str, sentiment: str) -> str:
    """Which kind of reply fits this message."""
    situation = situation_of(content, topic)
    if situation == "documents":
        return "lost_passport"
    if situation == "emergency":
        return "emergency"
    if sentiment == "positive" or intent in ("compliment", "appreciation"):
        return "thank_you"
    if situation == "refund":
        return "refund"
    if situation == "transfer" or topic == "Waiting Time & Delays":
        return "delay"
    if situation in ("hotel", "visa", "booking"):
        return situation
    if intent == "inquiry":
        return "inquiry"
    if sentiment == "negative" or intent in ("complaint", "reported_problem", "follow_up_request"):
        return "complaint"
    return "general"


def seed_defaults(db: Session) -> int:
    """Load the default templates once (when the table is empty)."""
    if db.scalar(select(func.count(ReplyTemplate.id))):
        return 0
    for t in DATA["templates"]:
        db.add(ReplyTemplate(situation=t["situation"], language=t["language"], title=t["title"], body=t["body"], is_default=True))
    db.commit()
    return len(DATA["templates"])


def template_out(t: ReplyTemplate) -> dict:
    return {"id": t.id, "situation": t.situation, "situation_label": SITUATIONS.get(t.situation, t.situation), "language": t.language,
            "title": t.title, "body": t.body, "is_default": t.is_default, "updated_by": t.updated_by,
            "updated_at": t.updated_at.isoformat() if t.updated_at else None}


def suggest(db: Session, fb: Feedback) -> dict:
    topic = next((t.topic for t in fb.topics if t.is_primary), "General")
    key = reply_key(fb.content, topic, fb.intent.final_intent if fb.intent else "general_feedback",
                    fb.sentiment.final_label if fb.sentiment else "neutral")
    rows = db.scalars(select(ReplyTemplate).where(ReplyTemplate.situation == key).order_by(ReplyTemplate.language, ReplyTemplate.id)).all()
    if not rows:  # the team removed every template of this kind: fall back to the general ones
        rows = db.scalars(select(ReplyTemplate).where(ReplyTemplate.situation == "general").order_by(ReplyTemplate.language, ReplyTemplate.id)).all()
    return {"situation": key, "situation_label": SITUATIONS.get(key, key), "templates": [template_out(t) for t in rows]}
