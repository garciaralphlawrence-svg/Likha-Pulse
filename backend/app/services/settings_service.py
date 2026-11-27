"""Admin-configurable settings stored in the system_settings table."""
from sqlalchemy.orm import Session

from app.models import SystemSetting

DEFAULTS: dict[str, dict] = {
    "sentiment_thresholds": {"negative_max": -25, "positive_min": 25},
    "confidence_thresholds": {"high": 0.90, "moderate": 0.70},  # below moderate -> manual review
    "ai_provider": {"provider": "rule", "claude_model": "claude-opus-5-5", "api_key_set": False},
    "alerts": {"negative_spike_pct": 30, "repeated_complaint_count": 3, "unresolved_days": 3, "email_enabled": False},
    "retention": {"feedback_days": 730, "audit_days": 1095},
    "response_clock": {"urgent_hours": 24, "important_hours": 48, "urgent_reply_minutes": 60, "important_reply_minutes": 240},
    # Keyword watch: messages containing these words are flagged and raise an alert
    "keyword_watch": {"words": ["refund", "scam", "cancel", "estafa", "Boracay"]},
    # Weekly report: emailed every Monday morning (8 AM Philippine time). Empty recipients = every Owner account.
    "weekly_report": {"enabled": True, "recipients": "", "last_sent_week": ""},
}


def get_setting(db: Session, key: str) -> dict:
    row = db.get(SystemSetting, key)
    base = dict(DEFAULTS.get(key, {}))
    if row:
        base.update(row.value or {})
    return base


def set_setting(db: Session, key: str, value: dict) -> dict:
    row = db.get(SystemSetting, key)
    merged = {**get_setting(db, key), **value}
    if row:
        row.value = merged
    else:
        db.add(SystemSetting(key=key, value=merged))
    db.commit()
    return merged


def all_settings(db: Session) -> dict:
    return {k: get_setting(db, k) for k in DEFAULTS}
