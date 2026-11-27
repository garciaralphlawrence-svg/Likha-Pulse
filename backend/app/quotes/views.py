"""Read-only views over requests: queue rows, the customer's tracking view and the dashboard.

Port twin of frontend/src/quote/views.ts.
"""
from __future__ import annotations

import math
import re

from app.quotes.engine import dest_by_code
from app.quotes.workflow import ACTIONS, LOST_REASONS, STATUSES, allowed, hours_waiting, is_expired, quotation_terms

QUEUE = ["new", "ai_recommended", "offer_drafted", "changes_requested"]
QUOTED = ["approved", "sent", "accepted", "booked"]
VIEWS = ("queue", "approval", "open", "closed", "all")


def summary(r: dict, now: str) -> dict:
    rec = r["recommendation"]
    code = (r.get("offer") or {}).get("option") or rec.get("recommended")
    if r.get("offer"):
        code = r["offer"]["option"] if r["offer"]["option"] is not None else rec.get("recommended")
    opt = next((o for o in rec["options"] if o["code"] == code), None)
    t = (r.get("offer") or {}).get("totals")
    return {
        "id": r["id"], "ref": r["ref"], "created_at": r["created_at"], "updated_at": r["updated_at"], "status": r["status"], "is_sample": r["is_sample"],
        "customer_name": r["customer"]["name"],
        "destination_name": (rec.get("destination") or {}).get("name") or r["input"].get("place_text") or "Not sure yet",
        "days": r["input"]["days"], "pax": r["input"]["adults"] + r["input"]["kids"], "tier_label": opt["tier_label"] if opt else "",
        "verdict": rec["verdict"], "assignee": (r.get("assignee") or {}).get("name"),
        "ai_low": opt["total_low"] if opt else None, "ai_high": opt["total_high"] if opt else None,
        "offer_price": t["price"] if t else None, "margin_pct": t["margin_pct"] if t else None,
        "flags": {
            "waiting_hours": math.floor(hours_waiting(r, now)), "expired": is_expired(r, now), "question": bool(r.get("customer_question")),
            "below_cost": bool(t and t["below_cost"]), "low_margin": bool(t and t["low_margin"]),
            "budget_too_low": (rec.get("budget") or {}).get("status") == "over",
        },
    }


def list_view(all_reqs: list[dict], view: str, now: str) -> list[dict]:
    def keep(r):
        if view == "queue":
            return r["status"] in QUEUE or (bool(r.get("customer_question")) and STATUSES[r["status"]]["open"])
        if view == "approval":
            return r["status"] == "pending_approval"
        if view == "open":
            return STATUSES[r["status"]]["open"]
        if view == "closed":
            return not STATUSES[r["status"]]["open"]
        return True

    rows = [summary(r, now) for r in all_reqs if keep(r)]
    if view in ("queue", "approval"):
        return sorted(rows, key=lambda x: (-x["flags"]["waiting_hours"], x["created_at"]))
    return sorted(rows, key=lambda x: x["updated_at"], reverse=True)


def detail(r: dict, role: str, settings: dict, now: str) -> dict:
    show = r["status"] in QUOTED and bool(r.get("approval")) and bool(r.get("offer"))
    return {**r, "allowed": allowed(r, role), "expired": is_expired(r, now), "waiting_hours": math.floor(hours_waiting(r, now)),
            "terms": quotation_terms(r, settings, now) if show else None}


PUBLIC_EVENTS = {
    "submitted": "Request received", "ai_recommended": "AI estimate ready", "start_offer": "A travel consultant is preparing your offer",
    "approve": "Your offer is ready", "send": "Quotation sent to you", "customer_accept": "You accepted the offer", "customer_changes": "You asked for changes",
    "customer_question": "You asked a question", "answer": "We answered your question", "mark_booked": "Booked. See you on your trip!",
    "mark_lost": "Request closed", "decline": "Request closed",
}


def contact_matches(saved: str, given: str) -> bool:
    """Same email, or the same last 7 digits of a mobile number."""
    a, b = (saved or "").strip().lower(), (given or "").strip().lower()
    if not a or not b:
        return False
    if "@" in a or "@" in b:
        return a == b
    da, db = re.sub(r"\D", "", a), re.sub(r"\D", "", b)
    return len(da) >= 7 and len(db) >= 7 and da[-7:] == db[-7:]


def public_view(r: dict, settings: dict, now: str) -> dict:
    st = STATUSES[r["status"]]
    quoted = r["status"] in QUOTED and bool(r.get("offer")) and bool(r.get("approval"))
    expired = is_expired(r, now)
    can = [a for a in allowed(r, "CUSTOMER") if not (expired and a in ("customer_accept", "customer_changes"))]
    o = r.get("offer")
    return {
        "ref": r["ref"], "created_at": r["created_at"], "status": r["status"],
        "customer_status": "Offer expired: rates must be rechecked" if expired else st["customer"], "step": st["step"],
        "customer_name": r["customer"]["name"], "input": r["input"], "recommendation": r["recommendation"], "addons": r["addons"],
        "expired": expired, "question": r.get("customer_question"),
        "offer": {"option": o["option"], "lines": [{"label": x["label"], "detail": x["detail"], "price": x["price"]} for x in o["lines"]],
                  "discount": o["discount"], "total": o["totals"]["price"], "per_person": o["totals"]["per_person"], "notes": o["notes"]} if quoted else None,
        "terms": quotation_terms(r, settings, now) if quoted else None,
        "timeline": [{"at": e["at"], "label": PUBLIC_EVENTS[e["action"]] + (f": {e['note']}" if e["action"] in ("answer", "customer_question") else "")}
                     for e in r["events"] if e["action"] in PUBLIC_EVENTS],
        "can": [a for a in can if "CUSTOMER" in ACTIONS[a]["roles"]],
    }


def dashboard(all_reqs: list[dict], now: str) -> dict:
    def count(s):
        return sum(1 for r in all_reqs if r["status"] == s)

    booked, lost, declined = count("booked"), count("lost"), count("declined")
    offered = sum(1 for r in all_reqs if any(e["action"] == "approve" for e in r["events"]))
    quotes = [r["offer"]["totals"]["price"] for r in all_reqs if r.get("approval") and r.get("offer")]
    dest: dict[str, dict] = {}
    for r in all_reqs:
        d = dest_by_code(r["input"].get("destination"))
        k = d["code"] if d else "other"
        dest.setdefault(k, {"code": k, "name": d["name"] if d else "Other places", "count": 0})["count"] += 1
    reasons: dict[str, int] = {}
    for r in all_reqs:
        if r["status"] == "lost" and r.get("lost_reason"):
            reasons[r["lost_reason"]] = reasons.get(r["lost_reason"], 0) + 1
    return {
        "total": len(all_reqs), "open": sum(1 for r in all_reqs if STATUSES[r["status"]]["open"]), "booked": booked, "lost": lost, "declined": declined,
        "conversion_pct": math.floor(booked / offered * 1000 + 0.5) / 10 if offered else None,
        "avg_quote": int(math.floor(sum(quotes) / len(quotes) / 100 + 0.5)) * 100 if quotes else None,
        "pipeline_value": sum(r["offer"]["totals"]["price"] for r in all_reqs if r["status"] in ("approved", "sent", "accepted") and r.get("offer")),
        "by_status": [{"status": s, "label": STATUSES[s]["staff"], "count": count(s)} for s in STATUSES if s != "new"],
        "top_destinations": sorted(dest.values(), key=lambda x: (-x["count"], x["name"]))[:6],
        "lost_reasons": sorted([{"reason": k, "label": LOST_REASONS[k], "count": c} for k, c in reasons.items()], key=lambda x: -x["count"]),
        "awaiting_decision": list_view(all_reqs, "approval", now),
        "waiting_long": sum(1 for r in all_reqs if hours_waiting(r, now) >= 24),
        "sample_count": sum(1 for r in all_reqs if r["is_sample"]),
    }
