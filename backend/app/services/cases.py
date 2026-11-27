"""Response Clock: every Urgent or Important message becomes a case with a deadline.

Colors change as time runs out (for a 24-hour case, every 6 hours):
0-25% of the time used = green, 25-50% = yellow, 50-75% = orange, 75-100% = red, past the deadline = overdue.
Same rules as frontend/src/lib/clock.ts. Playbooks live in playbooks.json (shared with the browser demo).
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Case, Feedback, User
from app.services.settings_service import get_setting

PLAYBOOKS: dict = json.loads((Path(__file__).parent / "playbooks.json").read_text(encoding="utf-8"))["situations"]
MANAGER_NOTE = "Escalated to the manager: less than a quarter of the time is left"


def aware(d: datetime | None) -> datetime | None:
    return d if d is None or d.tzinfo else d.replace(tzinfo=timezone.utc)


def _has(t: str, words: list[str]) -> bool:
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
    t = text.lower()
    return situation in ("emergency", "documents") or _has(t, ["dito sa", "nandito", "right now", "ngayon", "stranded", "naiwan", "sa hotel", "sa airport"])


def stage_of(c: Case, now: datetime | None = None) -> str:
    if c.resolved_at:
        return "solved"
    now = now or datetime.now(timezone.utc)
    a, b = aware(c.opened_at), aware(c.due_at)
    f = (now - a).total_seconds() / max(1.0, (b - a).total_seconds())
    return "overdue" if f >= 1 else "red" if f >= 0.75 else "orange" if f >= 0.5 else "yellow" if f >= 0.25 else "green"


def dur(seconds: float) -> str:
    m = max(0, round(seconds / 60))
    if m < 60:
        return f"{m}m"
    h, r = divmod(m, 60)
    if h < 48:
        return f"{h}h {r}m" if r else f"{h}h"
    d, hh = divmod(h, 24)
    return f"{d}d {hh}h" if hh else f"{d}d"


def add_update(c: Case, kind: str, text: str, by: str, at: datetime | None = None) -> None:
    at = at or datetime.now(timezone.utc)
    c.updates = [*(c.updates or []), {"at": at.isoformat(), "by": by, "kind": kind, "text": text}]
    c.last_update_at = at


def open_case(db: Session, fb: Feedback, at: datetime | None = None) -> Case | None:
    """Create the case for an Urgent or Important message (once)."""
    level = fb.priority.final_level if fb.priority else "low"
    if level not in ("critical", "high") or db.get(Case, fb.id):
        return None
    cfg = get_setting(db, "response_clock")
    urgent = level == "critical"
    hours = int(cfg["urgent_hours"] if urgent else cfg["important_hours"])
    reply_min = int(cfg["urgent_reply_minutes"] if urgent else cfg["important_reply_minutes"])
    t = aware(at or fb.created_at)
    topic = next((x.topic for x in fb.topics if x.is_primary), "General")
    situation = situation_of(fb.content, topic)
    c = Case(feedback_id=fb.id, situation=situation, traveling_now=traveling_now(fb.content, situation), opened_at=t,
             due_at=t + timedelta(hours=hours), deadline_hours=hours, reply_due_at=t + timedelta(minutes=reply_min),
             last_update_at=t, escalated=False, steps=[{"text": s, "done": False} for s in PLAYBOOKS[situation]["steps"]], updates=[])
    add_update(c, "opened", f"Case opened: {'Urgent' if urgent else 'Important'}, solve within {hours} hours", "Likha Pulse", t)
    db.add(c)
    return c


def solve(c: Case, by: str, note: str = "") -> None:
    if c.resolved_at:
        return
    now = datetime.now(timezone.utc)
    c.resolved_at = now
    c.first_reply_at = c.first_reply_at or now
    add_update(c, "solved", f"Solved in {dur((now - aware(c.opened_at)).total_seconds())}" + (f": {note}" if note else ""), by)


def reopen(c: Case, by: str) -> None:
    now = datetime.now(timezone.utc)
    c.resolved_at, c.escalated = None, False
    c.opened_at, c.due_at, c.reply_due_at = now, now + timedelta(hours=c.deadline_hours), now + timedelta(hours=1)
    add_update(c, "reopened", "Reopened: the clock starts again", by)


def case_out(c: Case) -> dict:
    fb = c.feedback
    iso = lambda d: aware(d).isoformat() if d else None  # noqa: E731
    topic = next((x.topic for x in fb.topics if x.is_primary), "General")
    return {
        "id": fb.id, "content": fb.content, "platform": fb.platform.code, "platform_name": fb.platform.name, "author": fb.author_ref,
        "priority": fb.priority.final_level if fb.priority else "low", "topic": topic, "is_sample": fb.is_sample,
        "headline": {"emotion": fb.emotion.final_emotion if fb.emotion else "neutral", "intent": fb.intent.final_intent if fb.intent else "general_feedback",
                     "topic": topic, "sentiment": fb.sentiment.final_label if fb.sentiment else "neutral"},
        "situation": c.situation, "traveling_now": c.traveling_now, "opened_at": iso(c.opened_at), "due_at": iso(c.due_at),
        "deadline_hours": c.deadline_hours, "reply_due_at": iso(c.reply_due_at), "first_reply_at": iso(c.first_reply_at),
        "resolved_at": iso(c.resolved_at), "last_update_at": iso(c.last_update_at), "assignee": c.assignee.full_name if c.assignee else None,
        "escalated": c.escalated, "steps": c.steps or [], "updates": c.updates or [],
    }


def stats(db: Session) -> dict:
    now = datetime.now(timezone.utc)
    rows = db.scalars(select(Case)).all()
    open_ = [c for c in rows if not c.resolved_at]
    st = lambda k: sum(1 for c in open_ if stage_of(c, now) == k)  # noqa: E731
    solved = [c for c in rows if c.resolved_at and now - aware(c.resolved_at) < timedelta(days=30)]
    replied = [c for c in rows if c.first_reply_at and now - aware(c.opened_at) < timedelta(days=30)]
    avg = lambda xs: round(sum(xs) / len(xs)) if xs else None  # noqa: E731
    return {
        "open": len(open_), "on_track": st("green"), "needs_progress": st("yellow"), "at_risk": st("orange"), "due_soon": st("red"),
        "overdue": st("overdue"), "traveling_now": sum(1 for c in open_ if c.traveling_now), "no_reply_yet": sum(1 for c in open_ if not c.first_reply_at),
        "solved_30d": len(solved),
        "solved_on_time_pct": round(100 * sum(1 for c in solved if aware(c.resolved_at) <= aware(c.due_at)) / len(solved)) if solved else None,
        "avg_solve_minutes": avg([(aware(c.resolved_at) - aware(c.opened_at)).total_seconds() / 60 for c in solved]),
        "avg_first_reply_minutes": avg([(aware(c.first_reply_at) - aware(c.opened_at)).total_seconds() / 60 for c in replied]),
    }


def clock_checks(db: Session, push) -> int:
    """Escalate cases in the red zone and raise alerts for due-soon, overdue and unanswered cases."""
    now = datetime.now(timezone.utc)
    n = 0
    for c in db.scalars(select(Case).where(Case.resolved_at.is_(None))).all():
        stage = stage_of(c, now)
        fb = c.feedback
        snip = fb.content if len(fb.content) <= 120 else fb.content[:120] + "…"
        label = PLAYBOOKS[c.situation]["label"]
        if stage in ("red", "overdue") and not c.escalated:
            c.escalated = True
            add_update(c, "escalated", MANAGER_NOTE, "Likha Pulse")
        if stage == "red":
            n += push(db, "case_due_soon", "critical", f"Due in {dur((aware(c.due_at) - now).total_seconds())}: {label}", snip, f"due:{fb.id}", fb.id)
        if stage == "overdue":
            n += push(db, "case_overdue", "critical", f"Overdue: {label}", f"Not solved within {c.deadline_hours} hours. {snip}", f"overdue:{fb.id}", fb.id)
        if not c.first_reply_at and now > aware(c.reply_due_at):
            n += push(db, "case_no_reply", "high", "No reply yet", f"The traveler has waited {dur((now - aware(c.opened_at)).total_seconds())} for a first reply. {snip}",
                      f"noreply:{fb.id}", fb.id)
    db.commit()
    return n


def team(db: Session) -> list[User]:
    return [u for u in db.scalars(select(User).where(User.is_active.is_(True))).all() if u.role.name != "VIEWER"]


def seed_cases(db: Session) -> int:
    """Sample cases at different ages so the clock shows every color; older generated cases were solved by the team."""
    import random

    from app.integrations.base import FetchedItem
    from app.services.ingestion import ingest

    data = json.loads((Path(__file__).parent / "playbooks.json").read_text(encoding="utf-8"))["sample_cases"]
    now = datetime.now(timezone.utc)
    users = {u.full_name: u for u in team(db)}
    live, n = set(), 0
    for i, sc in enumerate(data):
        t0 = now - timedelta(hours=sc["hours_ago"])
        item = FetchedItem(external_id=f"sample-case-{i}", content=sc["text"], created_at=t0, author=f"sample-case-{i}", rating=None,
                           author_name=f"Sample traveler {201 + i}")
        fb = ingest(db, sc["platform"], item, is_sample=True, notify=False)
        if not fb or not fb.case:
            continue
        n += 1
        c = fb.case
        live.add(fb.id)
        c.traveling_now = sc["traveling"]
        who = sc["assignee"]
        if who and who in users:
            c.assignee_id = users[who].id
            add_update(c, "assigned", f"Assigned to {who}", "Likha Pulse", t0 + timedelta(minutes=6))
        if sc["reply_after_min"] is not None:
            c.first_reply_at = t0 + timedelta(minutes=sc["reply_after_min"])
            add_update(c, "reply", "Replied to the traveler", who or "Team", c.first_reply_at)
        steps = [dict(s) for s in c.steps]
        for k in range(sc["steps_done"]):
            steps[k]["done"] = True
            when = t0 + timedelta(minutes=sc["reply_after_min"] or 30) + timedelta(hours=(k + 1) * 0.12 * sc["hours_ago"])
            add_update(c, "step", f"Done: {steps[k]['text']}", who or "Team", min(now - timedelta(minutes=10), when))
        c.steps = steps
    rng = random.Random(7)
    members = list(users.values())
    for c in db.scalars(select(Case).where(Case.resolved_at.is_(None))).unique().all():
        if c.feedback_id in live:
            continue
        t0 = aware(c.opened_at)
        age_h = (now - t0).total_seconds() / 3600
        if age_h < 1:
            continue
        urgent = bool(c.feedback.priority) and c.feedback.priority.final_level == "critical"
        reply_min = min(age_h * 60 - 1, 8 + rng.random() * 70 if urgent else 15 + rng.random() * 260)
        c.first_reply_at = t0 + timedelta(minutes=reply_min)
        member = rng.choice(members) if members else None
        if member:
            c.assignee_id = c.feedback.handled_by_id = member.id
        c.feedback.first_reply_at = c.first_reply_at
        add_update(c, "reply", "Replied to the traveler", member.full_name if member else "Team", c.first_reply_at)
        if age_h >= 30:
            share = 0.15 + rng.random() * 0.8 if rng.random() < 0.9 else 1.05 + rng.random() * 0.5
            solve_h = min(age_h - 0.5, c.deadline_hours * share)
            c.steps = [{**s, "done": True} for s in c.steps]
            c.resolved_at = t0 + timedelta(hours=solve_h)
            c.feedback.action_status, c.feedback.resolved_at = "resolved", c.resolved_at
            add_update(c, "solved", f"Solved in {dur(solve_h * 3600)}", "Team", c.resolved_at)
    # everyday questions, follow-ups and complaints the team already answered (for the Team response report)
    asks = ("inquiry", "follow_up_request", "complaint", "reported_problem", "request_assistance")
    for fb in db.scalars(select(Feedback).where(Feedback.is_sample.is_(True), Feedback.first_reply_at.is_(None))).unique().all():
        age_h = (now - aware(fb.created_at)).total_seconds() / 3600
        if fb.case or not fb.intent or fb.intent.final_intent not in asks or age_h < 48 or rng.random() > 0.7:
            continue
        fb.first_reply_at = aware(fb.created_at) + timedelta(minutes=10 + rng.random() * 590)
        fb.handled_by_id = rng.choice(members).id if members else None
        if rng.random() < 0.6:
            fb.action_status, fb.resolved_at = "resolved", fb.first_reply_at + timedelta(hours=0.5 + rng.random() * 47)
    db.commit()
    return n
