"""Clearly labeled SAMPLE feedback for demonstrations (is_sample = True).

Used only when no platform is connected. Every record created from here is flagged as sample data
and shown with a "Sample" badge in the interface. Delete it any time from Connections.
The templates live in sample_templates.json, shared with the browser demo.
"""
from __future__ import annotations

import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

T = json.loads((Path(__file__).parent / "sample_templates.json").read_text(encoding="utf-8"))
PLATFORM_WEIGHTS = {"google_business": 0.38, "facebook_page": 0.37, "messenger": 0.25}
COMPLAINT_HINTS = ("tagal", "wala pa", "seen", "update", "follow up", "refund", "sumasagot", "late", "pila")


def generate(days: int = 240, seed: int = 13) -> list[dict]:
    rng = random.Random(seed)
    now = datetime.now(timezone.utc)
    out, n = [], 0
    for d in range(days, -1, -1):
        day = (now - timedelta(days=d)).replace(hour=0, minute=0, second=0, microsecond=0)
        recent = d < 21  # slightly more complaints in the last 3 weeks so trends are visible
        weekend = day.weekday() >= 5
        count = rng.choices([1, 2, 3, 4, 5, 6], weights=[1, 2, 3, 3, 2, 1.5 if (recent or weekend) else 0.8])[0]
        for _ in range(count):
            platform = rng.choices(list(PLATFORM_WEIGHTS), weights=list(PLATFORM_WEIGHTS.values()))[0]
            pool = T[platform]
            if recent:
                pool = pool + [t for t in pool if t[1] in (1, 2) or any(w in t[0].lower() for w in COMPLAINT_HINTS)]
            text, rating = rng.choice(pool)
            text = text.replace("{svc}", rng.choice(T["services"])).replace("{staff}", rng.choice(T["staff"])).replace("{branch}", rng.choice(T["branches"]))
            n += 1
            out.append({
                "platform": platform, "external_id": f"sample-{platform}-{n}", "content": text, "rating": rating,
                "author": f"sample-customer-{rng.randint(1, 400)}",
                "created_at": min(day + timedelta(hours=rng.randint(8, 21), minutes=rng.randint(0, 59)), now - timedelta(minutes=rng.randint(5, 90))),
            })
    return out
