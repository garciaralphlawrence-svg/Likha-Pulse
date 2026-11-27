"""The Python quote engine and workflow must match the TypeScript ones exactly (tests/quote_cases.json is shared
with frontend/scripts/quote-test.mjs, and its "golden" numbers come from the TS engine)."""
import json
from pathlib import Path

import pytest

from app.quotes import engine as E
from app.quotes import workflow as W

CASES = json.loads((Path(__file__).with_name("quote_cases.json")).read_text(encoding="utf-8"))


@pytest.mark.parametrize("case", CASES["parse"], ids=lambda c: c["text"][:40])
def test_parse(case):
    p = E.parse_request(case["text"], CASES["today"])
    for k, v in case["expect"].items():
        assert p[k] == v, f"{k}: got {p[k]!r} expected {v!r}"


def summary(r):
    b = r["budget"]
    return {
        "kind": r["kind"], "recommended": r["recommended"], "season": r["season"]["kind"], "verdict": r["verdict"],
        "options": [{"code": o["code"], "lines": [[x["kind"], x["low"], x["high"]] for x in o["lines"]], "total": [o["total_low"], o["total_high"]],
                     "pp": [o["pp_low"], o["pp_high"]], "tours": o["tours"], "days": len(o["itinerary"]), "fit": o["fit"]} for o in r["options"]],
        "budget": b and {"status": b["status"], "shortfall": b["shortfall"],
                         "best": b["best"] and [b["best"]["kind"], b["best"]["destination"], b["best"]["tier"], b["best"]["days"], b["best"]["total_low"]],
                         "ideas": [[i["kind"], i["destination"], i["tier"], i["days"], i["month"], i["total_low"], i["fits"]] for i in b["ideas"]]},
        "addons": [[a["code"], a["cost"], a["price"]] for a in r["addons"]],
    }


@pytest.mark.parametrize("case", CASES["recommend"], ids=lambda c: c["name"])
def test_golden_numbers_match_typescript(case):
    got = json.loads(json.dumps(summary(E.recommend(case["input"]))))
    assert got == CASES["golden"][case["name"]]


def test_showcase_rules():
    lux = E.recommend({"destination": "london", "days": 10, "adults": 1, "tier": "luxury"})
    assert lux["recommended"] == "premium" and len(lux["options"]) == 3
    cheap = E.recommend({"destination": "london", "days": 10, "adults": 1, "tier": "budget", "budget": 80000})
    assert cheap["budget"]["status"] == "over" and cheap["budget"]["best"]["total_low"] <= 80000
    assert "short" in cheap["verdict"] and "Nearest fit" in cheap["verdict"]
    assert E.recommend({"destination": "london", "days": 10, "adults": 1}) == E.recommend({"destination": "london", "days": 10, "adults": 1})


S = W.DEFAULT_SETTINGS
T0 = "2026-11-27T02:00:00.000Z"
SALES = {"id": "s1", "name": "Sam Sales", "role": "SALES"}
AGENT = {"id": "a1", "name": "Ana Agent", "role": "AGENT"}
ADMIN = {"id": "o1", "name": "Owner", "role": "ADMIN"}
CUST = {"id": "c", "name": "Customer", "role": "CUSTOMER"}


def blocked(fn):
    with pytest.raises(W.FlowError):
        fn()


def test_workflow_rules():
    r = W.create_request(id="x", seq=1, now=T0, customer={"name": "Juan", "contact": "0917 000 0000"}, raw_text="London",
                         input={"destination": "london", "days": 10, "adults": 1, "tier": "luxury"}, addons=["wifi"], settings=S)
    assert r["ref"] == "PAPH-2026-0001" and r["status"] == "ai_recommended" and len(r["events"]) == 2
    blocked(lambda: W.apply(r, "approve", AGENT, {}, T0, S))
    blocked(lambda: W.apply(r, "start_offer", AGENT, {}, T0, S))
    r = W.apply(r, "start_offer", SALES, {}, T0, S)
    assert r["status"] == "offer_drafted" and any(x["kind"] == "addon" for x in r["offer"]["lines"]) and r["offer"]["totals"]["ai_check"] == "inside"
    blocked(lambda: W.apply(r, "approve", SALES, {}, T0, S))
    too_cheap = W.apply(r, "save_offer", SALES, {"discount": r["offer"]["totals"]["margin"] + 5000}, T0, S)
    assert too_cheap["offer"]["totals"]["below_cost"]
    blocked(lambda: W.apply(too_cheap, "submit", SALES, {}, T0, S))
    thin = W.apply(r, "save_offer", SALES, {"discount": r["offer"]["totals"]["margin"] - W.js_round(r["offer"]["totals"]["price"] * 0.03)}, T0, S)
    assert thin["offer"]["totals"]["low_margin"]
    p = W.apply(thin, "submit", SALES, {}, T0, S)
    blocked(lambda: W.apply(p, "approve", AGENT, {}, T0, S))
    p = W.apply(p, "approve", AGENT, {"note": "Repeat customer"}, T0, S)
    assert p["status"] == "approved" and p["approval"]["version"] == p["offer"]["version"]
    r = W.apply(r, "submit", ADMIN, {}, T0, S)
    blocked(lambda: W.apply(r, "approve", ADMIN, {}, T0, S))
    blocked(lambda: W.apply(r, "request_changes", AGENT, {}, T0, S))
    ch = W.apply(r, "request_changes", AGENT, {"note": "Use a cheaper hotel"}, T0, S)
    assert ch["status"] == "changes_requested"
    ch = W.apply(ch, "save_offer", SALES, {"discount": 1000}, T0, S)
    assert ch["status"] == "offer_drafted"
    r = W.apply(r, "approve", AGENT, {}, T0, S)
    assert r["status"] == "approved"
    edited = W.apply(r, "save_offer", SALES, {"discount": 2000}, T0, S)
    assert edited["status"] == "pending_approval" and edited["approval"] is None
    later = "2026-12-10T02:00:00.000Z"
    assert W.is_expired(r, later)
    blocked(lambda: W.apply(r, "customer_accept", CUST, {}, later, S))
    r = W.apply(r, "send", SALES, {}, T0, S)
    r = W.apply(r, "customer_question", CUST, {"note": "Is breakfast included?"}, T0, S)
    assert r["customer_question"] and r["status"] == "sent"
    r = W.apply(r, "answer", SALES, {"note": "Yes, daily breakfast"}, T0, S)
    r = W.apply(r, "customer_accept", CUST, {}, T0, S)
    blocked(lambda: W.apply(r, "mark_lost", SALES, {}, T0, S))
    r = W.apply(r, "mark_booked", SALES, {}, T0, S)
    assert r["status"] == "booked" and len(r["events"]) == 10
    terms = W.quotation_terms(p, S, T0)
    assert terms["deposit"] == E.r100(p["offer"]["totals"]["price"] * 0.3) and terms["deposit"] + terms["balance"] == p["offer"]["totals"]["price"]


def test_time_format_matches_javascript():
    assert W.add_days(T0, 7) == "2026-12-04T02:00:00.000Z"


def test_owner_history_and_report_match_typescript():
    """Sample history (seeded random walk through the workflow) and the owner report give exactly the TS numbers."""
    from app.quotes.history import generate_history
    from app.quotes.owner import owner_report

    now = "2026-11-27T02:00:00.000Z"

    def a(i, n, r):
        return {"id": i, "name": n, "role": r}

    hist = generate_history(now, {"sales": [a("s1", "Demo Salesperson", "SALES"), a("s2", "Second Salesperson (sample)", "SALES")],
                                  "agent": a("a1", "Demo Travel Agent", "AGENT")}, 1, W.DEFAULT_SETTINGS)
    rep = owner_report(hist, {"range": "all", "destination": "", "salesperson": ""}, now)
    rep90 = owner_report(hist, {"range": "90", "destination": "japan", "salesperson": "s1"}, now)
    s = rep["sentiment"]
    got = {
        "refs": [hist[0]["ref"], hist[-1]["ref"]], "statuses": ",".join(r["status"] for r in hist),
        "last_event": [[e["action"], e["at"]] for e in hist[-1]["events"]],
        "feedback": "".join(str(r["feedback"]["rating"]) for r in hist if r.get("feedback")), "briefing": rep["briefing"],
        "sentiment": [s["total"], s["positive"], s["neutral"], s["negative"], s["avg_score"], s["ratings"]],
        "trend": [[t["period"], t["count"], t["score"]] for t in s["trend"]], "themes": [[t["theme"], t["count"], t["negative"], t["requests"]] for t in s["themes"]],
        "team": rep["team"], "revenue": [rep["revenue"][k] for k in ("booked", "margin", "margin_pct", "pipeline", "avg_booking", "quote_to_book_pct")],
        "by_month": rep["revenue"]["by_month"], "funnel": [f["count"] for f in rep["revenue"]["funnel"]], "lost": rep["revenue"]["lost_reasons"],
        "filtered": [rep90["requests"], rep90["sentiment"]["total"], rep90["revenue"]["booked"], len(rep90["team"])],
    }
    expected = CASES["owner_golden"]
    for k in expected:
        assert json.loads(json.dumps(got[k])) == expected[k], k


def test_response_clock_and_care_match_typescript():
    """Sample messages, cases, clocks, keyword watch, team/weekly reports, client history and the owner report: same as TS (care_golden)."""
    from app.quotes import care as C
    from app.quotes import clock as K
    from app.quotes.history import generate_history
    from app.quotes.owner import owner_report

    now = "2026-11-27T02:00:00.000Z"

    def a(i, n, r):
        return {"id": i, "name": n, "role": r}

    s1, s2, a1 = a("s1", "Demo Salesperson", "SALES"), a("s2", "Second Salesperson (sample)", "SALES"), a("a1", "Demo Travel Agent", "AGENT")
    S = W.DEFAULT_SETTINGS
    hist = generate_history(now, {"sales": [s1, s2], "agent": a1}, 1, S)
    names = list(dict.fromkeys(r["customer"]["name"] for r in hist))
    gm = C.generate_messages(now, [s1, s2, a1], names, S, 1)
    live = C.sample_live_cases(now, {"sales": s1, "sales2": s2, "agent": a1}, S, len(gm["cases"]) + 1, len(gm["messages"]) + 1)
    messages, cases = gm["messages"] + live["messages"], gm["cases"] + live["cases"]
    o, d = "2026-11-26T00:00:00.000Z", "2026-11-27T00:00:00.000Z"
    assert [K.stage_at(o, d, None, K.add_ms(o, h * 3600000)) for h in (5.99, 6, 12, 18, 24)] == ["green", "yellow", "orange", "red", "overdue"]
    assert ",".join(K.case_view(c, now)["stage"] for c in live["cases"]) == "green,yellow,orange,red,green,orange,overdue,yellow,overdue"
    rep = owner_report(hist, {"range": "all", "destination": "", "salesperson": ""}, now, {"messages": messages, "cases": cases, "settings": S})
    ch = C.client_history(C.name_key(names[0]), hist, messages, cases, now)
    got = {
        "messages": len(messages),
        "cases": [[c["id"], c["situation"], c["priority"], c["opened_at"], c["due_at"], c["first_reply_at"], c["resolved_at"],
                   sum(1 for x in c["steps"] if x["done"]), c["owner"] and c["owner"]["id"]] for c in cases],
        "message_moods": "".join(C.message_view(m, now, S)["mood"][0] for m in messages), "reply_keys": [C.reply_key(m["text"]) for m in messages[:30]],
        "stats": K.clock_stats(cases, now), "stats90": K.clock_stats(cases, now, "2026-08-29T02:00:00.000Z"),
        "request_clocks": [c for c in (K.request_clock(r, now, S) for r in hist) if c],
        "watch": C.keyword_watch(hist, messages, S["watch_words"], 30, now)["counts"],
        "team": C.team_report(hist, messages, cases, 3, now)["staff"], "weekly": C.weekly_report(hist, messages, cases, S, now),
        "client": [ch["name"], ch["verdict"], len(ch["requests"]), ch["booked"], ch["spent"], ch["rating"], ch["moods"], len(ch["cases"]), len(ch["timeline"])],
        "owner": [rep["briefing"], rep["sentiment"]["total"], rep["sentiment"]["negative"],
                  [[t["id"], t["messages_handled"], t["cases_solved"], t["cases_on_time_pct"]] for t in rep["team"]]],
    }
    expected = CASES["care_golden"]
    for k in expected:
        assert json.loads(json.dumps(got[k])) == expected[k], k


def test_response_clock_rules():
    from app.quotes import clock as K
    now, S = "2026-11-27T02:00:00.000Z", W.DEFAULT_SETTINGS
    s1, s2 = {"id": "s1", "name": "Demo Salesperson", "role": "SALES"}, {"id": "s2", "name": "x", "role": "SALES"}
    c0 = K.open_case(id="C1", now=now, source="message", text="Nawala po passport ko dito sa Seoul", client="X", client_key="n:x", by="AI", s=S)
    assert c0["situation"] == "documents" and c0["priority"] == "urgent"
    assert c0["due_at"] == "2026-11-28T02:00:00.000Z" and c0["reply_due_at"] == "2026-11-27T03:00:00.000Z"
    with pytest.raises(K.CaseError):
        K.case_act(c0, "reply", s1, {}, now, S)
    c1 = K.case_act(c0, "assign", s1, {"assignee": {"id": "s1", "name": "Demo Salesperson"}}, now, S)
    with pytest.raises(K.CaseError):
        K.case_act(c1, "assign", s2, {"assignee": {"id": "s2", "name": "x"}}, now, S)
    c1 = K.case_act(c1, "solve", s1, {}, "2026-11-27T20:00:00.000Z", S)
    assert K.case_view(c1, now)["on_time"] and c1["first_reply_at"]
    assert K.auto_case_for("customer_feedback", "", 2)["source"] == "feedback" and K.auto_case_for("customer_feedback", "", 4) is None
    assert K.auto_case_for("customer_question", "Ang tagal po ng reply ninyo, wala pa rin update!", None)["source"] == "request"
    from app.quotes.history import generate_history
    hist = generate_history(now, {"sales": [s1, s2], "agent": {"id": "a1", "name": "A", "role": "AGENT"}}, 1, S)
    rq = next(r for r in hist if r["status"] == "lost")
    assert K.request_clock({**rq, "status": "ai_recommended", "events": rq["events"][:2], "customer_question": None}, now, S)["stage"] == "overdue"
