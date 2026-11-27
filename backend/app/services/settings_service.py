"""Admin-configurable settings stored in the system_settings table."""
from sqlalchemy.orm import Session

from app.models import SystemSetting
from app.quotes.workflow import DEFAULT_SETTINGS

DEFAULTS: dict[str, dict] = {
    # Quotation terms: PAPH service fee, minimum margin before the agent must give a reason, validity and payment schedule
    "quotes": dict(DEFAULT_SETTINGS),
}
LIMITS = {"service_fee_pct": (0, 40), "min_margin_pct": (0, 40), "validity_days": (1, 60), "deposit_pct": (0, 100), "balance_days_before": (0, 120)}
LABELS = {"service_fee_pct": "Service fee", "min_margin_pct": "Minimum margin", "validity_days": "Offer validity (days)",
          "deposit_pct": "Deposit", "balance_days_before": "Balance due (days before departure)"}


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
    return out
