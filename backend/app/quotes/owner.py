"""Owner-only dashboards: briefing, customer sentiment, team performance, revenue and margin.

Port twin of frontend/src/quote/owner.ts. Sentiment comes from the free rule engine (app/sentiment/rule_engine.py).
JavaScript's Array.sort is stable; every sort here keeps the same tie-breakers (and Python's sort is stable too).
"""
from __future__ import annotations

import math
import re
from datetime import datetime, timedelta, timezone

from app.quotes.engine import dest_by_code, peso
from app.quotes.workflow import LOST_REASONS, STATUSES, hours_waiting, parse_iso
from app.sentiment.rule_engine import analyze

THEME_LABEL = {
    "Response Time": "Slow replies", "Waiting Time & Delays": "Delays and waiting", "Tour Guides & Staff": "Staff and guides", "Tours & Itinerary": "Tours and itinerary",
    "Pricing & Promos": "Price", "Hotels & Accommodation": "Hotels", "Booking & Reservations": "Booking", "Flights & Transfers": "Flights and transfers",
    "Visa & Travel Documents": "Visa and documents", "Safety & Health": "Safety and health", "Payment & Refunds": "Payments and refunds", "Destinations": "The destination",
    "Online Experience": "Website and messages", "General": "General",
}
KIND_LABEL = {"request": "Trip request", "question": "Question on the offer", "changes": "Asked for changes", "feedback": "After-trip review"}
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
DAY = 86400000
EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)
RANGES = ("30", "90", "year", "all")
_cache: dict[str, dict] = {}


def js_round(x: float) -> int:
    return int(math.floor(x + 0.5))


def round1(x: float) -> float:
    return math.floor(x * 10 + 0.5) / 10


def pct(a: float, b: float):
    return round1((a / b) * 100) if b else None


def avg(xs: list[float]):
    return sum(xs) / len(xs) if xs else None


def ms(iso: str) -> int:
    return round((parse_iso(iso) - EPOCH).total_seconds() * 1000)


def iso_of_ms(t: int) -> str:
    dt = EPOCH + timedelta(milliseconds=t)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


def mood_of(text: str, rating=None) -> dict:
    """Sentiment of one piece of customer writing (cached; the engine is deterministic)."""
    key = f"{'' if rating is None else rating}|{text}"
    v = _cache.get(key)
    if not v:
        a = analyze(text, rating)
        v = {"mood": a.label, "score": a.score, "theme": a.primary_topic}
        _cache[key] = v
    return v


def range_start(rng: str, now: str):
    if rng == "all":
        return None
    if rng == "year":
        return f"{now[:4]}-01-01T00:00:00.000Z"
    return iso_of_ms(ms(now) - int(rng) * DAY)


def booked_at(r: dict):
    return next((e["at"] for e in reversed(r["events"]) if e["action"] == "mark_booked"), None)


def has(r: dict, action: str) -> bool:
    return any(e["action"] == action for e in r["events"])


def voices_of(r: dict) -> list[dict]:
    """Everything a customer wrote, each with its sentiment."""
    d = dest_by_code(r["input"].get("destination"))
    base = {"request_id": r["id"], "ref": r["ref"], "customer": r["customer"]["name"], "destination": d["code"] if d else "other",
            "destination_name": d["name"] if d else (r["input"].get("place_text") or "Other places"),
            "salesperson": (r.get("assignee") or {}).get("name") or "Unassigned", "status": r["status"], "is_sample": r["is_sample"]}
    out: list[dict] = []

    def push(kind, at, text, rating=None, read_as=None):
        if not text.strip():
            return
        m = mood_of(text if read_as is None else read_as, rating)
        out.append({**base, "kind": kind, "kind_label": KIND_LABEL[kind], "at": at, "text": text, "rating": rating, "mood": m["mood"],
                    "score": m["score"], "theme": m["theme"], "theme_label": THEME_LABEL.get(m["theme"], m["theme"])})

    if r.get("raw_text"):
        # "budget friendly" describes the hotel level, not a happy customer: read it as plain "budget"
        push("request", r["created_at"], r["raw_text"], None, re.sub(r"budget[\s-]?friendly", "budget", r["raw_text"], flags=re.IGNORECASE))
    for e in r["events"]:
        if e["action"] == "customer_question":
            push("question", e["at"], e["note"])
        if e["action"] == "customer_changes":
            push("changes", e["at"], e["note"])
    fb = r.get("feedback")
    if fb:
        push("feedback", fb["at"], fb["text"] or f"{fb['rating']} of 5 stars", fb["rating"])
    return out


def _slice(key: str, label: str, vs: list[dict]) -> dict:
    def c(m):
        return sum(1 for v in vs if v["mood"] == m)
    a = avg([v["score"] for v in vs])
    return {"key": key, "label": label, "count": len(vs), "positive": c("positive"), "neutral": c("neutral"), "negative": c("negative"),
            "score": js_round(a if a is not None else 0)}


def _group(xs: list, key) -> dict:
    m: dict = {}
    for x in xs:
        m.setdefault(key(x), []).append(x)
    return m


def _monday_of(iso: str) -> str:
    d = datetime.fromisoformat(iso[:10])
    return (d - timedelta(days=d.weekday())).date().isoformat()


def _month_label(ym: str) -> str:
    return f"{MONTHS[int(ym[5:7]) - 1]} {ym[:4]}"


def _sort(xs: list, *keys):
    """Stable multi-key sort: keys are (func, descending) from most to least important."""
    out = list(xs)
    for fn, desc in reversed(keys):
        out.sort(key=fn, reverse=desc)
    return out


def owner_report(all_reqs: list[dict], f: dict, now: str) -> dict:
    frm = range_start(f["range"], now)
    scoped = [r for r in all_reqs if (not f["destination"] or (r["input"].get("destination") or "other") == f["destination"])
              and (not f["salesperson"] or (r.get("assignee") or {}).get("id") == f["salesperson"])]
    reqs = [r for r in scoped if not frm or r["created_at"] >= frm]
    voices = [v for r in scoped for v in voices_of(r) if not frm or v["at"] >= frm]
    voices = sorted(voices, key=lambda v: v["at"], reverse=True)

    # ---- sentiment
    total = len(voices)
    positive = sum(1 for v in voices if v["mood"] == "positive")
    negative = sum(1 for v in voices if v["mood"] == "negative")
    weekly = f["range"] == "30"
    groups = _group(voices, lambda v: _monday_of(v["at"]) if weekly else v["at"][:7])
    trend = []
    for k in sorted(groups):
        label = f"Week of {MONTHS[int(k[5:7]) - 1]} {int(k[8:10])}" if weekly else _month_label(k)
        trend.append({**_slice(k, label, groups[k]), "period": k})

    def slices(key, label):
        g = _group(voices, key)
        rows = [_slice(k, label(vs[0]), vs) for k, vs in g.items()]
        return _sort(rows, (lambda s: s["count"], True), (lambda s: s["label"], False))

    theme_voices = [v for v in voices if v["kind"] != "request"]  # trip requests do not feed the themes
    themes = []
    for k, vs in _group([v for v in theme_voices if v["theme"] != "General"], lambda v: v["theme"]).items():
        examples = _sort(vs, (lambda v: 0 if v["mood"] == "negative" else 1, False), (lambda v: v["at"], True))[:3]
        themes.append({"theme": k, "label": THEME_LABEL.get(k, k), "count": len(vs), "positive": sum(1 for v in vs if v["mood"] == "positive"),
                       "negative": sum(1 for v in vs if v["mood"] == "negative"),
                       "requests": len({v["request_id"] for v in vs if v["mood"] == "negative"}), "examples": examples})
    themes = _sort(themes, (lambda t: t["negative"], True), (lambda t: t["count"], True), (lambda t: t["label"], False))
    rated = [v for v in voices if v["kind"] == "feedback" and v["rating"]]
    stars = [sum(1 for v in rated if v["rating"] == n) for n in (1, 2, 3, 4, 5)]

    # ---- team
    team = []
    for pid, rs in _group([r for r in reqs if r.get("assignee")], lambda r: r["assignee"]["id"]).items():
        resp = []
        for r in rs:
            e = next((x for x in r["events"] if x["role"] in ("SALES", "ADMIN", "AGENT")), None)
            if e:
                resp.append((ms(e["at"]) - ms(r["created_at"])) / 3600000)
        decided = [r for r in rs if has(r, "approve") or has(r, "request_changes") or has(r, "decline")]
        approved = [r for r in rs if has(r, "approve")]
        booked_rs = [r for r in rs if r["status"] == "booked"]
        ids = {r["id"] for r in rs}
        vs = [v for v in voices if v["request_id"] in ids]
        margins = [r["offer"]["totals"]["margin_pct"] for r in approved if r.get("offer")]
        team.append({
            "id": pid, "name": rs[0]["assignee"]["name"], "handled": len(rs), "avg_response_hours": round1(avg(resp)) if resp else None,
            "offers_sent": sum(1 for r in rs if has(r, "submit")), "approval_rate": pct(len(approved), len(decided)),
            "booking_rate": pct(len(booked_rs), len(approved)), "revenue": sum((r.get("offer") or {}).get("totals", {}).get("price", 0) for r in booked_rs),
            "avg_margin_pct": round1(avg(margins)) if margins else None,
            "sentiment_score": js_round(avg([v["score"] for v in vs])) if vs else None, "voices": len(vs),
        })
    team = _sort(team, (lambda t: t["revenue"], True), (lambda t: t["handled"], True))

    # ---- revenue (booked trips count in the month they were booked)
    booked_reqs = [r for r in scoped if r["status"] == "booked" and r.get("offer") and (not frm or (booked_at(r) or "") >= frm)]
    booked = sum(r["offer"]["totals"]["price"] for r in booked_reqs)
    margin = sum(r["offer"]["totals"]["margin"] for r in booked_reqs)
    pipeline_reqs = [r for r in reqs if r["status"] in ("approved", "sent", "accepted", "pending_approval") and r.get("offer")]
    bm = _group(booked_reqs, lambda r: booked_at(r)[:7])
    by_month = [{"period": k, "label": _month_label(k), "revenue": sum(r["offer"]["totals"]["price"] for r in bm[k]),
                 "margin": sum(r["offer"]["totals"]["margin"] for r in bm[k]), "bookings": len(bm[k])} for k in sorted(bm)]
    by_destination = []
    for k, rs in _group(booked_reqs, lambda r: r["input"].get("destination") or "other").items():
        d = dest_by_code(k)
        by_destination.append({"key": k, "label": d["name"] if d else "Other places", "revenue": sum(r["offer"]["totals"]["price"] for r in rs),
                               "margin": sum(r["offer"]["totals"]["margin"] for r in rs), "bookings": len(rs)})
    by_destination = _sort(by_destination, (lambda x: x["revenue"], True), (lambda x: x["label"], False))
    funnel = [
        {"step": "requests", "label": "Requests received", "count": len(reqs)},
        {"step": "drafted", "label": "Offer prepared", "count": sum(1 for r in reqs if has(r, "start_offer"))},
        {"step": "submitted", "label": "Sent for approval", "count": sum(1 for r in reqs if has(r, "submit"))},
        {"step": "approved", "label": "Approved and quoted", "count": sum(1 for r in reqs if has(r, "approve"))},
        {"step": "accepted", "label": "Customer accepted", "count": sum(1 for r in reqs if has(r, "customer_accept"))},
        {"step": "booked", "label": "Booked", "count": sum(1 for r in reqs if r["status"] == "booked")},
    ]
    lost = _group([r for r in reqs if r["status"] == "lost" and r.get("lost_reason")], lambda r: r["lost_reason"])
    lost_reasons = _sort([{"reason": k, "label": LOST_REASONS.get(k, k), "count": len(rs)} for k, rs in lost.items()],
                         (lambda x: x["count"], True), (lambda x: x["label"], False))

    dests: dict = {}
    for r in all_reqs:
        d = dest_by_code(r["input"].get("destination"))
        dests[r["input"].get("destination") or "other"] = d["name"] if d else "Other places"
    people: dict = {}
    for r in all_reqs:
        if r.get("assignee"):
            people[r["assignee"]["id"]] = r["assignee"]["name"]

    a_all = avg([v["score"] for v in voices])
    report = {
        "filters": f, "period": {"from": frm, "to": now}, "sample_count": sum(1 for r in reqs if r["is_sample"]), "requests": len(reqs),
        "briefing": {"verdict": "", "bullets": []},
        "sentiment": {
            "total": total, "positive": positive, "neutral": total - positive - negative, "negative": negative,
            "positive_pct": pct(positive, total) or 0, "negative_pct": pct(negative, total) or 0,
            "avg_score": js_round(a_all if a_all is not None else 0), "trend": trend,
            "by_destination": slices(lambda v: v["destination"], lambda v: v["destination_name"]),
            "by_salesperson": slices(lambda v: v["salesperson"], lambda v: v["salesperson"]),
            "by_stage": slices(lambda v: v["status"], lambda v: STATUSES[v["status"]]["staff"]), "themes": themes,
            "attention": [v for v in voices if v["mood"] == "negative"][:12],
            "ratings": {"avg": round1(avg([v["rating"] for v in rated])) if rated else None, "count": len(rated), "stars": stars},
        },
        "team": team,
        "revenue": {
            "booked": booked, "bookings": len(booked_reqs), "margin": margin, "margin_pct": pct(margin, booked),
            "pipeline": sum(r["offer"]["totals"]["price"] for r in pipeline_reqs), "pipeline_count": len(pipeline_reqs),
            "avg_booking": int(math.floor(booked / len(booked_reqs) / 100 + 0.5)) * 100 if booked_reqs else None,
            "quote_to_book_pct": pct(funnel[5]["count"], funnel[3]["count"]),
            "by_month": by_month, "by_destination": by_destination, "funnel": funnel, "lost_reasons": lost_reasons,
        },
        "voices": voices,
        "options": {
            "destinations": sorted([{"code": c, "name": n} for c, n in dests.items()], key=lambda x: x["name"]),
            "salespeople": sorted([{"id": i, "name": n} for i, n in people.items()], key=lambda x: x["name"]),
        },
    }
    report["briefing"] = _briefing(scoped, report, now)
    return report


def _briefing(scoped: list[dict], rep: dict, now: str) -> dict:
    """One plain verdict and up to four bullets. Booking change compares the last 30 days with the 30 days before."""
    t = ms(now)

    def in_win(r, a, b):
        at = booked_at(r)
        return bool(at) and r["status"] == "booked" and ms(at) > t - a * DAY and ms(at) <= t - b * DAY

    cur = [r for r in scoped if in_win(r, 30, 0)]
    prev = [r for r in scoped if in_win(r, 60, 30)]

    def total(rs):
        return sum((r.get("offer") or {}).get("totals", {}).get("price", 0) for r in rs)

    bullets: list[str] = []
    if prev and cur:
        ch = js_round(((total(cur) - total(prev)) / total(prev)) * 100)
        bullets.append(f"Bookings {'up' if ch >= 0 else 'down'} {abs(ch)}% in the last 30 days: {peso(total(cur))} from {len(cur)} trip{'s' if len(cur) > 1 else ''}.")
    else:
        bullets.append(f"{len(cur)} trip{'s' if len(cur) > 1 else ''} booked in the last 30 days ({peso(total(cur))})." if cur else "No trips booked in the last 30 days yet.")
    recent = [r for r in scoped if ms(r["created_at"]) > t - 90 * DAY]
    groups = _group(recent, lambda r: (dest_by_code(r["input"].get("destination")) or {}).get("name") or "Other places")
    top = _sort(list(groups.items()), (lambda kv: len(kv[1]), True), (lambda kv: kv[0], False))
    if top:
        bullets.append(f"{top[0][0]} and {top[1][0]} lead customer requests this quarter." if len(top) > 1 else f"{top[0][0]} leads customer requests this quarter.")
    worst = next((x for x in rep["sentiment"]["themes"] if x["negative"] > 0), None)
    if worst:
        bullets.append(f"Customers are unhappy about {worst['label'].lower()} on {worst['requests']} request{'s' if worst['requests'] > 1 else ''}.")
    waiting = sum(1 for r in scoped if hours_waiting(r, now) >= 24)
    pending = sum(1 for r in scoped if r["status"] == "pending_approval")
    if waiting or pending:
        parts = [f"{waiting} request{'s have' if waiting > 1 else ' has'} waited over 24 hours" if waiting else "",
                 f"{pending} offer{'s wait' if pending > 1 else ' waits'} for approval" if pending else ""]
        bullets.append("; ".join(p for p in parts if p) + ".")
    s = rep["sentiment"]
    about = f", mainly about {worst['label'].lower()}" if worst else ""
    if not s["total"]:
        verdict = "Not enough customer messages yet to read the mood."
    elif s["negative"] > s["positive"]:
        verdict = f"More customers are unhappy than happy right now{about}. Fix that first."
    elif s["positive"] >= 2 * s["negative"]:
        verdict = f"Customers are mostly happy: {s['positive']} happy messages and {s['negative']} unhappy{', mostly about ' + worst['label'].lower() if worst else ''}."
    else:
        verdict = f"Customer mood is mixed: {s['positive']} happy and {s['negative']} unhappy messages{about}."
    return {"verdict": verdict, "bullets": bullets[:4]}


def voices_csv(vs: list[dict]) -> str:
    """CSV of every customer message with its sentiment (opens in Excel)."""
    def esc(x) -> str:
        s = "" if x is None else str(x)
        return '"' + s.replace('"', '""') + '"' if re.search(r'[",\n]', s) else s

    head = ["Date", "Reference", "Customer", "Destination", "Salesperson", "Stage", "Type", "Message", "Mood", "Score", "Theme", "Stars", "Sample"]
    rows = [head] + [[v["at"][:10], v["ref"], v["customer"], v["destination_name"], v["salesperson"], STATUSES[v["status"]]["staff"], v["kind_label"],
                      v["text"], v["mood"], v["score"], v["theme_label"], "" if v["rating"] is None else v["rating"], "yes" if v["is_sample"] else ""] for v in vs]
    return "\r\n".join(",".join(esc(c) for c in row) for row in rows)
