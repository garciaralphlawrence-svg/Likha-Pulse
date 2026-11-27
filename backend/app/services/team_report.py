"""Team response report: who handled each message and how fast (first reply and resolution time),
per staff member and per month. Same numbers as the browser demo (demoApi.ts, teamReport)."""
from __future__ import annotations

import csv
import io
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import Case, Feedback

PH = timezone(timedelta(hours=8))  # months are counted in Philippine time
UNASSIGNED = "Not assigned"


def _aware(d: datetime | None) -> datetime | None:
    return d if d is None or d.tzinfo else d.replace(tzinfo=timezone.utc)


def _minutes(a: datetime | None, b: datetime | None) -> float | None:
    a, b = _aware(a), _aware(b)
    return max(0.0, (b - a).total_seconds() / 60) if a and b else None


def handled_rows(db: Session, since: datetime) -> list[dict]:
    q = (select(Feedback).outerjoin(Case, Case.feedback_id == Feedback.id)
         .where(Feedback.created_at >= since, Feedback.is_imported.is_(False),
                or_(Case.feedback_id.is_not(None), Feedback.handled_by_id.is_not(None), Feedback.first_reply_at.is_not(None)))
         .order_by(Feedback.created_at.desc()))
    rows = []
    for fb in db.scalars(q).unique().all():
        c = fb.case
        start = _aware(c.opened_at if c else fb.created_at)
        who = (c.assignee.full_name if c and c.assignee else None) or (fb.handled_by.full_name if fb.handled_by else None) or UNASSIGNED
        first = (c.first_reply_at if c else None) or fb.first_reply_at
        done = (c.resolved_at if c else None) or (fb.resolved_at if fb.action_status == "resolved" else None)
        rows.append({
            "id": fb.id, "content": fb.content, "platform": fb.platform.code, "platform_name": fb.platform.name, "is_sample": fb.is_sample,
            "handler": who, "started_at": start.isoformat(), "month": start.astimezone(PH).strftime("%Y-%m"), "is_case": c is not None,
            "priority": fb.priority.final_level if fb.priority else "low",
            "first_reply_minutes": _round(_minutes(start, first)), "resolution_minutes": _round(_minutes(start, done)),
            "status": "solved" if done else "replied" if first else "waiting",
        })
    return rows


def _round(x: float | None) -> int | None:
    return None if x is None else round(x)


def _summary(rows: list[dict]) -> dict:
    fr = [r["first_reply_minutes"] for r in rows if r["first_reply_minutes"] is not None]
    rs = [r["resolution_minutes"] for r in rows if r["resolution_minutes"] is not None]
    avg = lambda xs: round(sum(xs) / len(xs)) if xs else None  # noqa: E731
    return {"handled": len(rows), "replied": len(fr), "solved": len(rs), "avg_first_reply_minutes": avg(fr), "avg_resolution_minutes": avg(rs)}


def report(db: Session, months: int = 6, now: datetime | None = None) -> dict:
    now = now or datetime.now(timezone.utc)
    local = now.astimezone(PH)
    y, m = local.year, local.month - (months - 1)
    while m < 1:
        y, m = y - 1, m + 12
    since = datetime(y, m, 1, tzinfo=PH)
    rows = handled_rows(db, since)
    keys, (yy, mm) = [], (y, m)
    for _ in range(months):
        keys.append(f"{yy:04d}-{mm:02d}")
        yy, mm = (yy + 1, 1) if mm == 12 else (yy, mm + 1)
    by_staff: dict[str, list] = defaultdict(list)
    by_month: dict[tuple[str, str], list] = defaultdict(list)
    for r in rows:
        by_staff[r["handler"]].append(r)
        by_month[(r["month"], r["handler"])].append(r)
    staff = sorted(({"name": n, **_summary(rs)} for n, rs in by_staff.items()), key=lambda s: (s["name"] == UNASSIGNED, -s["handled"], s["name"]))
    names = [s["name"] for s in staff]
    return {
        "period": {"from": since.isoformat(), "to": now.isoformat()}, "months": keys, "team": names,
        "totals": _summary(rows), "staff": staff,
        "by_month": [{"month": k, "name": n, **_summary(by_month[(k, n)])} for k in keys for n in names if by_month.get((k, n))],
        "items": rows[:200],
    }


CSV_HEAD = ["Date", "Source", "Message", "Handled by", "Response Clock case", "First reply (minutes)", "Solved in (minutes)", "Status", "Sample data"]


def to_csv(db: Session, months: int = 6) -> str:
    data = report(db, months)
    rows = handled_rows(db, datetime.fromisoformat(data["period"]["from"]))
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Team response report", f"{data['months'][0]} to {data['months'][-1]}"])
    w.writerow([])
    w.writerow(["Staff member", "Handled", "Replied", "Solved", "Average first reply (minutes)", "Average time to solve (minutes)"])
    for s in data["staff"]:
        w.writerow([s["name"], s["handled"], s["replied"], s["solved"], s["avg_first_reply_minutes"] or "", s["avg_resolution_minutes"] or ""])
    w.writerow([])
    w.writerow(["Month", "Staff member", "Handled", "Replied", "Solved", "Average first reply (minutes)", "Average time to solve (minutes)"])
    for s in data["by_month"]:
        w.writerow([s["month"], s["name"], s["handled"], s["replied"], s["solved"], s["avg_first_reply_minutes"] or "", s["avg_resolution_minutes"] or ""])
    w.writerow([])
    w.writerow(CSV_HEAD)
    for r in rows:
        w.writerow([r["started_at"][:16].replace("T", " "), r["platform_name"], r["content"], r["handler"], "yes" if r["is_case"] else "no",
                    "" if r["first_reply_minutes"] is None else r["first_reply_minutes"],
                    "" if r["resolution_minutes"] is None else r["resolution_minutes"], r["status"], "yes" if r["is_sample"] else "no"])
    return "﻿" + buf.getvalue()
