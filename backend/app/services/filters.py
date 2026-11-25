"""Shared query filters used by dashboard, feedback list, insights and reports."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.models import EmotionResult, Feedback, IntentResult, Platform, PriorityAssessment, SentimentResult, TopicResult


@dataclass
class FeedbackFilters:
    date_from: datetime | None = None
    date_to: datetime | None = None
    platform: str | None = None  # platform code
    sentiment: str | None = None
    priority: str | None = None
    emotion: str | None = None
    intent: str | None = None
    topic: str | None = None
    review: str | None = None  # reviewed | unreviewed | pending_review
    action: str | None = None  # open | pending_action | resolved
    search: str | None = None
    include_sample: bool = True

    def period(self) -> tuple[datetime, datetime]:
        end = self.date_to or datetime.now(timezone.utc)
        start = self.date_from or (end - timedelta(days=30))
        return start, end


def apply(q: Select, f: FeedbackFilters) -> Select:
    q = q.join(SentimentResult, SentimentResult.feedback_id == Feedback.id)
    q = q.join(PriorityAssessment, PriorityAssessment.feedback_id == Feedback.id)
    q = q.join(EmotionResult, EmotionResult.feedback_id == Feedback.id)
    q = q.join(IntentResult, IntentResult.feedback_id == Feedback.id)
    q = q.join(Platform, Platform.id == Feedback.platform_id)
    if f.date_from:
        q = q.where(Feedback.created_at >= f.date_from)
    if f.date_to:
        q = q.where(Feedback.created_at <= f.date_to)
    if f.platform:
        q = q.where(Platform.code == f.platform)
    if f.sentiment:
        q = q.where(SentimentResult.final_label == f.sentiment)
    if f.priority:
        q = q.where(PriorityAssessment.final_level.in_(f.priority.split(",")))
    if f.emotion:
        q = q.where(EmotionResult.final_emotion == f.emotion)
    if f.intent:
        q = q.where(IntentResult.final_intent.in_(f.intent.split(",")))
    if f.topic:
        q = q.where(Feedback.id.in_(select(TopicResult.feedback_id).where(TopicResult.topic == f.topic)))
    if f.review:
        q = q.where(Feedback.review_status == f.review)
    if f.action == "unresolved":
        q = q.where(Feedback.action_status != "resolved")
    elif f.action:
        q = q.where(Feedback.action_status == f.action)
    if f.search:
        q = q.where(Feedback.content.ilike(f"%{f.search}%"))
    if not f.include_sample:
        q = q.where(Feedback.is_sample.is_(False))
    return q


def fetch(db: Session, f: FeedbackFilters, limit: int | None = None, offset: int = 0) -> list[Feedback]:
    q = apply(select(Feedback), f).order_by(Feedback.created_at.desc())
    if limit:
        q = q.limit(limit).offset(offset)
    return list(db.scalars(q).unique())
