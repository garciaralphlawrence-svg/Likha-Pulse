"""Customer care: Facebook/Messenger/imported messages, suggested replies, keyword watch, client history, team report,
weekly report and imports.

Port twin of frontend/src/quote/care.ts (same seeds, same random sequence, same sentences).
"""
from __future__ import annotations

import json
import math
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.quotes.clock import (HOUR, add_ms, case_act, case_view, clock_stats, iso_ms, js_round, message_needs_case, ms, open_case,
                              request_clock, situation_of, stage_at)
from app.quotes.engine import dest_by_code, peso
from app.quotes.history import rng
from app.quotes.owner import THEME_LABEL, mood_of
from app.quotes.workflow import STATUSES
from app.sentiment.rule_engine import analyze

_DIR = Path(__file__).parent
RT: dict = json.loads((_DIR / "reply_templates.json").read_text(encoding="utf-8"))
SM: dict = json.loads((_DIR / "sample_messages.json").read_text(encoding="utf-8"))
PB: dict = json.loads((_DIR / "playbooks.json").read_text(encoding="utf-8"))
CHANNEL_LABEL = {"facebook_page": "Facebook comment", "messenger": "Messenger", "import": "Imported", "website": "PAPH website"}
EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)


def _r1(x: float) -> float:
    return math.floor(x * 10 + 0.5) / 10


def _avg(xs):
    return sum(xs) / len(xs) if xs else None


def _mins(a: str, b: str) -> float:
    return (ms(b) - ms(a)) / 60000


# ---------- who is the client ----------
def name_key(name: str) -> str:
    return "n:" + re.sub(r"\s+", " ", name.strip().lower())


def contact_key(contact: str) -> str:
    c = contact.strip().lower()
    if "@" in c:
        return "e:" + c
    d = re.sub(r"\D", "", c)
    return "p:" + d[-7:] if len(d) >= 7 else name_key(c)


def request_keys(r: dict) -> list[str]:
    return [contact_key(r["customer"]["contact"]), name_key(r["customer"]["name"])]


def client_label(name: str, key: str, anonymize: bool, sample: bool) -> str:
    """Real (not sample) names are shown as a short code when ANONYMIZE_AUTHORS is on."""
    return name if sample or not anonymize else f"Client {re.sub(r'[^a-z0-9]', '', key, flags=re.IGNORECASE)[-4:].upper()}"


# ---------- messages ----------
def message_clock(m: dict, now: str, s: dict):
    if m["first_reply_at"] or m["is_imported"]:
        return None
    due = add_ms(m["at"], s["request_reply_hours"] * HOUR)
    return {"stage": stage_at(m["at"], due, None, now), "opened_at": m["at"], "due_at": due, "label": "Reply"}


def message_view(m: dict, now: str, s: dict, ref_of=lambda _id: None) -> dict:
    md = mood_of(m["text"])
    return {**m, "mood": md["mood"], "score": md["score"], "theme": md["theme"], "theme_label": THEME_LABEL.get(md["theme"], md["theme"]),
            "clock": message_clock(m, now, s), "watch_hits": watch_hits(m["text"], s["watch_words"]), "reply_key": reply_key(m["text"]),
            "channel_label": CHANNEL_LABEL[m["channel"]], "request_ref": ref_of(m["request_id"]) if m["request_id"] else None}


def mark_replied(m: dict, actor: dict, now: str) -> dict:
    """"I replied": stops the reply clock and records who handled it."""
    if m["first_reply_at"]:
        return m
    return {**m, "first_reply_at": now, "handled_by": {"id": actor["id"], "name": actor["name"]}}


def receive_message(*, id: str, channel: str, client: str, text: str, at: str, is_sample: bool = False, is_imported: bool = False,
                    external_id=None, case_id: str, s: dict, owner=None, client_key: str | None = None) -> dict:
    """A new live message: saved, and an unhappy one opens a case right away. Returns {"message", "case"}."""
    m = {"id": id, "channel": channel, "client": client, "client_key": client_key or name_key(client), "text": text[:2000], "at": at,
         "is_sample": bool(is_sample), "is_imported": bool(is_imported), "request_id": None, "handled_by": None,
         "first_reply_at": at if is_imported else None, "case_id": None, "external_id": external_id}
    if not message_needs_case(m["text"], m["is_imported"]):
        return {"message": m, "case": None}
    c = open_case(id=case_id, now=at, source="message", text=m["text"], client=m["client"], client_key=m["client_key"], by="PAPH AI",
                  message_id=m["id"], owner=owner, is_sample=m["is_sample"], s=s)
    m["case_id"] = c["id"]
    return {"message": m, "case": c}


# ---------- suggested replies ----------
REPLY_SITUATIONS: dict = RT["situations"]
REPLY_LANGUAGES = {"en": "English", "tl": "Taglish"}
DEFAULT_REPLIES: list = RT["templates"]


def reply_key(text: str, context: str = "message") -> str:
    """Which kind of suggested reply fits what the customer wrote."""
    a = analyze(text)
    t = text.lower()
    s = situation_of(text, a.primary_topic)
    if context == "feedback":
        return "complaint" if a.label == "negative" else "after_trip"
    if context == "changes":
        return "changes"
    if s == "documents":
        return "lost_passport"
    if s == "emergency":
        return "emergency"
    if a.label == "positive" or a.intent in ("compliment", "appreciation"):
        return "thank_you"
    if s == "refund":
        return "refund"
    if re.search(r"\b(magkano|how much|price|presyo|rate|rates|promo)\b", t, re.ASCII):
        return "price"
    if s == "transfer" or a.primary_topic == "Waiting Time & Delays":
        return "delay"
    if s in ("hotel", "visa", "booking"):
        return s
    if context == "offer":
        return "offer_follow_up"
    if a.intent == "inquiry":
        return "inquiry"
    if a.label == "negative" or a.intent in ("complaint", "reported_problem", "follow_up_request"):
        return "complaint"
    return "general"


def fill_reply(body: str, ctx: dict) -> str:
    """Fills {name}, {range}, {ref}, {valid} where known; anything unknown stays as a blank to fill."""
    return re.sub(r"\{(name|range|ref|valid)\}", lambda m: ctx.get(m.group(1)) or "____", body)


# ---------- keyword watch ----------
def watch_hits(text: str, words: list[str]) -> list[str]:
    """Words found in the text. A word matches at the start of a word, so "cancel" also catches "cancelled".
    `(?<![^\\W_])` = not right after a letter or digit (same as JavaScript's `(?<![\\p{L}\\p{N}])`)."""
    t = (text or "").lower()
    return [w for w in words if re.search(r"(?<![^\W_])" + re.escape(w.lower()), t)]


def clean_words(words) -> list[str]:
    out: list[str] = []
    for raw in words or []:
        w = " ".join(str(raw).split())
        if 2 <= len(w) <= 40 and not any(x.lower() == w.lower() for x in out):
            out.append(w)
    return out[:50]


def keyword_watch(requests: list[dict], messages: list[dict], words: list[str], days: int, now: str) -> dict:
    """Everything customers wrote in the last `days` days that contains a watched word."""
    frm = add_ms(now, -days * 24 * HOUR)
    items: list[dict] = []

    def add(at, text, client, where, ref, request_id, message_id):
        if at < frm or not text:
            return
        hits = watch_hits(text, words)
        if hits:
            items.append({"at": at, "text": text, "client": client, "where": where, "ref": ref, "request_id": request_id,
                          "message_id": message_id, "hits": hits, "mood": mood_of(text)["mood"]})

    for m in messages:
        add(m["at"], m["text"], m["client"], CHANNEL_LABEL[m["channel"]], None, m["request_id"], m["id"])
    for r in requests:
        add(r["created_at"], r["raw_text"], r["customer"]["name"], "Trip request", r["ref"], r["id"], None)
        for e in r["events"]:
            if e["action"] in ("customer_question", "customer_changes"):
                add(e["at"], e["note"], r["customer"]["name"], "Question on the offer" if e["action"] == "customer_question" else "Change request",
                    r["ref"], r["id"], None)
        fb = r.get("feedback")
        if fb and fb.get("text"):
            add(fb["at"], fb["text"], r["customer"]["name"], "After-trip review", r["ref"], r["id"], None)
    items.sort(key=lambda i: i["at"], reverse=True)
    return {"words": words, "days": days, "total": len(items), "counts": [{"word": w, "count": sum(1 for i in items if w in i["hits"])} for w in words],
            "items": items}


# ---------- client history ----------
def client_history(key: str, requests: list[dict], messages: list[dict], cases: list[dict], now: str) -> dict:
    reqs = [r for r in requests if key in request_keys(r)]
    keys = {key, *[k for r in reqs for k in request_keys(r)]}
    msgs = [m for m in messages if m["client_key"] in keys]
    req_ids = {r["id"] for r in reqs}
    cs = [c for c in cases if c["client_key"] in keys or (c["request_id"] and c["request_id"] in req_ids)]
    name = reqs[0]["customer"]["name"] if reqs else msgs[0]["client"] if msgs else cs[0]["client"] if cs else "Unknown client"
    timeline: list[dict] = []
    for m in msgs:
        timeline.append({"at": m["at"], "kind": CHANNEL_LABEL[m["channel"]], "text": m["text"], "ref": None, "request_id": m["request_id"], "mood": mood_of(m["text"])["mood"]})
    for r in reqs:
        d = dest_by_code(r["input"].get("destination"))
        price = ((r.get("offer") or {}).get("totals") or {}).get("price", 0) if r.get("offer") else 0
        timeline.append({"at": r["created_at"], "kind": "Trip request", "text": r["raw_text"] or f"{d['name'] if d else 'Trip'}, {r['input']['days']} days",
                         "ref": r["ref"], "request_id": r["id"], "mood": mood_of(r["raw_text"])["mood"]})
        for e in r["events"]:
            if e["action"] in ("customer_question", "customer_changes"):
                timeline.append({"at": e["at"], "kind": "Question" if e["action"] == "customer_question" else "Change request", "text": e["note"],
                                 "ref": r["ref"], "request_id": r["id"], "mood": mood_of(e["note"])["mood"]})
            if e["action"] == "approve":
                timeline.append({"at": e["at"], "kind": "Quotation sent", "text": f"{peso(price)} offer approved", "ref": r["ref"], "request_id": r["id"], "mood": None})
            if e["action"] == "mark_booked":
                timeline.append({"at": e["at"], "kind": "Booked", "text": f"{d['name'] if d else 'Trip'} booked", "ref": r["ref"], "request_id": r["id"], "mood": None})
            if e["action"] == "mark_lost":
                timeline.append({"at": e["at"], "kind": "Lost", "text": e["note"], "ref": r["ref"], "request_id": r["id"], "mood": None})
        fb = r.get("feedback")
        if fb:
            timeline.append({"at": fb["at"], "kind": f"Rated {fb['rating']} of 5", "text": fb["text"], "ref": r["ref"], "request_id": r["id"],
                             "mood": mood_of(fb["text"] or f"{fb['rating']} of 5 stars", fb["rating"])["mood"]})
    for c in cs:
        timeline.append({"at": c["opened_at"], "kind": f"Case: {c['situation_label']}", "text": c["text"], "ref": c["request_ref"], "request_id": c["request_id"], "mood": None})
    timeline.sort(key=lambda t: t["at"], reverse=True)
    moods = [t for t in timeline if t["mood"]]
    pos = sum(1 for t in moods if t["mood"] == "positive")
    neg = sum(1 for t in moods if t["mood"] == "negative")
    open_cases = sum(1 for c in cs if not c["resolved_at"])
    booked = [r for r in reqs if r["status"] == "booked"]
    ratings = [r["feedback"]["rating"] for r in reqs if r.get("feedback")]
    if open_cases:
        verdict = f"{open_cases} open case{'s' if open_cases > 1 else ''}: reply to this traveller first."
    elif neg > pos:
        verdict = "Mostly unhappy so far. Handle with extra care."
    elif len(booked) >= 2:
        verdict = f"A loyal traveller: {len(booked)} trips booked. Say thank you."
    elif len(moods) <= 1:
        verdict = "New traveller."
    elif pos >= 2 * max(1, neg):
        verdict = "A happy traveller."
    else:
        verdict = "Mixed feelings so far."

    def dest_name(r):
        d = dest_by_code(r["input"].get("destination"))
        return d["name"] if d else (r["input"].get("place_text") or "Trip")

    return {
        "key": key, "name": name, "contact": reqs[0]["customer"]["contact"] if reqs else None, "verdict": verdict,
        "requests": [{"id": r["id"], "ref": r["ref"], "status": r["status"], "status_label": STATUSES[r["status"]]["staff"], "created_at": r["created_at"],
                      "destination": dest_name(r), "days": r["input"]["days"], "price": r["offer"]["totals"]["price"] if r.get("offer") else None} for r in reqs],
        "booked": len(booked), "spent": sum(r["offer"]["totals"]["price"] if r.get("offer") else 0 for r in booked),
        "rating": _r1(_avg(ratings)) if ratings else None, "moods": {"positive": pos, "neutral": len(moods) - pos - neg, "negative": neg},
        "cases": [case_view(c, now) for c in cs], "messages": len(msgs), "timeline": timeline[:80],
    }


# ---------- team report ----------
def team_report(requests: list[dict], messages: list[dict], cases: list[dict], months: int, now: str) -> dict:
    frm = add_ms(now, -months * 30 * 24 * HOUR)
    rows: list[dict] = []
    for m in messages:
        if m["handled_by"] and not m["is_imported"] and m["at"] >= frm:
            rows.append({"name": m["handled_by"]["name"], "month": m["at"][:7], "kind": CHANNEL_LABEL[m["channel"]], "ref": m["id"],
                         "first_reply_minutes": js_round(_mins(m["at"], m["first_reply_at"])) if m["first_reply_at"] else None,
                         "resolution_minutes": None, "status": "replied"})
    for r in requests:
        if not r.get("assignee") or r["created_at"] < frm:
            continue
        first = next((e for e in r["events"] if e["role"] in ("SALES", "AGENT", "ADMIN")), None)
        rows.append({"name": r["assignee"]["name"], "month": r["created_at"][:7], "kind": "Quotation request", "ref": r["ref"],
                     "first_reply_minutes": js_round(_mins(r["created_at"], first["at"])) if first else None, "resolution_minutes": None,
                     "status": "replied" if first else "waiting"})
    for c in cases:
        if not c["owner"] or c["opened_at"] < frm:
            continue
        rows.append({"name": c["owner"]["name"], "month": c["opened_at"][:7], "kind": f"Case: {c['situation_label']}", "ref": c["request_ref"] or c["id"],
                     "first_reply_minutes": js_round(_mins(c["opened_at"], c["first_reply_at"])) if c["first_reply_at"] else None,
                     "resolution_minutes": js_round(_mins(c["opened_at"], c["resolved_at"])) if c["resolved_at"] else None,
                     "status": "solved" if c["resolved_at"] else "replied" if c["first_reply_at"] else "waiting"})
    rows.sort(key=lambda x: x["name"])
    rows.sort(key=lambda x: x["month"], reverse=True)

    def stat(rs):
        fr = [x["first_reply_minutes"] for x in rs if x["first_reply_minutes"] is not None]
        rs2 = [x["resolution_minutes"] for x in rs if x["resolution_minutes"] is not None]
        solved_cases = [c for c in cases if c["resolved_at"] and c["opened_at"] >= frm and c["owner"]
                        and any(x["ref"] == (c["request_ref"] or c["id"]) and x["name"] == c["owner"]["name"] for x in rs)]
        return {"handled": len(rs), "replied": sum(1 for x in rs if x["status"] != "waiting"), "solved": sum(1 for x in rs if x["status"] == "solved"),
                "avg_first_reply_minutes": js_round(_avg(fr)) if fr else None, "avg_resolution_minutes": js_round(_avg(rs2)) if rs2 else None,
                "cases_on_time_pct": _r1((sum(1 for c in solved_cases if c["resolved_at"] <= c["due_at"]) / len(solved_cases)) * 100) if solved_cases else None}

    names = sorted({r["name"] for r in rows})
    months_list = sorted({r["month"] for r in rows}, reverse=True)
    staff = [{"name": n, **stat([r for r in rows if r["name"] == n])} for n in names]
    staff.sort(key=lambda x: x["name"])
    staff.sort(key=lambda x: x["handled"], reverse=True)
    by_month = []
    for mo in months_list:
        for n in names:
            x = {"month": mo, "name": n, **stat([r for r in rows if r["month"] == mo and r["name"] == n])}
            if x["handled"]:
                by_month.append(x)
    return {"period": {"from": frm, "to": now}, "months": months_list, "team": names, "totals": stat(rows), "staff": staff, "by_month": by_month, "rows": rows}


def _csv_esc(x) -> str:
    s = "" if x is None else str(x)
    return '"' + s.replace('"', '""') + '"' if re.search(r'[",\n]', s) else s


def team_report_csv(rows: list[dict]) -> str:
    head = ["Staff", "Month", "Type", "Reference", "First reply (minutes)", "Solved in (minutes)", "Status"]
    body = [[r["name"], r["month"], r["kind"], r["ref"], r["first_reply_minutes"], r["resolution_minutes"], r["status"]] for r in rows]
    return "\r\n".join(",".join(_csv_esc(c) for c in row) for row in [head] + body)


# ---------- weekly report (emailed Monday 8 AM Philippine time) ----------
def weekly_report(requests: list[dict], messages: list[dict], cases: list[dict], s: dict, now: str) -> dict:
    to, frm, prev_from = now, add_ms(now, -7 * 24 * HOUR), add_ms(now, -14 * 24 * HOUR)

    def in_w(at, a=None, b=None):
        a, b = a or frm, b or to
        return a <= at < b

    def texts(a, b):
        out = [m["text"] for m in messages if in_w(m["at"], a, b)]
        for r in requests:
            if in_w(r["created_at"], a, b):
                out.append(r["raw_text"])
            out += [e["note"] for e in r["events"] if e["action"] in ("customer_question", "customer_changes") and in_w(e["at"], a, b)]
            fb = r.get("feedback")
            if fb and in_w(fb["at"], a, b):
                out.append(fb["text"] or f"{fb['rating']} of 5 stars")
        return [x for x in out if x]

    cur, prev = texts(frm, to), texts(prev_from, frm)
    moods = [mood_of(t) for t in cur]
    prev_moods = [mood_of(t) for t in prev]

    def pct(n, d):
        return js_round((n / d) * 100) if d else 0

    neg = pct(sum(1 for m in moods if m["mood"] == "negative"), len(moods))
    pos = pct(sum(1 for m in moods if m["mood"] == "positive"), len(moods))
    prev_neg = pct(sum(1 for m in prev_moods if m["mood"] == "negative"), len(prev_moods))

    def theme_count(pred):
        c: dict = {}
        for m in moods:
            if pred(m) and m["theme"] != "General":
                c[m["theme"]] = c.get(m["theme"], 0) + 1
        rows = [{"topic": THEME_LABEL.get(k, k), "count": n} for k, n in c.items()]
        rows.sort(key=lambda x: x["topic"])
        rows.sort(key=lambda x: x["count"], reverse=True)
        return rows[:3]

    booked = [r for r in requests if r["status"] == "booked" and any(e["action"] == "mark_booked" and in_w(e["at"]) for e in r["events"])]
    cs = clock_stats(cases, now, frm)
    waiting = sum(1 for r in requests if (request_clock(r, now, s) or {}).get("stage") == "overdue")
    watch = [c for c in keyword_watch(requests, messages, s["watch_words"], 7, now)["counts"] if c["count"]]
    team = [{"name": x["name"], "handled": x["handled"], "avg_first_reply_minutes": x["avg_first_reply_minutes"]}
            for x in team_report(requests, messages, cases, 1, now)["staff"][:5]]
    complaints = theme_count(lambda m: m["mood"] == "negative")
    actions = []
    if cs["by_stage"]["overdue"]:
        n = cs["by_stage"]["overdue"]
        actions.append(f"Close the {n} overdue case{'s' if n > 1 else ''} first.")
    if waiting:
        actions.append(f"Reply to the {waiting} quotation request{'s' if waiting > 1 else ''} waiting over {s['request_reply_hours']} hours.")
    if complaints:
        actions.append(f"Look into {complaints[0]['topic'].lower()}: the top complaint this week.")
    if not actions:
        actions.append("Keep it up: nothing urgent this week.")
    if not cur:
        verdict = "A quiet week: no new customer messages."
    elif neg > prev_neg + 5:
        verdict = f"More unhappy customers than last week ({neg}% vs {prev_neg}%)."
    elif neg + 5 < prev_neg:
        verdict = f"Fewer unhappy customers than last week ({neg}% vs {prev_neg}%)."
    else:
        verdict = f"A steady week: {pos}% happy, {neg}% unhappy messages."
    listed = [x.strip() for x in re.split(r"[,;]", s.get("weekly_recipients") or "") if x.strip()]
    return {
        "subject": f"PAPH weekly report: {frm[:10]} to {to[:10]}", "period": {"from": frm, "to": to}, "verdict": verdict,
        "kpis": {"messages": len(cur), "positive_pct": pos, "negative_pct": neg, "prev_negative_pct": prev_neg,
                 "requests": sum(1 for r in requests if in_w(r["created_at"])), "booked": len(booked),
                 "booked_revenue": sum(r["offer"]["totals"]["price"] if r.get("offer") else 0 for r in booked)},
        "clock": {"open": cs["open"], "overdue": cs["by_stage"]["overdue"], "red": cs["by_stage"]["red"], "solved": cs["solved"],
                  "on_time_pct": cs["on_time_pct"], "requests_overdue": waiting},
        "top_complaints": complaints, "most_appreciated": theme_count(lambda m: m["mood"] == "positive"), "watch": watch, "team": team, "actions": actions,
        "enabled": s["weekly_enabled"], "recipients": listed, "schedule": "Every Monday, 8:00 AM Philippine time",
    }


def weekly_text(rep: dict) -> str:
    """Plain-text email body."""
    k, c = rep["kpis"], rep["clock"]
    lines = [rep["subject"], "", rep["verdict"], "",
             f"Customer messages: {k['messages']} ({k['positive_pct']}% happy, {k['negative_pct']}% unhappy; last week {k['prev_negative_pct']}% unhappy)",
             f"New quotation requests: {k['requests']}; booked: {k['booked']} ({peso(k['booked_revenue'])})",
             f"Response Clock: {c['open']} open cases, {c['red']} red, {c['overdue']} overdue; {c['solved']} solved"
             + (f" ({c['on_time_pct']}% on time)" if c["on_time_pct"] is not None else "") + f"; {c['requests_overdue']} requests overdue", ""]
    if rep["top_complaints"]:
        lines.append("Top complaints: " + ", ".join(f"{x['topic']} ({x['count']})" for x in rep["top_complaints"]))
    if rep["most_appreciated"]:
        lines.append("Most appreciated: " + ", ".join(f"{x['topic']} ({x['count']})" for x in rep["most_appreciated"]))
    if rep["watch"]:
        lines.append("Watched words: " + ", ".join(f"{x['word']} ({x['count']})" for x in rep["watch"]))
    lines += ["", "What to do:"] + [f"- {a}" for a in rep["actions"]]
    return "\n".join(lines)


# ---------- import past messages ----------
MAX_IMPORT_ROWS = 5000


def _utc(y: int, mon0: int, d: int, h: int = 0, mi: int = 0) -> str:
    """Like JS Date.UTC(...).toISOString(): out-of-range months, days and hours roll over."""
    y += mon0 // 12
    mon0 %= 12
    dt = datetime(y, mon0 + 1, 1, tzinfo=timezone.utc) + timedelta(days=d - 1, hours=h, minutes=mi)
    return iso_ms(math.trunc((dt - EPOCH).total_seconds() * 1000))


def parse_date(value) -> str | None:
    v = str(value if value is not None else "").strip()
    if not v:
        return None
    try:
        if re.fullmatch(r"\d{4,5}(\.\d+)?", v):
            n = float(v)
            if 20000 < n < 80000:
                return iso_ms(ms("1899-12-30T00:00:00.000Z") + n * 86400000)
        m = re.match(r"(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?", v)
        if m:
            return _utc(int(m[1]), int(m[2]) - 1, int(m[3]), int(m[4]) - 8 if m[4] else 0, int(m[5]) if m[5] else 0)
        m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?", v)
        if m:
            y = 2000 + int(m[3]) if int(m[3]) < 100 else int(m[3])
            return _utc(y, int(m[1]) - 1, int(m[2]), int(m[4]) - 8 if m[4] else 0, int(m[5]) if m[5] else 0)
    except (ValueError, OverflowError):
        return None
    return None


def channel_code(value) -> str:
    v = str(value if value is not None else "").lower()
    if any(x in v for x in ("messenger", "chat", "pm", "inbox")):
        return "messenger"
    if any(x in v for x in ("facebook", "fb", "comment", "post")):
        return "facebook_page"
    return "import"


def import_rows(existing: list[dict], rows: list[dict], now: str, id_for) -> dict:
    """Imported rows become already-handled history: counted in sentiment and reports, never open a case or a clock.
    Returns {"added": [messages], "result": {...}}."""
    seen = {f"{m['client_key']}|{m['at'][:10]}|{m['text']}" for m in existing}
    added, skipped = [], []
    duplicates = 0
    for i, r in enumerate(rows[:MAX_IMPORT_ROWS]):
        r = r if isinstance(r, dict) else {}
        text = str(r.get("message") if r.get("message") is not None else "").strip()
        at = parse_date(r.get("date"))
        if not text:
            skipped.append({"row": i + 2, "reason": "No message"})
            continue
        if not at:
            skipped.append({"row": i + 2, "reason": "Date not understood"})
            continue
        if at > now:
            skipped.append({"row": i + 2, "reason": "Date is in the future"})
            continue
        client = str(r.get("client") if r.get("client") is not None else "").strip()[:120] or "Unknown client"
        m = receive_message(id=id_for(i), channel=channel_code(r.get("channel")), client=client, text=text, at=at, is_imported=True,
                            case_id="", s={"request_reply_hours": 24})["message"]
        k = f"{m['client_key']}|{m['at'][:10]}|{m['text']}"
        if k in seen:
            duplicates += 1
            continue
        seen.add(k)
        added.append(m)
    if len(rows) > MAX_IMPORT_ROWS:
        skipped.append({"row": MAX_IMPORT_ROWS + 2, "reason": f"Only the first {MAX_IMPORT_ROWS} rows are imported"})
    by_channel: dict = {}
    for m in added:
        by_channel[m["channel"]] = by_channel.get(m["channel"], 0) + 1
    return {"added": added, "result": {"total": len(rows), "imported": len(added), "duplicates": duplicates, "skipped": skipped[:50],
                                       "skipped_count": len(skipped), "by_channel": by_channel}}


# ---------- sample messages and live cases (preview only) ----------
def _case_id(n: int) -> str:
    return f"CASE-{n:04d}"


def generate_messages(now: str, people: list[dict], customers: list[str], s: dict, first_case: int) -> dict:
    """~6 months of SAMPLE Facebook/Messenger messages, replied and handled; unhappy ones opened (and closed) cases."""
    r = rng(SM["seed"])

    def pick(xs):
        return xs[math.floor(r() * len(xs))]

    end = ms(now)
    messages, cases = [], []
    count, days = SM["count"], SM["days"]
    for i in range(count):
        age = 2 + (days - 2) * math.pow(1 - i / count, 1.3)
        at = iso_ms(end - age * 24 * HOUR - math.floor(r() * 12) * HOUR)
        channel = "facebook_page" if r() < 0.6 else "messenger"
        text = pick(SM["facebook_page"] if channel == "facebook_page" else SM["messenger"])
        text = text.replace("{svc}", pick(SM["services"]), 1)
        text = text.replace("{staff}", pick(SM["staff"]), 1)
        text = text.replace("{branch}", pick(SM["branches"]), 1)
        who = pick(people)
        client = pick(customers)
        got = receive_message(id=f"msg-{i + 1}", channel=channel, client=client, text=text, at=at, is_sample=True,
                              case_id=_case_id(first_case + len(cases)), s=s, owner={"id": who["id"], "name": who["name"]})
        a = r()
        b = 180 if r() < 0.8 else 1800
        reply_min = 10 + math.floor(a * b)
        m = mark_replied(got["message"], who, add_ms(at, reply_min * 60000))
        if got["case"]:
            c = case_act(got["case"], "reply", who, {"note": "Called the traveller."}, add_ms(at, reply_min * 60000), s)
            solve_h = 2 + r() * 30 if c["priority"] == "urgent" else 4 + r() * 60
            c = case_act(c, "step", who, {"index": 0}, add_ms(at, (reply_min + 30) * 60000), s)
            c = case_act(c, "solve", who, {"note": "Solved and confirmed with the traveller."}, add_ms(at, solve_h * HOUR), s)
            cases.append(c)
            m = {**m, "case_id": c["id"]}
        messages.append(m)
    return {"messages": messages, "cases": cases}


def sample_live_cases(now: str, people: dict, s: dict, first_case: int, first_msg: int) -> dict:
    """The live sample cases from playbooks.json (one at every colour), opened `hours_ago` before now."""
    messages, cases = [], []
    for i, x in enumerate(PB["sample_cases"]):
        at = add_ms(now, -x["hours_ago"] * HOUR)
        owner = people[x["owner"]] if x.get("owner") else None
        own = {"id": owner["id"], "name": owner["name"]} if owner else None
        got = receive_message(id=f"msg-{first_msg + i}", channel=x["channel"], client=x["client"], text=x["text"], at=at, is_sample=True,
                              case_id=_case_id(first_case + i), s=s, owner=own)
        c = got["case"] or open_case(id=_case_id(first_case + i), now=at, source="message", text=x["text"], client=x["client"],
                                     client_key=got["message"]["client_key"], by="PAPH AI", message_id=got["message"]["id"], owner=own, is_sample=True, s=s)
        m = {**got["message"], "case_id": c["id"]}
        if owner and x.get("reply_after_min") is not None:
            t = add_ms(at, x["reply_after_min"] * 60000)
            c = case_act(c, "reply", owner, {"note": "Called the traveller."}, t, s)
            m = mark_replied(m, owner, t)
            for k in range(x["steps_done"]):
                c = case_act(c, "step", owner, {"index": k}, add_ms(t, (k + 1) * 600000), s)
        messages.append(m)
        cases.append(c)
    return {"messages": messages, "cases": cases}
