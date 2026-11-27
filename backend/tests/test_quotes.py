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
