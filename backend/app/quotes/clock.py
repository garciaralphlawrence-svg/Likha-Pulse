"""Response Clock. Every customer issue becomes a "case" with a deadline; quotation requests and unanswered messages also
run on the same clock. The colour changes as time runs out (for a 24-hour target, every 6 hours): 0-25% of the time used =
green, 25-50% yellow, 50-75% orange, 75-100% red (escalated to the owner), past the deadline = overdue.

Port twin of frontend/src/quote/clock.ts. Playbooks: playbooks.json.
"""
from __future__ import annotations

import copy
import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.quotes.workflow import parse_iso
from app.sentiment.rule_engine import analyze

PB: dict = json.loads((Path(__file__).with_name("playbooks.json")).read_text(encoding="utf-8"))
SITUATIONS: dict = PB["situations"]
STAGES = {
    "green": {"label": "On track", "hint": "Plenty of time left"}, "yellow": {"label": "Needs progress", "hint": "A quarter of the time is gone"},
    "orange": {"label": "At risk", "hint": "Half of the time is gone"}, "red": {"label": "Due soon", "hint": "Less than a quarter of the time left"},
    "overdue": {"label": "Overdue", "hint": "The deadline has passed"}, "solved": {"label": "Solved", "hint": "Case closed"},
}
OPEN_STAGES = ["overdue", "red", "orange", "yellow", "green"]
HOUR = 3600000
EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)
STAFF = ("SALES", "AGENT", "ADMIN")
URGENT_SITUATIONS = ("emergency", "documents", "transfer", "hotel", "refund")
SOURCE_WORD = {"message": "a customer message", "request": "a message on a quotation", "feedback": "a low after-trip rating", "manual": "staff"}


# ---------- time, exactly like JavaScript Date ----------
def ms(iso: str) -> int:
    d = parse_iso(iso) - EPOCH
    return (d.days * 86400 + d.seconds) * 1000 + d.microseconds // 1000


def iso_ms(t: float) -> str:
    """new Date(t).toISOString(): fractional milliseconds are cut off toward zero."""
    dt = EPOCH + timedelta(milliseconds=math.trunc(t))
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


def add_ms(iso: str, delta: float) -> str:
    return iso_ms(ms(iso) + delta)


def js_round(x: float) -> int:
    return int(math.floor(x + 0.5))


def stage_at(opened: str, due: str, resolved, now: str) -> str:
    """Colour for a clock that started at `opened` and must be done by `due`."""
    if resolved:
        return "solved"
    a, b = ms(opened), ms(due)
    f = (ms(now) - a) / max(1, b - a)
    return "overdue" if f >= 1 else "red" if f >= 0.75 else "orange" if f >= 0.5 else "yellow" if f >= 0.25 else "green"


def used_share(opened: str, due: str, now: str) -> float:
    return min(1, max(0, (ms(now) - ms(opened)) / max(1, ms(due) - ms(opened))))


def dur(t_ms: float) -> str:
    """Time in plain words: "45m", "3h 10m", "2d 4h"."""
    m = max(0, js_round(t_ms / 60000))
    if m < 60:
        return f"{m}m"
    h, r = m // 60, m % 60
    if h < 48:
        return f"{h}h {r}m" if r else f"{h}h"
    d, hh = h // 24, h % 24
    return f"{d}d {hh}h" if hh else f"{d}d"


def request_clock(r: dict, now: str, s: dict):
    """The quotation clock: how long the customer has been waiting for us (first reply, a question, or a change request)."""
    opened, label = None, ""
    if r["status"] in ("new", "ai_recommended"):
        opened, label = r["created_at"], "First reply"
    elif r.get("customer_question"):
        opened, label = r["customer_question"]["at"], "Customer question"
    elif r["status"] == "changes_requested":
        e = next((x for x in reversed(r["events"]) if x["to"] == "changes_requested"), None)
        if e and e["role"] == "CUSTOMER":
            opened, label = e["at"], "Change request"
    if not opened:
        return None
    if any(e["role"] in STAFF and e["at"] >= opened and e["action"] != "assign" for e in r["events"]):
        return None  # someone replied
    due = add_ms(opened, s["request_reply_hours"] * HOUR)
    return {"stage": stage_at(opened, due, None, now), "opened_at": opened, "due_at": due, "label": label}


# ---------- what kind of problem, and how urgent ----------
def _has(t: str, words) -> bool:
    return any(w in t for w in words)


def situation_of(text: str, topic: str) -> str:
    t = text.lower()
    if _has(t, ["passport", "pasaporte"]) and _has(t, ["nawala", "lost", "naiwan", "missing", "ninakaw", "stolen"]):
        return "documents"
    if topic == "Safety & Health" or _has(t, ["stranded", "naiwan", "aksidente", "naaksidente", "accident", "food poisoning", "lagnat", "nilalagnat", "emergency", "unsafe"]):
        return "emergency"
    if _has(t, ["confirmation", "e-ticket", "booking ko", "booking namin"]) and not _has(t, ["refund", "charged"]):
        return "booking"
    if topic == "Payment & Refunds" or _has(t, ["refund", "charged", "gcash", "bayad"]):
        return "refund"
    if topic == "Flights & Transfers" or _has(t, ["flight", "sundo", "pickup", "pick up", "airport", "van", "transfer"]):
        return "transfer"
    if topic == "Hotels & Accommodation" or _has(t, ["hotel", "resort", "room"]):
        return "hotel"
    if topic == "Visa & Travel Documents" or _has(t, ["visa", "embassy"]):
        return "visa"
    if topic == "Booking & Reservations" or _has(t, ["booking", "confirmation", "ticket", "reservation"]):
        return "booking"
    if topic in ("Tours & Itinerary", "Tour Guides & Staff", "Destinations", "Waiting Time & Delays"):
        return "tour"
    return "general"


def traveling_now(text: str, situation: str) -> bool:
    """Signs that the traveller is on the trip right now (so every minute counts)."""
    t = text.lower()
    return situation in ("emergency", "documents") or _has(t, ["dito sa", "nandito", "right now", "ngayon", "stranded", "naiwan", "sa hotel", "sa airport"])


def priority_of(situation: str, traveling: bool) -> str:
    return "urgent" if traveling or situation in URGENT_SITUATIONS else "important"


# ---------- cases ----------
def open_case(*, id: str, now: str, source: str, text: str, client: str, client_key: str, by: str, situation=None, request=None,
              message_id=None, owner=None, is_sample: bool = False, rating=None, s: dict) -> dict:
    a = analyze(text, rating)
    sit = situation if situation and situation in SITUATIONS else situation_of(text, a.primary_topic)
    traveling = traveling_now(text, sit)
    priority = "important" if source == "feedback" else priority_of(sit, traveling)
    hours = s["urgent_hours"] if priority == "urgent" else s["important_hours"]
    reply_min = s["urgent_reply_minutes"] if priority == "urgent" else s["important_reply_minutes"]
    how = f"Urgent: solve within {hours} hours" if priority == "urgent" else f"Important: solve within {hours} hours"
    return {
        "id": id, "opened_at": now, "due_at": add_ms(now, hours * HOUR), "reply_due_at": add_ms(now, reply_min * 60000), "priority": priority,
        "situation": sit, "situation_label": SITUATIONS[sit]["label"], "source": source, "text": text[:2000], "client": client, "client_key": client_key,
        "request_id": (request or {}).get("id"), "request_ref": (request or {}).get("ref"), "message_id": message_id, "traveling_now": traveling,
        "owner": owner, "first_reply_at": None, "resolved_at": None, "steps": [{"text": t, "done": False} for t in SITUATIONS[sit]["steps"]],
        "is_sample": bool(is_sample),
        "updates": [{"at": now, "by": by, "kind": "opened", "text": f"Case opened from {SOURCE_WORD[source]}. {how}."}],
    }


def auto_case_for(action: str, note: str, rating):
    """When a customer's own words should open a case on their quotation request."""
    if action == "customer_feedback":
        return {"source": "feedback", "situation": None} if rating is not None and rating <= 2 else None
    if action in ("customer_question", "customer_changes") and note.strip() and analyze(note).label == "negative":
        a = analyze(note)
        sit = situation_of(note, a.primary_topic)
        return {"source": "request", "situation": "changes" if action == "customer_changes" and sit not in URGENT_SITUATIONS else None}
    return None


def message_needs_case(text: str, imported: bool) -> bool:
    """Live (not imported) unhappy messages open a case."""
    return not imported and analyze(text).label == "negative"


class CaseError(Exception):
    """A case step that is not allowed. The message is plain and safe to show."""


def _fail(m: str):
    raise CaseError(m)


CASE_ACTIONS = ("assign", "reply", "step", "note", "solve", "reopen", "traveling")


def case_act(prev: dict, action: str, actor: dict, payload: dict, now: str, s: dict, request_assignee_id=None) -> dict:
    """One step on a case. Owner (ADMIN) can do anything; others work cases they own or whose request is assigned to them."""
    c = copy.deepcopy(prev)
    payload = payload or {}
    note = str(payload.get("note") or "").strip()[:1000]
    mine = actor["role"] == "ADMIN" or (c["owner"] or {}).get("id") == actor["id"] or (not c["owner"] and request_assignee_id == actor["id"])
    if action == "assign":
        a = payload.get("assignee") or _fail("Choose who handles this case.")
        if actor["role"] != "ADMIN" and a["id"] != actor["id"]:
            _fail("Only the owner can give a case to someone else.")
        if actor["role"] != "ADMIN" and c["owner"] and c["owner"]["id"] != actor["id"]:
            _fail(f"This case belongs to {c['owner']['name']}.")
        c["owner"] = {"id": a["id"], "name": a["name"]}
        c["updates"].append({"at": now, "by": actor["name"], "kind": "assigned", "text": f"Assigned to {a['name']}."})
        return c
    if not mine:
        _fail(f"This case belongs to {c['owner']['name']}. Ask the owner to reassign it." if c["owner"] else "Take this case first.")
    if c["resolved_at"] and action != "reopen":
        _fail("This case is already solved.")
    if action == "reply":
        if not c["first_reply_at"]:
            c["first_reply_at"] = now
        c["updates"].append({"at": now, "by": actor["name"], "kind": "reply", "text": note or "Replied to the customer."})
    elif action == "step":
        i = payload.get("index")
        i = i if isinstance(i, int) and not isinstance(i, bool) else -1
        if not (0 <= i < len(c["steps"])):
            _fail("Unknown step.")
        c["steps"][i]["done"] = not c["steps"][i]["done"]
        c["updates"].append({"at": now, "by": actor["name"], "kind": "step", "text": f"{'Done' if c['steps'][i]['done'] else 'Not done'}: {c['steps'][i]['text']}"})
    elif action == "note":
        if not note:
            _fail("Please write a short note.")
        c["updates"].append({"at": now, "by": actor["name"], "kind": "note", "text": note})
    elif action == "solve":
        if not c["first_reply_at"]:
            c["first_reply_at"] = now
        c["resolved_at"] = now
        c["updates"].append({"at": now, "by": actor["name"], "kind": "solved", "text": note or "Solved."})
    elif action == "reopen":
        if not c["resolved_at"]:
            _fail("This case is still open.")
        urgent = c["priority"] == "urgent"
        c["resolved_at"] = None
        c["opened_at"] = now
        c["due_at"] = add_ms(now, (s["urgent_hours"] if urgent else s["important_hours"]) * HOUR)
        c["reply_due_at"] = add_ms(now, (s["urgent_reply_minutes"] if urgent else s["important_reply_minutes"]) * 60000)
        c["updates"].append({"at": now, "by": actor["name"], "kind": "reopened", "text": note or "Reopened. The clock starts again."})
    elif action == "traveling":
        c["traveling_now"] = bool(payload.get("value"))
        c["updates"].append({"at": now, "by": actor["name"], "kind": "traveling",
                             "text": "Marked as on a trip now." if c["traveling_now"] else "No longer marked as on a trip."})
    else:
        _fail("Unknown step.")
    return c


def case_view(c: dict, now: str) -> dict:
    stage = stage_at(c["opened_at"], c["due_at"], c["resolved_at"], now)
    return {**c, "stage": stage, "used": used_share(c["opened_at"], c["due_at"], c["resolved_at"] or now), "escalated": stage in ("red", "overdue"),
            "reply_stage": None if c["first_reply_at"] or c["resolved_at"] else stage_at(c["opened_at"], c["reply_due_at"], None, now),
            "steps_done": sum(1 for x in c["steps"] if x["done"]), "on_time": c["resolved_at"] <= c["due_at"] if c["resolved_at"] else None}


RANK = {"overdue": 0, "red": 1, "orange": 2, "yellow": 3, "green": 4, "solved": 5}


def sort_cases(vs: list[dict]) -> list[dict]:
    out = sorted(vs, key=lambda v: v["opened_at"])
    out.sort(key=lambda v: v["used"], reverse=True)
    out.sort(key=lambda v: RANK[v["stage"]])
    return out


def _avg(xs):
    return sum(xs) / len(xs) if xs else None


def _r1(x):
    return None if x is None else math.floor(x * 10 + 0.5) / 10


def _mins(a: str, b: str) -> float:
    return (ms(b) - ms(a)) / 60000


def clock_stats(cases: list[dict], now: str, frm=None) -> dict:
    """Counts per colour (open cases) and solve stats (cases solved since `frm`)."""
    vs = [case_view(c, now) for c in cases]
    open_ = [v for v in vs if not v["resolved_at"]]
    solved = [v for v in vs if v["resolved_at"] and (not frm or v["resolved_at"] >= frm)]
    by_stage = {"overdue": 0, "red": 0, "orange": 0, "yellow": 0, "green": 0}
    for v in open_:
        by_stage[v["stage"]] += 1
    people: dict = {}
    for v in open_ + solved:
        if not v["owner"]:
            continue
        p = people.setdefault(v["owner"]["id"], {"id": v["owner"]["id"], "name": v["owner"]["name"], "o": [], "s": []})
        (p["s"] if v["resolved_at"] else p["o"]).append(v)

    def pct(a, b):
        return _r1((a / b) * 100) if b else None

    def solve_min(xs):
        m = _avg([_mins(v["opened_at"], v["resolved_at"]) for v in xs])
        return None if m is None else js_round(m)

    fr = _avg([_mins(v["opened_at"], v["first_reply_at"]) for v in solved if v["first_reply_at"]])
    by_person = [{"id": p["id"], "name": p["name"], "open": len(p["o"]), "solved": len(p["s"]),
                  "on_time_pct": pct(sum(1 for v in p["s"] if v["on_time"]), len(p["s"])), "avg_solve_minutes": solve_min(p["s"])} for p in people.values()]
    by_person.sort(key=lambda x: x["name"])
    by_person.sort(key=lambda x: x["solved"] + x["open"], reverse=True)
    return {
        "open": len(open_), "by_stage": by_stage, "escalated": sum(1 for v in open_ if v["escalated"]), "traveling_now": sum(1 for v in open_ if v["traveling_now"]),
        "no_reply_yet": sum(1 for v in open_ if not v["first_reply_at"]), "solved": len(solved),
        "on_time_pct": pct(sum(1 for v in solved if v["on_time"]), len(solved)), "avg_solve_minutes": solve_min(solved),
        "avg_first_reply_minutes": None if fr is None else js_round(fr), "by_person": by_person,
    }
