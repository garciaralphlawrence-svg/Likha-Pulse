"""PAPH AI Quotation Analyst: free, rule-based and fully deterministic (same inputs = same numbers).

Port twin of frontend/src/quote/engine.ts. Both read catalog.json and are checked by tests/quote_cases.json,
so the browser demo and the server give byte-for-byte the same numbers and sentences.
Regexes use re.ASCII so \\b and \\w behave like JavaScript.
"""
from __future__ import annotations

import copy
import json
import math
import re
from datetime import date, datetime, timedelta
from pathlib import Path

CATALOG: dict = json.loads((Path(__file__).with_name("catalog.json")).read_text(encoding="utf-8"))
RULES: dict = CATALOG["rules"]
TIERS: dict = CATALOG["tiers"]
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
A = re.ASCII


# ---------- small helpers (same rounding as TS: floor(x / 100 + 0.5) * 100) ----------
def r100(x: float) -> int:
    return int(math.floor(x / 100 + 0.5)) * 100


def rint(x: float) -> int:
    return int(math.floor(x + 0.5))


def js_num(x) -> str:
    """Number as JavaScript prints it in a template string (10 -> "10", 12.5 -> "12.5")."""
    if isinstance(x, bool):
        return str(x).lower()
    if isinstance(x, float) and x.is_integer():
        return str(int(x))
    return str(x)


def peso(n: float) -> str:
    v = abs(rint(n)) if n >= 0 else abs(rint(n))
    return ("-" if n < 0 else "") + "₱" + f"{v:,}"


def dest_by_code(code):
    return next((d for d in CATALOG["destinations"] if d["code"] == code), None)


def plural(n: int, w: str) -> str:
    return f"{n} {w}{'' if n == 1 else 's'}"


def pax_text(a: int, k: int) -> str:
    parts = [plural(a, "adult"), ("1 child" if k == 1 else f"{k} children") if k else ""]
    return " and ".join(p for p in parts if p)


def utc_date(y: int, m: int, d: int) -> date:
    """Like JS Date.UTC: months and days roll over instead of failing."""
    y += (m - 1) // 12
    m = (m - 1) % 12 + 1
    return date(y, m, 1) + timedelta(days=d - 1)


def fmt_day(iso: str) -> str:
    y, m, d = (int(x) for x in iso[:10].split("-"))
    return f"{MONTHS[m - 1][:3]} {d}, {y}"


# ---------- 1. Understand the request (English, Tagalog, Taglish) ----------
NUM_WORDS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12,
    "fourteen": 14, "fifteen": 15, "twenty": 20,
    "isa": 1, "isang": 1, "dalawa": 2, "dalawang": 2, "tatlo": 3, "tatlong": 3, "apat": 4, "lima": 5, "limang": 5, "anim": 6, "pito": 7,
    "pitong": 7, "walo": 8, "walong": 8, "siyam": 9, "sampu": 10, "sampung": 10, "a": 1,
}
NUM = "(\\d+|" + "|".join(NUM_WORDS) + ")"


def to_num(s: str) -> int:
    return int(s) if re.fullmatch(r"\d+", s, A) else NUM_WORDS.get(s, 0)


MONTH_RE = [
    (re.compile(r"\b(jan|january|enero)\b", A), 1), (re.compile(r"\b(feb|february|pebrero)\b", A), 2),
    (re.compile(r"\b(mar|march|marso)\b", A), 3), (re.compile(r"\b(apr|april|abril)\b", A), 4),
    (re.compile(r"\b(may\s+\d{1,2}|(in|this|next|ngayong|sa buwan ng)\s+may|may\s+20\d\d|mayo)\b", A), 5),
    (re.compile(r"\b(jun|june|hunyo)\b", A), 6), (re.compile(r"\b(jul|july|hulyo)\b", A), 7),
    (re.compile(r"\b(aug|august|agosto)\b", A), 8), (re.compile(r"\b(sep|sept|september|setyembre)\b", A), 9),
    (re.compile(r"\b(oct|october|oktubre)\b", A), 10), (re.compile(r"\b(nov|november|nobyembre)\b", A), 11),
    (re.compile(r"\b(dec|december|disyembre)\b", A), 12), (re.compile(r"\b(christmas|pasko|xmas)\b", A), 12),
    (re.compile(r"\b(new year|bagong taon)\b", A), 1),
    (re.compile(r"\b(holy week|semana santa|mahal na araw|summer|tag-init)\b", A), 4),
]
MONTH_NAMES = ("jan|january|enero|feb|february|pebrero|mar|march|marso|apr|april|abril|may|mayo|jun|june|hunyo|jul|july|hulyo|aug|august|agosto|"
               "sep|sept|september|setyembre|oct|october|oktubre|nov|november|nobyembre|dec|december|disyembre")


def month_of(word: str):
    for rx, m in MONTH_RE:
        if rx.search(word) or rx.search(" in " + word + " "):
            return m
    return None


def next_year_for(month: int, day: int, today: str) -> int:
    y = int(today[:4])
    return y if utc_date(y, month, day) >= date.fromisoformat(today[:10]) else y + 1


def parse_request(raw: str, today: str) -> dict:
    """Reads free text and fills in what it can. Anything not mentioned stays None so the customer can fill it in."""
    t = " " + re.sub(r"\s+", " ", re.sub("[–—]", "-", raw.lower())).strip() + " "
    out = {"destination": None, "place_text": None, "days": None, "adults": None, "kids": None, "tier": None, "budget": None,
           "budget_per_person": False, "month": None, "travel_date": None, "interests": [], "understood": []}

    best = math.inf
    for d in CATALOG["destinations"]:
        for a in d["aliases"]:
            m = re.search("\\b" + a.replace(" ", "\\s") + "\\b", t, A)
            if m and m.start() < best:
                best = m.start()
                out["destination"] = d["code"]
    if not out["destination"]:
        m = re.search(r"(?:pumunta|punta|go|travel|trip|fly|visit|tour)\s+(?:sa|to|in)?\s*([A-Z][\w'-]+(?:\s[A-Z][\w'-]+)?)", " " + raw + " ", A)
        if m and not re.fullmatch(r"(I|Ako|Kami|We)", m.group(1), A):
            out["place_text"] = m.group(1)

    rng = re.search(f"\\b({MONTH_NAMES})\\.?\\s*(\\d{{1,2}})\\s*(?:-|to|hanggang)\\s*(?:({MONTH_NAMES})\\.?\\s*)?(\\d{{1,2}})\\b", t, A)
    if rng:
        m1 = month_of(rng.group(1))
        m2 = month_of(rng.group(3)) if rng.group(3) else m1
        d1, d2 = int(rng.group(2)), int(rng.group(4))
        year = next_year_for(m1, d1, today)
        start = utc_date(year, m1, d1)
        end = utc_date(year + 1 if m2 < m1 else year, m2, d2)
        if end > start and d1 <= 31:
            out["days"] = (end - start).days + 1
            out["month"] = m1
            out["travel_date"] = start.isoformat()
    if not out["travel_date"]:
        single = re.search(f"\\b({MONTH_NAMES})\\.?\\s+(\\d{{1,2}})(?:st|nd|rd|th)?\\b(?!\\s*(?:days?|nights?|araw|gabi|pax|adults?|kids?))", t, A)
        if single and int(single.group(2)) <= 31:
            m1, d1 = month_of(single.group(1)), int(single.group(2))
            out["month"] = m1
            out["travel_date"] = utc_date(next_year_for(m1, d1, today), m1, d1).isoformat()
    if not out["month"]:
        for rx, mo in MONTH_RE:
            if rx.search(t):
                out["month"] = mo
                break

    if out["days"] is None:
        m = re.search(r"\b(\d+)\s*d\s*(\d+)\s*n\b", t, A) or re.search(r"\b(\d+)\s*n\s*(\d+)\s*d\b", t, A)
        if m:
            out["days"] = max(int(m.group(1)), int(m.group(2)))
        elif m := re.search(f"\\b{NUM}\\s*(?:-\\s*)?(?:nights?|gabi)\\b", t, A):
            out["days"] = to_num(m.group(1)) + 1
        elif m := re.search(f"\\b{NUM}\\s*(?:-\\s*)?(?:days?|araw)\\b", t, A):
            out["days"] = to_num(m.group(1))
        elif m := re.search(f"\\b{NUM}\\s*(?:-\\s*)?(?:weeks?|linggo)\\b", t, A):
            out["days"] = to_num(m.group(1)) * 7

    if m := re.search(f"\\b{NUM}\\s*(?:adults?|matanda)\\b", t, A):
        out["adults"] = to_num(m.group(1))
    if m := re.search(f"\\b{NUM}\\s*(?:kids?|children|child|bata|anak|chikiting)\\b", t, A):
        out["kids"] = to_num(m.group(1))
    m = re.search(r"\bfamily of (\d+)\b", t, A)
    if m and out["adults"] is None:
        n = int(m.group(1))
        out["adults"] = min(2, n)
        out["kids"] = out["kids"] if out["kids"] is not None else max(0, n - 2)
    m = re.search(f"\\b{NUM}\\s*(?:pax|people|persons?|tao|katao|travell?ers?|guests?)\\b", t, A)
    if m and out["adults"] is None:
        n = to_num(m.group(1))
        out["adults"] = max(1, n - (out["kids"] if out["kids"] is not None else 0))
    if out["adults"] is None:
        if re.search(r"\b(couple|honeymoon|mag-asawa|mag asawa|asawa ko|my (wife|husband|partner|boyfriend|girlfriend)|jowa|kami ni|kaming dalawa)\b", t, A):
            out["adults"] = 2
        elif re.search(r"\b(solo|ako lang|mag-isa|mag isa|alone|just me|by myself)\b", t, A):
            out["adults"] = 1
        elif re.search(r"\b(kami|we|us|namin|our|tayo)\b", t, A):
            out["adults"] = 2
        elif re.search(r"\b(ako|ko|i|me|my)\b", t, A) and not re.search(r"\b(family|pamilya|barkada|friends)\b", t, A):
            out["adults"] = 1

    if re.search(r"\b(5|five)[\s-]?stars?\b|5\*|\b(luxury|luxurious|sosyal|premium|high[\s-]?end|bongga)\b", t, A):
        out["tier"] = "luxury"
    elif re.search(r"\b(4|four)[\s-]?stars?\b|\b(mid[\s-]?range|midrange|mid|sakto lang|comfortable)\b", t, A):
        out["tier"] = "mid"
    elif re.search(r"\b(budget[\s-]?friendly|budget lang|budget hotel|budget trip|on a budget|cheap|cheapest|tipid|mura|pinakamura|affordable|hostel|low[\s-]?cost|(3|three)[\s-]?stars?)\b", t, A):
        out["tier"] = "budget"

    money = re.search(r"(?<![a-z])(?:₱|php|p)\s?(\d[\d,]*(?:\.\d+)?)\s*(k|m)?\b|\b(\d[\d,]*(?:\.\d+)?)\s*(k|m|thousand|million|libo|pesos?|php)\b", t, A)
    if money:
        n = float((money.group(1) if money.group(1) is not None else money.group(3)).replace(",", ""))
        unit = money.group(2) if money.group(2) is not None else (money.group(4) or "")
        mult = 1000 if unit in ("k", "thousand", "libo") else 1000000 if unit in ("m", "million") else 1
        amount = rint(n * mult)
        if amount >= 1000:
            out["budget"] = amount
            out["budget_per_person"] = bool(re.search(r"\b(per (person|pax|head|tao)|each|bawat isa|kada (isa|tao)|isang tao)\b|\/\s?(pax|person|head)", t, A))

    for k, words in CATALOG["interests"].items():
        if any(re.search("\\b" + w + "\\b", t, A) for w in words):
            out["interests"].append(k)

    out["understood"] = describe(out)
    return out


def describe(p: dict) -> list[str]:
    u = []
    d = dest_by_code(p.get("destination"))
    if d:
        u.append(f"Going to {d['name']}")
    elif p.get("place_text"):
        u.append(f"Going to {p['place_text']} (no sample rates yet)")
    if p.get("days"):
        u.append(f"{p['days']} days, {p['days'] - 1} nights")
    if p.get("travel_date"):
        u.append(f"Leaving {fmt_day(p['travel_date'])}")
    elif p.get("month"):
        u.append(f"Travelling in {MONTHS[p['month'] - 1]}")
    if p.get("adults") is not None or p.get("kids") is not None:
        u.append(pax_text(p["adults"] if p.get("adults") is not None else 1, p["kids"] if p.get("kids") is not None else 0))
    if p.get("tier"):
        u.append(f"{TIERS[p['tier']]['label']} hotel")
    if p.get("budget"):
        u.append(f"Budget {peso(p['budget'])}{' per person' if p.get('budget_per_person') else ' in total'}")
    if p.get("interests"):
        u.append("Likes " + ", ".join(i.replace("_", " ", 1) for i in p["interests"]))
    return u


def normalize(p: dict, rules: dict = RULES) -> tuple[dict, list[str]]:
    """Fills gaps with safe defaults and says plainly what was assumed."""
    a: list[str] = []
    days = p.get("days")
    if not days:
        days = rules["default_days"]
        a.append(f"No trip length given, so we used {js_num(days)} days.")
    days = int(min(rules["max_days"], max(rules["min_days"], math.floor(days))))
    adults = p.get("adults")
    if not adults or adults < 1:
        adults = 1
        a.append("Number of travellers not given, so we priced it for 1 adult.")
    kids = max(0, int(math.floor(p.get("kids") or 0)))
    month = p.get("month") or None
    if p.get("travel_date"):
        month = int(p["travel_date"][5:7])
    interests = list(p.get("interests") or [])
    if kids > 0 and "family" not in interests:
        interests.append("family")
    if not p.get("tier"):
        a.append("No hotel level chosen, so we compared all three.")
    budget = p.get("budget")
    return ({
        "destination": p.get("destination") or None, "place_text": p.get("place_text") or None, "days": days, "adults": int(math.floor(adults)),
        "kids": kids, "tier": p.get("tier") or None, "budget": rint(budget) if budget and budget > 0 else None,
        "budget_per_person": bool(p.get("budget_per_person")), "month": month, "travel_date": p.get("travel_date") or None, "interests": interests,
    }, a)


# ---------- 2. Price it ----------
def season_of(d: dict, month, rules: dict = RULES) -> dict:
    if not month:
        return {"kind": "regular", "label": "Regular season (no travel month given)", "month": None}
    ph = rules["ph_peak"].get(str(month))
    if ph:
        return {"kind": "peak", "label": f"Peak season: {ph}", "month": month}
    if month in d["peak_months"]:
        return {"kind": "peak", "label": f"Peak season: busy month in {d['name']}", "month": month}
    if month in d["low_months"]:
        return {"kind": "low", "label": f"Off-peak: quieter month in {d['name']}", "month": month}
    return {"kind": "regular", "label": f"Regular season ({MONTHS[month - 1]})", "month": month}


def _rank(items: list[dict], interests: list[str]) -> list[dict]:
    scored = [(-sum(1 for x in it["tags"] if x in interests), i, it) for i, it in enumerate(items)]
    return [it for _, _, it in sorted(scored, key=lambda s: (s[0], s[1]))]


def option_for(tier: str) -> dict:
    return next(o for o in CATALOG["options"] if o["tier"] == tier)


def price_option(d: dict, inp: dict, opt: dict, rules: dict = RULES) -> dict:
    tier = opt["tier"]
    adults, kids, days = inp["adults"], inp["kids"], inp["days"]
    pax, nights = adults + kids, days - 1
    rooms = max(1, math.ceil(adults / 2), math.ceil(pax / 4))
    lines: list[dict] = []

    def add(kind, label, detail, lo, hi):
        lines.append({"kind": kind, "label": label, "detail": detail, "low": r100(lo), "high": r100(hi)})

    season = season_of(d, inp.get("month"), rules)
    fp = adults + kids * rules["kid_flight_factor"]
    add("flight", "Flights", f"{d['flight_note']}, {pax_text(adults, kids)}{' (children about 25% less)' if kids else ''}", d["flight"][0] * fp, d["flight"][1] * fp)
    h = d["hotels"][tier]
    add("hotel", "Hotel", f"{h['stay']}, {plural(nights, 'night')} x {plural(rooms, 'room')}{', kids share with parents' if kids else ''}",
        h["rate"][0] * nights * rooms, h["rate"][1] * nights * rooms)

    n_tours = min(len(d["tours"]), max(1, rint((days - 2) * opt["tour_share"]))) if days >= 3 else 0
    tours = _rank(d["tours"], inp["interests"])[:n_tours]
    if tours:
        tp = adults + kids * rules["kid_tour_factor"]
        add("tours", "Tours and activities", "; ".join(x["name"] for x in tours) + (" (children about half price)" if kids else ""),
            sum(x["price"][0] for x in tours) * tp, sum(x["price"][1] for x in tours) * tp)
    vehicles = pax if d["transfer_per_person"] else math.ceil(pax / 4)
    tf = rules["premium_transfer_factor"] if opt["code"] == "premium" else 1
    add("transfer", "Private airport transfers" if opt["code"] == "premium" else "Airport transfers",
        "Round trip, per person (boat, van and port fees)" if d["transfer_per_person"] else f"Round trip, {plural(vehicles, 'vehicle')}",
        d["transfer"][0] * vehicles * tf, d["transfer"][1] * vehicles * tf)
    lp = adults + kids * rules["kid_local_factor"]
    add("local", "Local transport", f"{d['local_note']}, {plural(days, 'day')}", d["local"][0] * days * lp, d["local"][1] * days * lp)
    if d["visa"]["fee"][1] > 0:
        add("visa", "Visa processing" if d["visa"]["needed"] else "Entry fees", f"{d['visa']['label']}, {plural(pax, 'traveller')}",
            d["visa"]["fee"][0] * pax, d["visa"]["fee"][1] * pax)
    if d["insurance_required"]:
        ins = rules["insurance_per_day"]["domestic" if d["domestic"] else "international"]
        add("insurance", "Travel insurance (required)", f"Required for this visa, {plural(days, 'day')} x {plural(pax, 'traveller')}",
            ins[0] * days * pax, ins[1] * days * pax)
    fl = next(x for x in lines if x["kind"] == "flight")
    ht = next(x for x in lines if x["kind"] == "hotel")
    pk, op = rules["peak_surcharge_pct"], rules["offpeak_saving_pct"]
    if season["kind"] == "peak":
        add("peak", "Peak-season surcharge", f"{season['label'].replace('Peak season: ', '', 1)}: flights and hotels cost about {js_num(pk)}% more",
            (fl["low"] + ht["low"]) * pk / 100, (fl["high"] + ht["high"]) * pk / 100)
    if season["kind"] == "low":
        add("offpeak", "Off-peak saving", f"Quieter month: flights and hotels about {js_num(op)}% cheaper",
            -(fl["low"] + ht["low"]) * op / 100, -(fl["high"] + ht["high"]) * op / 100)
    if pax >= rules["group_size"]:
        tr = next((x for x in lines if x["kind"] == "tours"), None)
        g = rules["group_discount_pct"]
        add("group", "Group discount", f"{pax} travellers: {js_num(g)}% off hotel and tours",
            -(ht["low"] + (tr["low"] if tr else 0)) * g / 100, -(ht["high"] + (tr["high"] if tr else 0)) * g / 100)
    sub_lo = sum(x["low"] for x in lines)
    sub_hi = sum(x["high"] for x in lines)
    fee_lo = r100(max(rules["service_fee_min"], sub_lo * rules["service_fee_pct"] / 100))
    fee_hi = r100(max(rules["service_fee_min"], sub_hi * rules["service_fee_pct"] / 100))
    lines.append({"kind": "fee", "label": "PAPH service fee", "detail": f"Planning, booking and 24/7 trip support ({js_num(rules['service_fee_pct'])}%)", "low": fee_lo, "high": fee_hi})
    total_lo, total_hi = sub_lo + fee_lo, sub_hi + fee_hi
    return {
        "code": opt["code"], "label": opt["label"], "tier": tier, "tier_label": TIERS[tier]["label"], "blurb": opt["blurb"], "lines": lines,
        "subtotal_low": sub_lo, "subtotal_high": sub_hi, "total_low": total_lo, "total_high": total_hi,
        "pp_low": r100(total_lo / pax), "pp_high": r100(total_hi / pax), "fit": None, "recommended": False,
        "hotel": {"area": h["area"], "why": h["why"], "stay": h["stay"], "rooms": rooms, "nights": nights, "rate": h["rate"]},
        "tours": [x["name"] for x in tours], "itinerary": _itinerary(d, inp, h["area"], tours, opt["code"] == "premium"),
    }


def _itinerary(d: dict, inp: dict, area: str, tours: list[dict], priv: bool) -> list[dict]:
    days = [{"day": 1, "title": "Arrival", "text": f"Fly from Manila to {d['name']}. {'Private car' if priv else 'Transfer'} to your hotel in {area}, check in and rest. Easy walk around the area in the evening."}]
    middle = max(0, inp["days"] - 2)
    slots: list = [None] * middle
    for j, t in enumerate(tours):
        slots[(j * middle) // len(tours)] = t
    ideas = _rank(d["ideas"], inp["interests"])
    k = 0
    for i, t in enumerate(slots):
        if t:
            days.append({"day": i + 2, "title": t["name"], "text": f"{t['name']}, with a guide and entrance fees. The rest of the day is free."})
        elif k < len(ideas):
            idea = ideas[k]
            k += 1
            days.append({"day": i + 2, "title": "Free day", "text": idea["text"] + "."})
        else:
            days.append({"day": i + 2, "title": "Free day", "text": "Explore at your own pace, or add an extra tour."})
    if inp["days"] >= 2:
        days.append({"day": inp["days"], "title": "Going home", "text": "Free morning for last-minute shopping, check out, transfer to the airport and fly home to Manila."})
    return days


def _budget_total(inp: dict):
    if inp["budget"] is None:
        return None
    return inp["budget"] * (inp["adults"] + inp["kids"]) if inp["budget_per_person"] else inp["budget"]


def _fit_of(o: dict, b: float) -> str:
    return "fits" if b >= o["total_high"] else "tight" if b >= o["total_low"] else "over"


def recommend(p: dict, rules: dict = RULES) -> dict:
    """The full AI recommendation: 3 options, the best match, a budget check with nearest fits, visa notes and add-ons."""
    inp, assumptions = normalize(p, rules)
    d = dest_by_code(inp["destination"])
    base = {"input": inp, "assumptions": assumptions, "notice": CATALOG["notice"], "version": CATALOG["version"]}
    if not d:
        where = inp["place_text"] or ""
        return {**base, "kind": "manual", "destination": None, "season": {"kind": "regular", "label": "", "month": inp["month"]}, "options": [],
                "recommended": None, "budget": None, "visa": None, "addons": [],
                "verdict": f"We don't have sample rates for {where} yet, so a PAPH travel consultant will price this trip for you." if where
                else "Tell us where you would like to go, and a PAPH travel consultant will price the trip for you."}
    season = season_of(d, inp["month"], rules)
    if inp["days"] < d["min_days"]:
        assumptions.append(f"{d['name']} is best with at least {d['min_days']} days; {inp['days']} days will feel rushed.")
    options = [price_option(d, inp, o, rules) for o in CATALOG["options"]]
    B = _budget_total(inp)
    if inp["tier"]:
        rec = next(o for o in options if o["tier"] == inp["tier"])
    elif B is not None:
        rec = next((o for o in reversed(options) if o["total_low"] <= B), options[0])
    else:
        rec = next(o for o in options if o["code"] == "value")
    rec["recommended"] = True
    if B is not None:
        for o in options:
            o["fit"] = _fit_of(o, B)
    head = f"{d['name']}, {inp['days']} days, {rec['tier_label'].lower()} hotel: about {peso(rec['pp_low'])} to {peso(rec['pp_high'])} per person"
    if inp["adults"] + inp["kids"] > 1:
        verdict = f"{head} ({peso(rec['total_low'])} to {peso(rec['total_high'])} for {pax_text(inp['adults'], inp['kids'])})."
    else:
        verdict = f"{head}."
    budget = _check_budget(d, inp, options, rec, B, rules) if B is not None else None
    if budget and budget["status"] == "over":
        verdict = budget["message"]
    elif budget and budget["status"] == "tight":
        verdict = f"{head}. Your {peso(B)} budget fits the lower end of the range."
    elif budget and budget["status"] == "fits":
        verdict = f"{head}. This fits your {peso(B)} budget."
    v = d["visa"]
    return {**base, "kind": "priced", "destination": {"code": d["code"], "name": d["name"], "country": d["country"], "region": d["region"], "domestic": d["domestic"]},
            "season": season, "options": options, "recommended": rec["code"], "verdict": verdict, "budget": budget,
            "visa": {"needed": v["needed"], "label": v["label"], "note": v["note"], "docs": v["docs"], "fee": v["fee"]},
            "addons": _addons_for(d, inp, rec, rules)}


def _uniq(xs):
    out = []
    for x in xs:
        if x not in out:
            out.append(x)
    return out


def _check_budget(d: dict, inp: dict, options: list[dict], rec: dict, B: int, rules: dict) -> dict:
    status = _fit_of(rec, B)
    cheapest = options[0]
    if status != "over":
        msg = (f"Your {peso(B)} budget covers this option with about {peso(B - rec['total_high'])} to spare." if status == "fits"
               else f"Your {peso(B)} budget fits the lower end of this range.")
        return {"budget_total": B, "status": status, "message": msg, "shortfall": 0, "ideas": [], "best": None}
    ideas: list[dict] = []

    def mk(kind, title, detail, dest, tier, days, month):
        q = price_option(dest, {**inp, "destination": dest["code"], "days": days, "month": month,
                                "travel_date": inp["travel_date"] if month == inp["month"] else None}, option_for(tier), rules)
        return {"kind": kind, "title": title, "detail": detail, "destination": dest["code"], "tier": tier, "days": days, "month": month,
                "total_low": q["total_low"], "total_high": q["total_high"], "diff": B - q["total_low"], "fits": q["total_low"] <= B}

    lower = list(reversed([o for o in options if o["total_low"] < rec["total_low"]]))
    tier_fit = next((o for o in lower if o["total_low"] <= B), None)
    if tier_fit:
        ideas.append(mk("tier", f"{tier_fit['label']} hotel instead", f"{d['name']} for {inp['days']} days with a {tier_fit['tier_label'].lower()} hotel.",
                        d, tier_fit["tier"], inp["days"], inp["month"]))
    min_d = max(rules["min_days"], min(d["min_days"], inp["days"] - 1))
    for tier in _uniq([rec["tier"], "budget"]):
        found = None
        for n in range(inp["days"] - 1, min_d - 1, -1):
            f = mk("days", f"{n} days instead of {inp['days']}", f"{d['name']} for {n} days with a {TIERS[tier]['label'].lower()} hotel.", d, tier, n, inp["month"])
            if f["fits"]:
                found = f
                break
        if found:
            ideas.append(found)
            break
    season = season_of(d, inp["month"], rules)
    if season["kind"] != "low" and d["low_months"]:
        lm = d["low_months"][0]
        for tier in _uniq([rec["tier"], "budget"]):
            f = mk("month", f"Travel in {MONTHS[lm - 1]} instead", f"{d['name']} in {MONTHS[lm - 1]} (off-peak) for {inp['days']} days with a {TIERS[tier]['label'].lower()} hotel.",
                   d, tier, inp["days"], lm)
            if f["fits"] or tier == "budget":
                ideas.append(f)
                break
    # d) a cheaper destination: same number of days first, then fewer (down to that place's shortest sensible trip)
    alts = []
    for a in (dest_by_code(c) for c in d["alternatives"]):
        if not a:
            continue
        for n in range(inp["days"], max(rules["min_days"], min(a["min_days"], inp["days"])) - 1, -1):
            f = mk("destination", f"{a['name']} instead", f"{a['name']} for {n} days with a budget hotel.", a, "budget", n, inp["month"])
            if f["fits"]:
                alts.append(f)
                break
    # longest trip first, then the one that uses the budget best; keep two
    ideas.extend(sorted(alts, key=lambda f: (-f["days"], f["diff"]))[:2])
    best = next((i for i in ideas if i["fits"]), None)
    shortfall = cheapest["total_low"] - B
    short = (f"Your {peso(B)} budget is {peso(rec['total_low'] - B)} short of the lowest price for {d['name']}, {inp['days']} days, "
             f"{rec['tier_label'].lower()} hotel ({peso(rec['total_low'])}).")
    if best:
        detail = best["detail"][:-1] if best["detail"].endswith(".") else best["detail"]
        message = f"{short} Nearest fit: {detail}, from {peso(best['total_low'])} ({peso(best['diff'])} under your budget)."
    else:
        message = f"{short} Even the simplest version needs at least {peso(cheapest['total_low'])}, so you would need {peso(max(0, shortfall))} more."
    return {"budget_total": B, "status": status, "message": message, "shortfall": max(0, shortfall), "ideas": ideas, "best": best}


def _addons_for(d: dict, inp: dict, rec: dict, rules: dict) -> list[dict]:
    pax, out = inp["adults"] + inp["kids"], []
    cat = {a["code"]: a for a in CATALOG["addons"]}
    if not d["insurance_required"]:
        ins = rules["insurance_per_day"]["domestic" if d["domestic"] else "international"]
        out.append({"code": "insurance", "label": cat["insurance"]["label"], "detail": cat["insurance"]["detail"],
                    "unit": f"{plural(pax, 'traveller')}, {plural(inp['days'], 'day')}",
                    "cost": r100(ins[0] * inp["days"] * pax), "price": r100(ins[1] * inp["days"] * pax)})
    if rec["code"] != "premium" and not d["transfer_per_person"]:
        pt = cat["private_transfer"]
        out.append({"code": "private_transfer", "label": pt["label"], "detail": pt["detail"], "unit": "per booking", "cost": pt["cost"][0], "price": pt["price"]})
    if not d["domestic"]:
        w = cat["wifi"]
        out.append({"code": "wifi", "label": w["label"], "detail": w["detail"], "unit": plural(inp["days"], "day"),
                    "cost": r100(w["cost"][0] * inp["days"]), "price": r100(w["price"] * inp["days"])})
    tp = inp["adults"] + inp["kids"] * rules["kid_tour_factor"]
    for i, t in enumerate(d["tours"]):
        if t["name"] in rec["tours"]:
            continue
        out.append({"code": f"tour:{i}", "label": f"Extra tour: {t['name']}", "detail": "Guided, with entrance fees.", "unit": plural(pax, "traveller"),
                    "cost": r100((t["price"][0] + t["price"][1]) / 2 * tp), "price": r100(t["price"][1] * tp)})
    return out


def rules_with(overrides: dict | None) -> dict:
    r = copy.deepcopy(RULES)
    r.update(overrides or {})
    return r


def today_iso() -> str:
    return datetime.utcnow().date().isoformat()
