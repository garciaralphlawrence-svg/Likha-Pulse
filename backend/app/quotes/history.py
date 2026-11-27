"""Builds ~6 months of SAMPLE past requests (closed: booked, lost or declined) by walking each one through the real
workflow, so the owner dashboards have realistic history. Deterministic for a given `now`.

Port twin of frontend/src/quote/history.ts: same seed, same random sequence (mulberry32 with 32-bit maths), same call order.
"""
from __future__ import annotations

import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.quotes.engine import parse_request
from app.quotes.workflow import apply, create_request, parse_iso

H: dict = json.loads((Path(__file__).with_name("sample_history.json")).read_text(encoding="utf-8"))
M32 = 0xFFFFFFFF
HOUR = 3600000
FEEDBACK_WEIGHTS = [3, 3, 3, 2, 2, 2, 1, 1, 1, 1, 1]
LOST_WEIGHTS = [("price", 40), ("dates", 20), ("other_agency", 15), ("no_response", 20), ("plans_changed", 5)]
EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)


def _imul(a: int, b: int) -> int:
    return (a * b) & M32


def rng(seed: int):
    """mulberry32, identical to the TypeScript version (all values kept as unsigned 32-bit)."""
    state = [seed & M32]

    def nxt() -> float:
        s = (state[0] + 0x6D2B79F5) & M32
        state[0] = s
        t = _imul(s ^ (s >> 15), 1 | s)
        t = ((t + _imul(t ^ (t >> 7), 61 | t)) & M32) ^ t
        return ((t ^ (t >> 14)) & M32) / 4294967296

    return nxt


def _ms(iso: str) -> int:
    return round((parse_iso(iso) - EPOCH).total_seconds() * 1000)


def _iso_ms(t: float) -> str:
    """Like JS new Date(t).toISOString(): fractional milliseconds are cut off (toward zero)."""
    ms = math.trunc(t)
    dt = EPOCH + timedelta(milliseconds=ms)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


def generate_history(now: str, people: dict, first_seq: int, settings: dict) -> list[dict]:
    """people = {"sales": [actor, actor], "agent": actor}; actors are {"id", "name", "role"}."""
    r = rng(H["seed"])

    def pick(xs):
        return xs[math.floor(r() * len(xs))]

    def pick_w(xs):
        x = r() * sum(w for _, w in xs)
        for v, w in xs:
            x -= w
            if x < 0:
                return v
        return xs[-1][0]

    end = _ms(now)
    out: list[dict] = []
    count, days = H["count"], H["days"]
    for i in range(count):
        age_days = 16 + (days - 16) * math.pow(1 - i / count, 1.5)
        state = {"t": end - age_days * 24 * HOUR - math.floor(r() * 10) * HOUR}

        def at() -> str:
            return _iso_ms(state["t"])

        text = pick(H["requests"])
        customer = pick(H["customers"])
        fast = r() < 0.58
        sales = people["sales"][0] if fast else people["sales"][1]
        agent = people["agent"]
        cur = {"req": create_request(id=f"hist-{i + 1}", seq=first_seq + i, now=at(), customer={"name": customer, "contact": f"0917 555 {2000 + i}"},
                                     raw_text=text, input=parse_request(text, at()), addons=[], is_sample=True, settings=settings)}
        cust = {"id": "customer", "name": cur["req"]["customer"]["name"], "role": "CUSTOMER"}

        def step(hours: float, action: str, who: dict, payload: dict | None = None) -> None:
            state["t"] += hours * HOUR
            cur["req"] = apply(cur["req"], action, who, payload or {}, at(), settings)

        outcome = r()
        step(1 + r() * 4 if fast else 6 + r() * 22, "start_offer", sales)
        if r() < 0.3:
            step(2, "customer_question", cust, {"note": pick(H["questions"])})
            step(1 if fast else 9, "answer", sales, {"note": "Answered by phone."})
        if r() < 0.5:
            step(0.5, "save_offer", sales, {"discount": math.floor((cur["req"]["offer"]["totals"]["margin"] * r() * 0.5) / 100) * 100})
        step(1, "submit", sales)
        if outcome >= 0.88:
            step(5, "decline", agent, {"note": "Partner hotels are full on those dates. Offer another month."})
            out.append(cur["req"])
            continue
        if r() < 0.2:
            step(4, "request_changes", agent, {"note": "Please use a lower hotel level to fit their budget."})
            step(3, "save_offer", sales, {"discount": 0})
            step(0.5, "submit", sales)
        step(4, "approve", agent, {"note": "Repeat customer, small margin is okay."} if cur["req"]["offer"]["totals"]["low_margin"] else {})
        step(1, "send", sales)
        if outcome < 0.5:
            if r() < 0.25:
                step(10, "customer_question", cust, {"note": pick(H["questions"])})
                step(1 if fast else 12, "answer", sales, {"note": "Replied with the details."})
            step(20, "customer_accept", cust)
            step(30, "mark_booked", sales)
            trip_end = state["t"] + (14 + cur["req"]["input"]["days"]) * 24 * HOUR
            if trip_end + 48 * HOUR < end and r() < 0.8:
                idx = pick_w([(k, w) for k, w in enumerate(FEEDBACK_WEIGHTS)])
                rating, note = H["feedback"][idx]
                state["t"] = trip_end + 48 * HOUR
                cur["req"] = apply(cur["req"], "customer_feedback", cust, {"rating": rating, "note": note}, at(), settings)
        else:
            if r() < 0.35:
                step(18, "customer_changes", cust, {"note": pick(H["changes"])})
            reason = pick_w(LOST_WEIGHTS)
            step(48, "mark_lost", sales, {"reason": reason, "note": pick(H["lost_notes"][reason])})
        out.append(cur["req"])
    return out
