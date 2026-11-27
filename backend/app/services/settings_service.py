"""Admin-configurable settings stored in the system_settings table."""
import copy
import re

from sqlalchemy.orm import Session

from app.models import SystemSetting
from app.quotes.workflow import DEFAULT_SETTINGS

DEFAULTS: dict[str, dict] = {
    # Quotation terms: PAPH service fee, minimum margin before the agent must give a reason, validity and payment schedule
    "quotes": copy.deepcopy(DEFAULT_SETTINGS),
}
EMAIL_RE = re.compile(r"[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+")
CLOCK_LIMITS = {"urgent_hours": (1, 168), "important_hours": (1, 168), "request_reply_hours": (1, 168),
                "urgent_reply_minutes": (5, 1440), "important_reply_minutes": (5, 1440)}
LIMITS = {"service_fee_pct": (0, 40), "min_margin_pct": (0, 40), "validity_days": (1, 60), "deposit_pct": (0, 100), "balance_days_before": (0, 120)}
LABELS = {"service_fee_pct": "Service fee", "min_margin_pct": "Minimum margin", "validity_days": "Offer validity (days)",
          "deposit_pct": "Deposit", "balance_days_before": "Balance due (days before departure)"}


def get_setting(db: Session, key: str) -> dict:
    row = db.get(SystemSetting, key)
    base = copy.deepcopy(DEFAULTS.get(key, {}))
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


def quote_settings(db: Session) -> dict:
    return get_setting(db, "quotes")


def validate_quote_settings(value: dict) -> dict:
    """Returns clean settings or raises ValueError with a plain message."""
    out = {}
    for k, (lo, hi) in LIMITS.items():
        v = value.get(k)
        if isinstance(v, bool) or not isinstance(v, (int, float)) or not (lo <= v <= hi):
            raise ValueError(f"{LABELS[k]} must be a number from {lo} to {hi}.")
        out[k] = int(v) if float(v).is_integer() else float(v)
    out["validity_days"] = int(out["validity_days"])
    out["balance_days_before"] = int(out["balance_days_before"])
    for k, (lo, hi) in CLOCK_LIMITS.items():
        v = value.get(k)
        if isinstance(v, bool) or not isinstance(v, (int, float)) or not (lo <= v <= hi):
            raise ValueError("Response Clock targets: hours 1 to 168, first-reply minutes 5 to 1440.")
        out[k] = int(v)
    from app.quotes.care import clean_words  # late import: care imports the quote engine

    words = value.get("watch_words", [])
    if isinstance(words, str):
        words = words.split(",")
    if not isinstance(words, list):
        raise ValueError("Send the watch words as a list.")
    out["watch_words"] = clean_words(words)
    out["weekly_enabled"] = bool(value.get("weekly_enabled", True))
    emails = [x.strip() for x in re.split(r"[,;]", str(value.get("weekly_recipients") or "")) if x.strip()]
    if len(emails) > 10 or any(not EMAIL_RE.fullmatch(x) for x in emails):
        raise ValueError("Weekly report: enter up to 10 valid email addresses, separated by commas.")
    out["weekly_recipients"] = ", ".join(emails)
    return out
