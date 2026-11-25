"""Runs the analysis for one feedback record and stores every result table."""
from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import (EmotionResult, Feedback, IntentResult, PriorityAssessment, SentimentResult, TopicResult)
from app.nlp import rule_engine
from app.nlp.claude_engine import ClaudeUnavailable, analyze_with_claude
from app.services.settings_service import get_setting

log = logging.getLogger(__name__)


def label_for(score: int, th: dict) -> str:
    if score <= th["negative_max"]:
        return "negative"
    if score >= th["positive_min"]:
        return "positive"
    return "neutral"


def claude_key(db: Session) -> str:
    """API key from the environment only (never stored in the database)."""
    return get_settings().anthropic_api_key or os.environ.get("ANTHROPIC_API_KEY", "")


def run_analysis(db: Session, text: str, rating: float | None = None, author_ref: str | None = None,
                 platform_id: int | None = None) -> rule_engine.Analysis:
    th = get_setting(db, "sentiment_thresholds")
    conf_th = get_setting(db, "confidence_thresholds")
    provider = get_setting(db, "ai_provider")
    a: rule_engine.Analysis | None = None
    key = claude_key(db)
    if provider.get("provider") == "claude" and key:
        try:
            a = analyze_with_claude(text, key, provider.get("claude_model") or get_settings().claude_model, rating)
        except ClaudeUnavailable as e:
            log.warning("Claude unavailable, using rule engine: %s", e)
    if a is None:
        a = rule_engine.analyze(text, rating=rating, thresholds=th, review_threshold=conf_th["moderate"])
        repeated = _repeated_count(db, a.primary_topic, author_ref) if a.label == "negative" else 0
        a.priority, a.priority_reason = rule_engine.assess_priority(a, text, repeated_count=repeated)
        a.recommended_action = rule_engine.recommend(a)
    a.label = label_for(a.score, th)  # thresholds are configurable for both engines
    return a


def _repeated_count(db: Session, topic: str, author_ref: str | None) -> int:
    since = datetime.now(timezone.utc) - timedelta(days=7)
    q = (select(func.count(Feedback.id)).join(TopicResult, TopicResult.feedback_id == Feedback.id)
         .join(SentimentResult, SentimentResult.feedback_id == Feedback.id)
         .where(TopicResult.topic == topic, TopicResult.is_primary.is_(True),
                SentimentResult.final_label == "negative", Feedback.created_at >= since))
    return int(db.scalar(q) or 0) + 1


def analyze_feedback(db: Session, fb: Feedback, commit: bool = True) -> Feedback:
    a = run_analysis(db, fb.content, fb.rating, fb.author_ref, fb.platform_id)
    conf_th = get_setting(db, "confidence_thresholds")
    for rel in ("sentiment", "emotion", "intent", "priority"):
        if getattr(fb, rel) is not None:
            db.delete(getattr(fb, rel))
    for t in list(fb.topics):
        db.delete(t)
    db.flush()
    fb.sentiment = SentimentResult(label=a.label, final_label=a.label, score=a.score, confidence=a.confidence,
                                   possible_sarcasm=a.possible_sarcasm, reason=a.reason,
                                   recommended_action=a.recommended_action, engine=a.engine,
                                   model_version=a.model_version)
    fb.emotion = EmotionResult(emotion=a.emotion, final_emotion=a.emotion, scores=a.emotion_scores)
    fb.intent = IntentResult(intent=a.intent, final_intent=a.intent, reason=a.intent_reason)
    fb.topics = [TopicResult(topic=t, is_primary=(i == 0)) for i, t in enumerate(a.topics)]
    fb.priority = PriorityAssessment(level=a.priority, final_level=a.priority, reason=a.priority_reason)
    fb.language = a.language
    if fb.review_status != "reviewed":
        fb.review_status = "pending_review" if (a.confidence < conf_th["moderate"] or a.possible_sarcasm) else "unreviewed"
    if a.priority in ("critical", "high") and fb.action_status == "open":
        fb.action_status = "pending_action"
    if commit:
        db.commit()
    return fb
