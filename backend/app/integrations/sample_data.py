"""Clearly labeled SAMPLE feedback for demonstrations (is_sample = True).

Used only when no platform is connected. Every record created from here is flagged as sample data
and shown with a "Sample data" badge in the interface. Delete it any time from Settings.
"""
from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone

SERVICES = ["IV drip", "facial", "consultation", "laser session", "skin treatment"]
STAFF = ["nurse", "receptionist", "doctor", "front desk staff", "therapist"]
BRANCHES = ["Timog branch", "Mandaluyong branch", "QC branch"]

TEMPLATES = {
    "google_business": [
        ("Ang ganda ng service! Super accommodating ng {staff}. Highly recommend!", 5),
        ("Clean and relaxing place. The {svc} was worth it, will come back.", 5),
        ("Okay naman ang {svc} pero sobrang tagal ng waiting time, almost 2 hours.", 2),
        ("Very professional doctors, you know you're in safe hands.", 5),
        ("Mahal for what you get. Expected more from the {svc}.", 2),
        ("Wow, excellent service! I waited for five hours.", 1),
        ("The {staff} was rude when I asked about my schedule. Disappointing.", 1),
        ("Malinis at maayos ang {branch}. Mabait ang mga staff.", 5),
        ("Good results after my third {svc} session. Salamat po!", 4),
        ("Average experience, nothing special.", 3),
        ("Parking is hard to find near the {branch}.", 3),
        ("Nagka-pantal ako after ng {svc}, sana ma-check ninyo kung bakit.", 1),
        ("Sulit ang promo package, smooth ang booking process.", 5),
        ("Booking online keeps failing, nag error yung form twice.", 2),
        ("Friendly staff pero medyo magulo ang pila sa reception.", 3),
    ],
    "facebook_page": [
        ("Magkano po ang {svc} ngayon?", None),
        ("Available pa po ba ang promo hanggang December?", None),
        ("Ang galing ng results ko, salamat sa buong team!", None),
        ("Sana may branch kayo sa Cavite or Laguna.", None),
        ("Bakit po walang sumasagot sa page? Ilang araw na akong nag message.", None),
        ("Super satisfied with the {svc}! Glowing ang skin ko.", None),
        ("Okay sana pero disappointing ang experience sa {branch}.", None),
        ("Paano po mag book for this weekend?", None),
        ("Overpriced. Mas mura sa ibang clinic.", None),
        ("Grabe ang ganda ng lounge, very relaxing!", None),
        ("Seen lang yung message ko, nakakainis.", None),
        ("Thank you sa mabilis na reply kahapon!", None),
        ("Is the {svc} safe for pregnant women?", None),
        ("Hindi maganda ang experience ko, sobrang bagal ng process.", None),
        ("Congrats on 13 years! Best clinic ever.", None),
    ],
    "messenger": [
        ("Hi po, pwede po bang magtanong about the {svc}?", None),
        ("Follow up lang po sa refund ko, wala pa rin hanggang ngayon.", None),
        ("Pa-assist po, hindi ko ma-book yung slot sa website.", None),
        ("Nag message na ako last week, any update po?", None),
        ("Thank you po sa accommodating na {staff}!", None),
        ("Nahilo po ako after ng {svc} kahapon, normal po ba yun?", None),
        ("Can I reschedule my appointment to Saturday?", None),
        ("Charged twice po ako sa GCash, paki check naman po.", None),
        ("Saan po ang exact address ng {branch}?", None),
        ("Ang tagal ng reply, 3 days na ako naghihintay.", None),
        ("Please call me, I need help with my package.", None),
        ("Salamat po, ang ganda ng resulta!", None),
        ("May slot pa po ba bukas ng hapon?", None),
        ("Hindi pa rin po resolved yung concern ko. Nakakadismaya.", None),
        ("Okay lang po, nakapag book na ako. Thanks!", None),
    ],
}


def generate(days: int = 120, per_day: float = 1.6, seed: int = 13) -> list[dict]:
    rng = random.Random(seed)
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    out, n = [], 0
    weights = {"google_business": 0.35, "facebook_page": 0.4, "messenger": 0.25}
    for d in range(days, -1, -1):
        day = now - timedelta(days=d)
        # slightly more negative feedback in the most recent 3 weeks so trends are visible
        recent = d < 21
        for _ in range(rng.choices([0, 1, 2, 3], weights=[1, 3, 3, 1.4 if recent else 1])[0] if per_day else 0):
            platform = rng.choices(list(weights), weights=list(weights.values()))[0]
            pool = TEMPLATES[platform]
            if recent:
                pool = pool + [t for t in pool if t[1] in (1, 2) or any(w in t[0].lower() for w in ("tagal", "wala pa", "seen", "update"))]
            text, rating = rng.choice(pool)
            text = text.format(svc=rng.choice(SERVICES), staff=rng.choice(STAFF), branch=rng.choice(BRANCHES))
            n += 1
            out.append({
                "platform": platform, "external_id": f"sample-{platform}-{n}", "content": text, "rating": rating,
                "author": f"sample-customer-{rng.randint(1, 60)}",
                "created_at": day + timedelta(hours=rng.randint(8, 21), minutes=rng.randint(0, 59)),
            })
    return out
