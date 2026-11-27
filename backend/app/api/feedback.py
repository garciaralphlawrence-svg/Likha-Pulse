from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.common import feedback_out, filters_dep
from app.core.deps import audit, require
from app.db import get_db
from app.integrations.base import FetchedItem
from app.models import Feedback, HumanReview, User
from app.nlp.pipeline import analyze_feedback, run_analysis
from app.nlp.rule_engine import EMOTIONS, INTENTS, LEXICON
from app.services import cases
from app.services import filters as F
from app.services.ingestion import PLATFORM_NAMES, ingest
from app.services.watch import watch_words
from app.services.settings_service import get_setting

router = APIRouter(prefix="/api", tags=["feedback"])
LABELS, PRIOS = ["positive", "neutral", "negative"], ["critical", "high", "medium", "low"]


@router.get("/meta")
def meta(user: User = Depends(require("feedback.view"))):
    return {"sentiments": LABELS, "priorities": PRIOS, "emotions": EMOTIONS, "intents": INTENTS,
            "topics": list(LEXICON["topics"].keys()) + ["General"],
            "platforms": [{"code": c, "name": n} for c, n in PLATFORM_NAMES.items()]}


@router.get("/feedback")
def list_feedback(f: F.FeedbackFilters = Depends(filters_dep), page: int = 1, page_size: int = Query(25, ge=1, le=200),
                  user: User = Depends(require("feedback.view")), db: Session = Depends(get_db)):
    page_size = min(int(page_size), 200)
    total = db.scalar(F.apply(select(func.count(Feedback.id.distinct())).select_from(Feedback), f)) or 0
    items = F.fetch(db, f, limit=page_size, offset=(max(page, 1) - 1) * page_size)
    words = watch_words(db)
    return {"total": total, "page": page, "page_size": page_size, "items": [feedback_out(x, watch=words) for x in items]}


@router.get("/feedback/{fid}")
def get_feedback(fid: str, user: User = Depends(require("feedback.view")), db: Session = Depends(get_db)):
    fb = db.get(Feedback, fid)
    if not fb:
        raise HTTPException(404, "Feedback not found")
    return detail_out(db, fb)


def detail_out(db: Session, fb: Feedback) -> dict:
    out = feedback_out(fb, detail=True, watch=watch_words(db))
    out["client_messages"] = db.scalar(select(func.count(Feedback.id)).where(Feedback.author_ref == fb.author_ref)) if fb.author_ref != "anonymous" else 1
    return out


class ManualIn(BaseModel):
    content: str = Field(min_length=2, max_length=5000)
    author: str | None = None
    rating: float | None = Field(None, ge=1, le=5)


@router.post("/feedback", status_code=201)
def add_feedback(body: ManualIn, request: Request, user: User = Depends(require("feedback.manage")), db: Session = Depends(get_db)):
    item = FetchedItem(external_id=None, content=body.content, created_at=datetime.now(timezone.utc), author=body.author, rating=body.rating)
    fb = ingest(db, "manual", item)
    if not fb:
        raise HTTPException(409, "This feedback was already recorded (duplicate).")
    audit(db, user, "feedback_added", "feedback", fb.id, {}, request)
    return detail_out(db, fb)


class ReviewIn(BaseModel):
    sentiment: Literal["positive", "neutral", "negative"] | None = None
    emotion: str | None = None
    intent: str | None = None
    priority: Literal["critical", "high", "medium", "low"] | None = None
    confirm: bool = False
    note: str = ""
    use_for_evaluation: bool = False


@router.post("/feedback/{fid}/review")
def review(fid: str, body: ReviewIn, request: Request, user: User = Depends(require("feedback.review")), db: Session = Depends(get_db)):
    fb = db.get(Feedback, fid)
    if not fb or not fb.sentiment:
        raise HTTPException(404, "Feedback not found")
    if body.emotion and body.emotion not in EMOTIONS:
        raise HTTPException(400, "Unknown emotion")
    if body.intent and body.intent not in INTENTS:
        raise HTTPException(400, "Unknown intent")
    changes = []
    pairs = [("sentiment", fb.sentiment, "final_label", body.sentiment), ("emotion", fb.emotion, "final_emotion", body.emotion),
             ("intent", fb.intent, "final_intent", body.intent), ("priority", fb.priority, "final_level", body.priority)]
    for field, obj, attr, new in pairs:
        if new and new != getattr(obj, attr):
            db.add(HumanReview(feedback_id=fb.id, reviewer_id=user.id, field=field, original_value=getattr(obj, attr), corrected_value=new,
                               note=body.note, use_for_evaluation=body.use_for_evaluation))
            setattr(obj, attr, new)
            changes.append({"field": field, "to": new})
    if not changes:
        db.add(HumanReview(feedback_id=fb.id, reviewer_id=user.id, field="confirm", original_value=fb.sentiment.final_label,
                           corrected_value=fb.sentiment.final_label, note=body.note or "AI result confirmed", use_for_evaluation=body.use_for_evaluation))
    fb.review_status = "reviewed"
    if fb.action_status != "resolved":
        cases.open_case(db, fb, datetime.now(timezone.utc))
    db.commit()
    audit(db, user, "feedback_reviewed", "feedback", fb.id, {"changes": changes, "note": body.note}, request)
    db.refresh(fb)
    return detail_out(db, fb)


class StatusIn(BaseModel):
    action_status: Literal["open", "pending_action", "resolved"]


@router.patch("/feedback/{fid}/status")
def set_status(fid: str, body: StatusIn, request: Request, user: User = Depends(require("feedback.manage")), db: Session = Depends(get_db)):
    fb = db.get(Feedback, fid)
    if not fb:
        raise HTTPException(404, "Feedback not found")
    fb.action_status = body.action_status
    fb.resolved_at = datetime.now(timezone.utc) if body.action_status == "resolved" else None
    if body.action_status == "resolved":
        fb.handled_by_id = fb.handled_by_id or user.id
    if fb.case and body.action_status == "resolved":
        cases.solve(fb.case, user.full_name)
    elif fb.case and fb.case.resolved_at:
        cases.reopen(fb.case, user.full_name)
    db.commit()
    audit(db, user, "feedback_status", "feedback", fb.id, {"status": body.action_status}, request)
    return detail_out(db, fb)


@router.post("/feedback/{fid}/reanalyze")
def reanalyze(fid: str, request: Request, user: User = Depends(require("feedback.manage")), db: Session = Depends(get_db)):
    fb = db.get(Feedback, fid)
    if not fb:
        raise HTTPException(404, "Feedback not found")
    analyze_feedback(db, fb)
    audit(db, user, "feedback_reanalyzed", "feedback", fb.id, {}, request)
    db.refresh(fb)
    return detail_out(db, fb)


class AnalyzeIn(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    rating: float | None = Field(None, ge=1, le=5)


@router.post("/analyze")
def analyze_text(body: AnalyzeIn, user: User = Depends(require("feedback.view")), db: Session = Depends(get_db)):
    """Try the engine on any text without saving it."""
    a = run_analysis(db, body.text, body.rating)
    conf_th = get_setting(db, "confidence_thresholds")
    return {"sentiment": a.label, "score": a.score, "confidence": a.confidence,
            "confidence_band": "high" if a.confidence >= conf_th["high"] else "moderate" if a.confidence >= conf_th["moderate"] else "low (manual review)",
            "emotion": a.emotion, "intent": a.intent, "intent_reason": a.intent_reason, "topics": a.topics,
            "possible_sarcasm": a.possible_sarcasm, "reason": a.reason, "priority": a.priority, "priority_reason": a.priority_reason,
            "recommended_action": a.recommended_action, "language": a.language, "engine": a.engine, "model_version": a.model_version}
