"""Request -> AI recommendation -> sales offer -> agent decision -> quotation.

Port twin of frontend/src/quote/workflow.ts. Requests are plain dicts with the same JSON shape as the TS TravelRequest.
Times are ISO strings in the JavaScript toISOString() format ("2026-11-27T02:00:00.000Z"), so string comparison works.
"""
from __future__ import annotations

import copy
import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.quotes.engine import RULES, dest_by_code, fmt_day, js_num, peso, r100, recommend

WF: dict = json.loads((Path(__file__).with_name("workflow.json")).read_text(encoding="utf-8"))
STATUSES: dict = WF["statuses"]
ACTIONS: dict = WF["actions"]
LOST_REASONS: dict = WF["lost_reasons"]
ROLE_LABELS: dict = WF["roles"]
DEFAULT_SETTINGS = {
    "service_fee_pct": RULES["service_fee_pct"], "min_margin_pct": RULES["min_margin_pct"], "validity_days": RULES["validity_days"],
    "deposit_pct": RULES["deposit_pct"], "balance_days_before": RULES["balance_days_before"],
}


class FlowError(Exception):
    """A step that is not allowed. The message is plain and safe to show."""


def fail(msg: str):
    raise FlowError(msg)


# ---------- time helpers (JS toISOString format) ----------
def iso(dt: datetime) -> str:
    dt = dt.astimezone(timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


def parse_iso(s: str) -> datetime:
    s = s.replace("Z", "+00:00")
    dt = datetime.fromisoformat(s)
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def now_iso() -> str:
    return iso(datetime.now(timezone.utc))


def add_days(s: str, days: float) -> str:
    return iso(parse_iso(s) + timedelta(days=days))


def round1(x: float) -> float:
    return math.floor(x * 10 + 0.5) / 10


def js_round(x: float) -> int:
    return int(math.floor(x + 0.5))


def rules_from(s: dict) -> dict:
    return {**RULES, **{k: s[k] for k in DEFAULT_SETTINGS}}


def ref_for(year: int, seq: int) -> str:
    return f"PAPH-{year}-{seq:04d}"


def create_request(*, id: str, seq: int, now: str, customer: dict, raw_text: str, input: dict, addons: list[str], is_sample: bool = False,
                   settings: dict = DEFAULT_SETTINGS) -> dict:
    """A customer sends a request: the AI recommendation is made right away."""
    name, contact = str(customer.get("name", "")).strip(), str(customer.get("contact", "")).strip()
    if len(name) < 2:
        fail("Please enter your name.")
    if len(contact) < 5:
        fail("Please enter a mobile number or email so we can send your offer.")
    rec = recommend(input, rules_from(settings))
    known = {a["code"] for a in rec["addons"]}
    req = {
        "id": id, "ref": ref_for(int(now[:4]), seq), "created_at": now, "updated_at": now, "status": "ai_recommended", "is_sample": bool(is_sample),
        "customer": {"name": name[:120], "contact": contact[:160]}, "raw_text": (raw_text or "")[:2000], "input": rec["input"],
        "addons": [a for a in addons if a in known], "recommendation": rec, "assignee": None, "offer": None, "submitted_by": None, "approval": None,
        "customer_question": None, "lost_reason": None, "events": [],
    }
    req["events"].append({"at": now, "by": req["customer"]["name"], "role": "CUSTOMER", "action": "submitted", "from": None, "to": "new", "note": "Request received."})
    req["events"].append({"at": now, "by": "PAPH AI", "role": "SYSTEM", "action": "ai_recommended", "from": "new", "to": "ai_recommended", "note": rec["verdict"]})
    return req


def offer_from_option(req: dict, option, settings: dict, by: str, now: str) -> dict:
    """Offer lines from one AI option: each cost is the middle of the AI range; the service fee is the margin."""
    rec = req["recommendation"]
    o = next((x for x in rec["options"] if x["code"] == option), None)
    lines, n = [], 1
    if o:
        for line in o["lines"]:
            if line["kind"] == "fee":
                continue
            mid = r100((line["low"] + line["high"]) / 2)
            lines.append({"id": f"l{n}", "kind": line["kind"], "label": line["label"], "detail": line["detail"], "cost": mid, "price": mid})
            n += 1
    for code in req["addons"]:
        a = next((x for x in rec["addons"] if x["code"] == code), None)
        if a:
            lines.append({"id": f"l{n}", "kind": "addon", "label": a["label"], "detail": f"{a['detail']} ({a['unit']})", "cost": a["cost"], "price": a["price"]})
            n += 1
    if lines:
        base = sum(x["cost"] for x in lines if x["kind"] != "addon")
        lines.append({"id": f"l{n}", "kind": "fee", "label": "PAPH service fee",
                      "detail": f"Planning, booking and 24/7 trip support ({js_num(settings['service_fee_pct'])}%)", "cost": 0,
                      "price": r100(max(RULES["service_fee_min"], base * settings["service_fee_pct"] / 100))})
    offer = {"option": o["code"] if o else None, "lines": lines, "discount": 0, "notes": "", "version": 1, "updated_by": by, "updated_at": now, "totals": None}
    offer["totals"] = totals(req, offer, settings)
    return offer


def totals(req: dict, offer: dict, settings: dict) -> dict:
    cost = sum(x["cost"] for x in offer["lines"])
    price = sum(x["price"] for x in offer["lines"]) - offer["discount"]
    margin = price - cost
    margin_pct = round1(margin / price * 100) if price > 0 else 0
    o = next((x for x in req["recommendation"]["options"] if x["code"] == offer.get("option")), None)
    addons = sum(x["price"] for x in offer["lines"] if x["kind"] == "addon")
    ai_low = o["total_low"] + addons if o else 0
    ai_high = o["total_high"] + addons if o else 0
    ai_check = "none" if not o else "below" if price < ai_low else "above" if price > ai_high else "inside"
    pax = req["input"]["adults"] + req["input"]["kids"]
    return {
        "cost": cost, "price": price, "discount": offer["discount"], "margin": margin, "margin_pct": margin_pct, "below_cost": price < cost,
        "low_margin": price >= cost and margin_pct < settings["min_margin_pct"], "ai_low": ai_low, "ai_high": ai_high, "ai_check": ai_check,
        "ai_gap": ai_low - price if ai_check == "below" else price - ai_high if ai_check == "above" else 0, "per_person": r100(price / max(1, pax)),
    }


def is_expired(req: dict, now: str) -> bool:
    return req["status"] in ("approved", "sent") and bool(req.get("approval")) and now > req["approval"]["valid_until"]


def hours_waiting(req: dict, now: str) -> float:
    if req["status"] not in ("new", "ai_recommended", "changes_requested") and not req.get("customer_question"):
        return 0
    since = None
    if req.get("customer_question"):
        since = req["customer_question"]["at"]
    if not since:
        since = next((e["at"] for e in reversed(req["events"]) if e["to"] == req["status"]), None) or req["created_at"]
    return max(0.0, (parse_iso(now) - parse_iso(since)).total_seconds() / 3600)


def allowed(req: dict, role: str) -> list[str]:
    """What this person may do on this request right now (used to show buttons)."""
    return [a for a, spec in ACTIONS.items() if role in spec["roles"] and req["status"] in spec["from"]]


def _num(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def apply(prev: dict, action: str, actor: dict, payload: dict, now: str, settings: dict = DEFAULT_SETTINGS) -> dict:
    """Applies one step. Raises FlowError with a plain message when the step is not allowed. Returns a new request dict."""
    spec = ACTIONS.get(action) or fail("Unknown action.")
    payload = payload or {}
    if actor["role"] not in spec["roles"]:
        fail(f"Your role can't {spec['label'].lower()}.")
    if prev["status"] not in spec["from"]:
        fail(f"You can't {spec['label'].lower()} while the request is \"{STATUSES[prev['status']]['staff']}\".")
    note = str(payload.get("note") or "").strip()[:1000]
    if spec.get("note") and not note:
        fail("Please write a short note.")
    req = copy.deepcopy(prev)
    to = spec["to"] or req["status"]
    event_note = note
    rec = req["recommendation"]

    if action == "start_offer":
        opt = payload["option"] if "option" in payload else rec["recommended"]
        if opt and not any(o["code"] == opt for o in rec["options"]):
            fail("Pick one of the AI options.")
        req["offer"] = offer_from_option(req, opt, settings, actor["name"], now)
        if not req["assignee"]:
            req["assignee"] = {"id": actor["id"], "name": actor["name"]}
        label = next((o["label"] for o in rec["options"] if o["code"] == opt), None)
        event_note = f'Started from the "{label}" option.' if opt else "Started a blank offer."
    elif action == "save_offer":
        if not req["offer"]:
            fail("Start the offer first.")
        raw_lines = payload["lines"] if payload.get("lines") is not None else req["offer"]["lines"]
        lines = []
        for i, line in enumerate(raw_lines):
            label = str(line.get("label") or "").strip()
            if not label:
                fail(f"Line {i + 1} needs a name.")
            if not _num(line.get("cost")) or not _num(line.get("price")):
                fail(f"Line {i + 1}: cost and price must be numbers.")
            lines.append({"id": line.get("id") or f"l{i + 1}", "kind": line.get("kind") or "other", "label": label[:120],
                          "detail": str(line.get("detail") or "")[:300], "cost": js_round(line["cost"]), "price": js_round(line["price"])})
        d = payload.get("discount")
        d = d if d is not None else req["offer"]["discount"]
        if not _num(d):
            fail("The discount must be a number.")
        discount = js_round(d)
        if discount < 0:
            fail("The discount can't be negative.")
        option = payload["option"] if "option" in payload else req["offer"]["option"]
        notes = payload.get("notes")
        notes = (notes if notes is not None else req["offer"]["notes"])[:1000]
        req["offer"] = {"option": option, "lines": lines, "discount": discount, "notes": notes, "version": req["offer"]["version"] + 1,
                        "updated_by": actor["name"], "updated_at": now, "totals": None}
        req["offer"]["totals"] = totals(req, req["offer"], settings)
        if prev["status"] in ("approved", "sent"):
            _guard_submit(req)  # any change after approval must be approved again
            to = "pending_approval"
            req["approval"] = None
            req["submitted_by"] = {"id": actor["id"], "name": actor["name"]}
            event_note = f"Offer changed after approval (now {peso(req['offer']['totals']['price'])}), so it goes back for approval.{' ' + note if note else ''}"
        else:
            event_note = f"Offer saved: {peso(req['offer']['totals']['price'])}.{' ' + note if note else ''}"
    elif action == "submit":
        _guard_submit(req)
        req["submitted_by"] = {"id": actor["id"], "name": actor["name"]}
        t = req["offer"]["totals"]
        event_note = f"Sent for approval at {peso(t['price'])} (margin {js_num(t['margin_pct'])}%).{' ' + note if note else ''}"
    elif action == "approve":
        t = req["offer"]["totals"]
        if (req.get("submitted_by") or {}).get("id") == actor["id"]:
            fail("You prepared this offer, so someone else must approve it.")
        if t["below_cost"]:
            fail(f"This offer is {peso(t['cost'] - t['price'])} below cost. Ask for changes instead.")
        if t["low_margin"] and not note:
            fail(f"The margin is only {js_num(t['margin_pct'])}% (the minimum is {js_num(settings['min_margin_pct'])}%). Write the reason for approving it.")
        req["approval"] = {"by": actor["name"], "by_id": actor["id"], "at": now, "note": note, "version": req["offer"]["version"],
                           "valid_until": add_days(now, settings["validity_days"])}
        event_note = f"Approved at {peso(t['price'])}. Valid until {fmt_day(req['approval']['valid_until'][:10])}.{' ' + note if note else ''}"
    elif action == "send":
        if is_expired(req, now):
            fail("This offer has expired. Recheck the rates and edit the offer so it can be approved again.")
        event_note = note or "Quotation sent to the customer."
    elif action == "customer_accept":
        if is_expired(req, now):
            fail("This offer has expired. Please ask us to recheck the rates.")
        if not req["approval"] or req["approval"]["version"] != (req["offer"] or {}).get("version"):
            fail("This offer is being updated. Please check again later.")
        event_note = note or "Customer accepted the offer."
    elif action == "customer_changes":
        req["customer_question"] = None
    elif action == "customer_question":
        req["customer_question"] = {"text": note, "at": now}
    elif action == "answer":
        if not req["customer_question"]:
            fail("There is no open question from the customer.")
        req["customer_question"] = None
    elif action == "assign":
        a = payload.get("assignee") or fail("Choose a salesperson.")
        if actor["role"] == "SALES" and a.get("id") != actor["id"]:
            fail("Salespeople can only take a request for themselves.")
        req["assignee"] = {"id": a["id"], "name": a["name"]}
        event_note = f"Assigned to {a['name']}."
    elif action == "mark_lost":
        r = payload.get("reason") or ""
        if r not in LOST_REASONS:
            fail("Choose why the request was lost.")
        req["lost_reason"] = r
        event_note = LOST_REASONS[r] + (f". {note}" if note else "")

    req["status"] = to
    req["updated_at"] = now
    req["events"].append({"at": now, "by": actor["name"], "role": actor["role"], "action": action, "from": prev["status"], "to": to, "note": event_note})
    return req


def _guard_submit(req: dict) -> None:
    o = req["offer"] or fail("Start the offer first.")
    if not o["lines"] or o["totals"]["price"] <= 0:
        fail("Add at least one priced line before sending for approval.")
    if o["totals"]["below_cost"]:
        fail(f"The offer is {peso(o['totals']['cost'] - o['totals']['price'])} below cost. Raise the price or lower the discount first.")


# ---------- the printed quotation ----------
def quotation_terms(req: dict, settings: dict, now: str) -> dict:
    o, a = req["offer"], req["approval"]
    deposit = r100(o["totals"]["price"] * settings["deposit_pct"] / 100)
    d = dest_by_code(req["input"]["destination"])
    balance_due = f"{js_num(settings['balance_days_before'])} days before departure"
    if req["input"].get("travel_date"):
        due = (datetime.fromisoformat(req["input"]["travel_date"]) - timedelta(days=settings["balance_days_before"])).date().isoformat()
        balance_due = f"on or before {fmt_day(now[:10] if due < now[:10] else due)}"
    kinds = {x["kind"] for x in o["lines"]}
    exclusions = ["Meals not stated in the itinerary", "Personal expenses, tips and shopping", "Excess baggage and seat selection", "Anything not listed under inclusions"]
    if "visa" not in kinds and d and d["visa"]["needed"]:
        exclusions.insert(0, "Visa fees (visa assistance can be added)")
    if "insurance" not in kinds and not any("insurance" in x["label"].lower() for x in o["lines"]):
        exclusions.insert(0, "Travel insurance (recommended)")
    dp = js_num(settings["deposit_pct"])
    return {
        "ref": req["ref"], "issued": a["at"], "valid_until": a["valid_until"], "expired": is_expired(req, now), "deposit": deposit,
        "balance": o["totals"]["price"] - deposit, "balance_due": balance_due,
        "inclusions": [f"{x['label']}: {x['detail']}" for x in o["lines"] if x["kind"] != "fee" and x["price"] >= 0],
        "exclusions": exclusions,
        "cancellation": [
            f"A {dp}% deposit confirms the booking. Flights and hotels are booked only after the deposit.",
            "Deposits become non-refundable once tickets and hotels are issued; changes follow airline and hotel rules.",
            "If a visa is refused, refunds follow airline and hotel rules minus fees already paid.",
            "Sample terms: PAPH Travel and Tours will replace these with its official policy.",
        ],
        "checklist": d["visa"]["docs"] if d else [],
        "visa_note": f"{d['visa']['label']}. {d['visa']['note']} Always check the latest requirements before you apply." if d else "",
    }
