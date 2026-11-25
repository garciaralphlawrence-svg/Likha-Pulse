"""Dashboard numbers, always computed from stored feedback and analysis results."""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models import Feedback
from app.services.filters import FeedbackFilters, fetch


def _bucket(dt: datetime, granularity: str) -> str:
    if granularity == "year":
        return dt.strftime("%Y")
    if granularity == "month":
        return dt.strftime("%Y-%m")
    if granularity == "week":
        start = dt - timedelta(days=dt.weekday())
        return start.strftime("%Y-%m-%d")
    return dt.strftime("%Y-%m-%d")


def auto_granularity(start: datetime, end: datetime) -> str:
    days = (end - start).days
    return "day" if days <= 45 else "week" if days <= 200 else "month" if days <= 900 else "year"


def summarize(rows: list[Feedback], granularity: str = "day") -> dict:
    total = len(rows)
    labels = Counter(r.sentiment.final_label for r in rows if r.sentiment)
    scores = [r.sentiment.score for r in rows if r.sentiment]
    prios = Counter(r.priority.final_level for r in rows if r.priority)
    emotions = Counter(r.emotion.final_emotion for r in rows if r.emotion)
    intents = Counter(r.intent.final_intent for r in rows if r.intent)
    platforms: dict[str, Counter] = defaultdict(Counter)
    trend: dict[str, Counter] = defaultdict(Counter)
    topics, neg_topics, pos_topics = Counter(), Counter(), Counter()
    for r in rows:
        lab = r.sentiment.final_label if r.sentiment else "neutral"
        platforms[r.platform.name][lab] += 1
        b = _bucket(r.created_at, granularity)
        trend[b][lab] += 1
        trend[b]["_score"] += r.sentiment.score if r.sentiment else 0
        for t in r.topics:
            if t.topic == "General":
                continue
            topics[t.topic] += 1
            if lab == "negative":
                neg_topics[t.topic] += 1
            elif lab == "positive":
                pos_topics[t.topic] += 1
    pending = sum(1 for r in rows if r.review_status == "pending_review")
    unresolved = sum(1 for r in rows if r.action_status != "resolved" and r.priority and r.priority.final_level in ("critical", "high"))
    avg = round(sum(scores) / len(scores), 1) if scores else 0.0
    pct = lambda n: round(100 * n / total, 1) if total else 0.0
    return {
        "kpis": {
            "total": total, "positive": labels["positive"], "negative": labels["negative"], "neutral": labels["neutral"],
            "pending_review": pending, "high_priority": prios["critical"] + prios["high"], "critical": prios["critical"],
            "unresolved_high_priority": unresolved, "average_score": avg,
            "positive_pct": pct(labels["positive"]), "negative_pct": pct(labels["negative"]), "neutral_pct": pct(labels["neutral"]),
            # Overall sentiment percentage: share of opinionated feedback that is positive
            "overall_sentiment_pct": round(100 * labels["positive"] / (labels["positive"] + labels["negative"]), 1)
            if (labels["positive"] + labels["negative"]) else 0.0,
            "sample_count": sum(1 for r in rows if r.is_sample),
        },
        "distribution": [{"name": k, "value": labels[k]} for k in ("positive", "neutral", "negative")],
        "trend": [{"period": b, "positive": c["positive"], "neutral": c["neutral"], "negative": c["negative"],
                   "avg_score": round(c["_score"] / max(1, c["positive"] + c["neutral"] + c["negative"]), 1)}
                  for b, c in sorted(trend.items())],
        "by_platform": [{"platform": p, "positive": c["positive"], "neutral": c["neutral"], "negative": c["negative"],
                         "total": sum(c.values())} for p, c in sorted(platforms.items())],
        "top_topics": [{"topic": t, "count": n} for t, n in topics.most_common(8)],
        "top_complaints": [{"topic": t, "count": n} for t, n in neg_topics.most_common(6)],
        "most_appreciated": [{"topic": t, "count": n} for t, n in pos_topics.most_common(6)],
        "emotions": [{"emotion": e, "count": n} for e, n in emotions.most_common()],
        "priorities": [{"level": k, "count": prios[k]} for k in ("critical", "high", "medium", "low")],
        "intents": [{"intent": i, "count": n} for i, n in intents.most_common()],
        "granularity": granularity,
    }


def dashboard(db: Session, f: FeedbackFilters, granularity: str | None = None) -> dict:
    start, end = f.period()
    f.date_from, f.date_to = start, end
    g = granularity or auto_granularity(start, end)
    data = summarize(fetch(db, f), g)
    data["period"] = {"from": start.isoformat(), "to": end.isoformat()}
    return data
