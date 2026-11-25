from datetime import datetime, timezone

from fastapi import Query

from app.models import Feedback
from app.services.filters import FeedbackFilters


def _dt(v: str | None, end: bool = False) -> datetime | None:
    if not v:
        return None
    d = datetime.fromisoformat(v)
    if len(v) == 10 and end:
        d = d.replace(hour=23, minute=59, second=59)
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def filters_dep(
    date_from: str | None = Query(None, description="YYYY-MM-DD or ISO datetime"),
    date_to: str | None = Query(None),
    platform: str | None = None, sentiment: str | None = None, priority: str | None = None,
    emotion: str | None = None, intent: str | None = None, topic: str | None = None,
    review: str | None = None, action: str | None = None, search: str | None = None,
    include_sample: bool = True,
) -> FeedbackFilters:
    return FeedbackFilters(date_from=_dt(date_from), date_to=_dt(date_to, end=True), platform=platform, sentiment=sentiment,
                           priority=priority, emotion=emotion, intent=intent, topic=topic, review=review, action=action,
                           search=search, include_sample=include_sample)


def feedback_out(fb: Feedback, detail: bool = False) -> dict:
    s, e, i, p = fb.sentiment, fb.emotion, fb.intent, fb.priority
    out = {
        "id": fb.id, "platform": fb.platform.code, "platform_name": fb.platform.name, "author": fb.author_ref,
        "content": fb.content, "rating": fb.rating, "language": fb.language, "created_at": fb.created_at.isoformat(),
        "is_sample": fb.is_sample, "review_status": fb.review_status, "action_status": fb.action_status,
        "sentiment": s.final_label if s else None, "ai_sentiment": s.label if s else None, "score": s.score if s else None,
        "confidence": s.confidence if s else None, "possible_sarcasm": s.possible_sarcasm if s else False,
        "emotion": e.final_emotion if e else None, "intent": i.final_intent if i else None,
        "topics": [t.topic for t in fb.topics], "topic": next((t.topic for t in fb.topics if t.is_primary), "General"),
        "priority": p.final_level if p else None, "engine": s.engine if s else None,
    }
    if detail:
        out.update({
            "reason": s.reason if s else "", "recommended_action": s.recommended_action if s else "",
            "intent_reason": i.reason if i else "", "priority_reason": p.reason if p else "",
            "ai": {"sentiment": s.label, "emotion": e.emotion, "intent": i.intent, "priority": p.level} if s else {},
            "emotion_scores": e.scores if e else {}, "model_version": s.model_version if s else "",
            "analyzed_at": s.analyzed_at.isoformat() if s else None, "source_url": fb.source_url,
            "external_id": fb.external_id, "parent_reference": fb.parent_reference,
            "collected_at": fb.collected_at.isoformat(),
            "reviews": [{"field": r.field, "original": r.original_value, "corrected": r.corrected_value, "note": r.note,
                         "reviewer": r.reviewer.full_name if r.reviewer else "", "at": r.created_at.isoformat()} for r in fb.reviews],
        })
    return out
