"""Automatic weekly report: a short email to the owner every Monday morning (8 AM Philippine time).

build() returns the numbers and plain sentences; the same structure is shown as a preview in the app and
rendered into the email. Without SMTP settings the email is not sent, only logged.
Same wording as the browser demo (demoApi.ts, weeklyData).
"""
from __future__ import annotations

import html as H
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Case
from app.services import team_report
from app.services.analytics import summarize
from app.services.filters import FeedbackFilters, fetch
from app.services.notifications import owner_emails, send_email, smtp_ready
from app.services.settings_service import get_setting, set_setting
from app.services.watch import hits, watch_words

log = logging.getLogger(__name__)
PH = timezone(timedelta(hours=8))


def _aware(d):
    return d if d is None or d.tzinfo else d.replace(tzinfo=timezone.utc)


def _plural(n: int, one: str, many: str | None = None) -> str:
    return f"{n} {one if n == 1 else (many or one + 's')}"


def verdict(k: dict, prev_neg: float, urgent_open: int) -> str:
    if not k["total"]:
        return "A quiet week: no new messages came in."
    if urgent_open:
        return f"{_plural(urgent_open, 'traveler')} still {'needs' if urgent_open == 1 else 'need'} an answer. Start there this week."
    if k["negative_pct"] >= prev_neg + 5:
        return f"Unhappy messages went up this week ({prev_neg}% to {k['negative_pct']}%)."
    if k["negative_pct"] + 5 <= prev_neg:
        return f"A better week: unhappy messages went down ({prev_neg}% to {k['negative_pct']}%)."
    return f"A steady week: {k['positive_pct']}% of messages were happy."


def build(db: Session, now: datetime | None = None) -> dict:
    now = now or datetime.now(timezone.utc)
    start, prev_start = now - timedelta(days=7), now - timedelta(days=14)
    rows = fetch(db, FeedbackFilters(date_from=start, date_to=now))
    cur = summarize(rows)
    prev = summarize(fetch(db, FeedbackFilters(date_from=prev_start, date_to=start)))["kpis"]
    k = cur["kpis"]
    cases = db.scalars(select(Case)).unique().all()
    open_ = [c for c in cases if not c.resolved_at]
    solved = [c for c in cases if c.resolved_at and _aware(c.resolved_at) >= start]
    clock = {"open": len(open_), "overdue": sum(1 for c in open_ if _aware(c.due_at) < now), "solved": len(solved),
             "on_time_pct": round(100 * sum(1 for c in solved if _aware(c.resolved_at) <= _aware(c.due_at)) / len(solved)) if solved else None}
    words = watch_words(db)
    wc: dict[str, int] = {}
    for r in rows:
        for w in hits(r.content, words):
            wc[w] = wc.get(w, 0) + 1
    watch = [{"word": w, "count": n} for w, n in sorted(wc.items(), key=lambda x: -x[1])]
    team = [{"name": s["name"], "handled": s["handled"], "avg_first_reply_minutes": s["avg_first_reply_minutes"]}
            for s in _team_week(db, start) if s["name"] != team_report.UNASSIGNED][:5]
    actions = []
    if cur["top_complaints"]:
        actions.append(f"Fix the biggest complaint first: {cur['top_complaints'][0]['topic'].lower()}.")
    if clock["overdue"]:
        actions.append(f"{_plural(clock['overdue'], 'case is', 'cases are')} past the deadline on the Response Clock.")
    if watch:
        n = sum(w["count"] for w in watch)
        actions.append(f"{_plural(n, 'message')} mentioned your watch words ({', '.join(w['word'] for w in watch[:3])}).")
    if cur["most_appreciated"]:
        actions.append(f"Thank your team: travelers loved your {cur['most_appreciated'][0]['topic'].lower()}.")
    to_ph = lambda d: d.astimezone(PH).strftime("%b %d").replace(" 0", " ")  # noqa: E731
    return {
        "subject": f"Likha Pulse weekly report: {to_ph(start)} to {to_ph(now)}",
        "period": {"from": start.isoformat(), "to": now.isoformat()},
        "verdict": verdict(k, prev["negative_pct"], k["unresolved_high_priority"]),
        "kpis": {"total": k["total"], "positive_pct": k["positive_pct"], "negative_pct": k["negative_pct"], "prev_negative_pct": prev["negative_pct"],
                 "prev_total": prev["total"], "urgent_open": k["unresolved_high_priority"], "sample_count": k["sample_count"]},
        "clock": clock, "top_complaints": cur["top_complaints"][:3], "most_appreciated": cur["most_appreciated"][:3],
        "watch": watch, "team": team, "actions": actions,
    }


def _team_week(db: Session, since: datetime) -> list[dict]:
    rows = team_report.handled_rows(db, since)
    names = sorted({r["handler"] for r in rows})
    out = [{"name": n, **team_report._summary([r for r in rows if r["handler"] == n])} for n in names]
    return sorted(out, key=lambda s: (s["name"] == team_report.UNASSIGNED, -s["handled"]))


def _mins(m: int | None) -> str:
    if m is None:
        return "—"
    return f"{m} min" if m < 60 else f"{m // 60}h {m % 60}m" if m < 2880 else f"{m // 1440}d {(m % 1440) // 60}h"


def to_text(d: dict) -> str:
    k, c = d["kpis"], d["clock"]
    lines = [d["subject"], "", d["verdict"], "",
             f"Messages: {k['total']} (last week {k['prev_total']})", f"Happy: {k['positive_pct']}%   Unhappy: {k['negative_pct']}%",
             f"Response Clock: {c['open']} open, {c['overdue']} overdue, {c['solved']} solved this week"
             + (f" ({c['on_time_pct']}% on time)" if c["on_time_pct"] is not None else ""), ""]
    if d["top_complaints"]:
        lines.append("Most complaints: " + ", ".join(f"{t['topic']} ({t['count']})" for t in d["top_complaints"]))
    if d["most_appreciated"]:
        lines.append("Most loved: " + ", ".join(f"{t['topic']} ({t['count']})" for t in d["most_appreciated"]))
    if d["watch"]:
        lines.append("Watch words: " + ", ".join(f"{w['word']} ({w['count']})" for w in d["watch"]))
    if d["team"]:
        lines.append("Team: " + "; ".join(f"{t['name']}: {t['handled']} handled, first reply {_mins(t['avg_first_reply_minutes'])}" for t in d["team"]))
    if d["actions"]:
        lines += ["", "This week:"] + [f"- {a}" for a in d["actions"]]
    if k["sample_count"]:
        lines += ["", f"Note: {k['sample_count']} of these are sample messages, not real travelers."]
    return "\n".join(lines) + "\n\nLikha Pulse"


def to_html(d: dict) -> str:
    e = H.escape
    k, c = d["kpis"], d["clock"]
    stat = lambda label, value: (f'<td style="padding:12px 14px;border:1px solid #efe8dc;border-radius:10px"><div style="font-size:11px;letter-spacing:.14em;'  # noqa: E731
                                 f'text-transform:uppercase;color:#8a8f99">{e(label)}</div><div style="font:600 26px Georgia,serif;color:#14161b">{e(str(value))}</div></td>')
    li = lambda items: "".join(f"<li>{e(x)}</li>" for x in items)  # noqa: E731
    parts = [
        '<div style="background:#f7f3ec;padding:24px;font-family:Arial,sans-serif;color:#2a2e37">',
        '<div style="max-width:600px;margin:auto;background:#fcfaf6;border:1px solid #efe8dc;border-radius:16px;overflow:hidden">',
        f'<div style="background:#0c0d10;color:#f7f3ec;padding:24px"><div style="font-size:11px;letter-spacing:.24em;color:#d9c39a">LIKHA PULSE · WEEKLY REPORT</div>'
        f'<div style="font:600 24px Georgia,serif;margin-top:6px">{e(d["verdict"])}</div></div>',
        '<div style="padding:20px 24px"><table style="width:100%;border-collapse:separate;border-spacing:6px"><tr>',
        stat("Messages", k["total"]), stat("Happy", f"{k['positive_pct']}%"), stat("Unhappy", f"{k['negative_pct']}%"), stat("Need an answer", k["urgent_open"]),
        "</tr></table>",
        f'<p style="font-size:14px">Response Clock: <b>{c["open"]}</b> open, <b>{c["overdue"]}</b> overdue, <b>{c["solved"]}</b> solved this week'
        + (f' ({c["on_time_pct"]}% on time)' if c["on_time_pct"] is not None else "") + ".</p>",
    ]
    if d["top_complaints"]:
        parts.append(f'<p style="font-size:14px"><b>Most complaints:</b> {e(", ".join(t["topic"] for t in d["top_complaints"]))}</p>')
    if d["most_appreciated"]:
        parts.append(f'<p style="font-size:14px"><b>Most loved:</b> {e(", ".join(t["topic"] for t in d["most_appreciated"]))}</p>')
    if d["watch"]:
        parts.append(f'<p style="font-size:14px"><b>Watch words:</b> {e(", ".join(w["word"] + " (" + str(w["count"]) + ")" for w in d["watch"]))}</p>')
    if d["team"]:
        parts.append('<p style="font-size:14px;margin-bottom:4px"><b>Team</b></p><ul style="font-size:14px;margin-top:0">'
                     + li(f"{t['name']}: {t['handled']} handled, first reply {_mins(t['avg_first_reply_minutes'])}" for t in d["team"]) + "</ul>")
    if d["actions"]:
        parts.append('<div style="background:#faf6ee;border:1px solid #d9c39a;border-radius:12px;padding:14px 18px"><b style="color:#8c6d36">This week</b>'
                     f'<ul style="font-size:14px;margin:6px 0 0">{li(d["actions"])}</ul></div>')
    if k["sample_count"]:
        parts.append(f'<p style="font-size:12px;color:#8a8f99">Note: {k["sample_count"]} of these are sample messages, not real travelers.</p>')
    parts.append("</div></div></div>")
    return "".join(parts)


def recipients(db: Session) -> list[str]:
    raw = get_setting(db, "weekly_report").get("recipients", "") or ""
    listed = [x.strip() for x in raw.replace(";", ",").split(",") if x.strip()]
    return listed or owner_emails(db)


def preview(db: Session) -> dict:
    cfg = get_setting(db, "weekly_report")
    d = build(db)
    return {**d, "enabled": bool(cfg.get("enabled")), "recipients": recipients(db), "recipients_setting": cfg.get("recipients", ""),
            "email_ready": smtp_ready(), "last_sent_week": cfg.get("last_sent_week", ""), "schedule": "Every Monday, 8:00 AM (Philippine time)"}


def send_weekly(db: Session, force: bool = False, now: datetime | None = None) -> dict:
    """Called by the Monday job (and by the 'Send now' button with force=True). Sends at most once per week."""
    now = now or datetime.now(timezone.utc)
    cfg = get_setting(db, "weekly_report")
    week = now.astimezone(PH).strftime("%G-W%V")
    if not force and not cfg.get("enabled"):
        return {"sent": False, "detail": "The weekly report is turned off."}
    if not force and cfg.get("last_sent_week") == week:
        return {"sent": False, "detail": "This week's report was already sent."}
    d = build(db, now)
    to = recipients(db)
    ok, detail = send_email(to, d["subject"], to_text(d), to_html(d))
    if ok:
        set_setting(db, "weekly_report", {"last_sent_week": week})
    log.info("weekly report %s: %s", week, detail)
    return {"sent": ok, "detail": detail, "recipients": to, "week": week}
