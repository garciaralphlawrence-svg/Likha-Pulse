"""Stores travel requests: reference numbers, saving the request dict, and the labeled sample requests."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import RefCounter, TravelRequest, uid
from app.quotes import workflow as W
from app.quotes.workflow import iso, parse_iso


def next_seq(db: Session, year: int) -> int:
    """Next number for this year. Row lock on PostgreSQL so two requests never get the same reference."""
    row = db.execute(select(RefCounter).where(RefCounter.year == year).with_for_update()).scalar_one_or_none()
    if not row:
        row = RefCounter(year=year, last=0)
        db.add(row)
    row.last += 1
    db.flush()
    return row.last


def to_row(row: TravelRequest | None, data: dict) -> TravelRequest:
    row = row or TravelRequest(id=data["id"], ref=data["ref"])
    row.status = data["status"]
    row.customer_name = data["customer"]["name"]
    row.contact = data["customer"]["contact"]
    row.destination = data["input"].get("destination")
    row.assignee_id = (data.get("assignee") or {}).get("id")
    row.is_sample = data["is_sample"]
    row.created_at = parse_iso(data["created_at"])
    row.updated_at = parse_iso(data["updated_at"])
    row.data = data
    return row


def create(db: Session, *, customer: dict, raw_text: str, input: dict, addons: list[str], settings: dict, now: str | None = None,
           is_sample: bool = False) -> dict:
    now = now or W.now_iso()
    seq = next_seq(db, int(now[:4]))
    data = W.create_request(id=uid(), seq=seq, now=now, customer=customer, raw_text=raw_text, input=input, addons=addons,
                            is_sample=is_sample, settings=settings)
    db.add(to_row(None, data))
    db.commit()
    return data


def all_requests(db: Session) -> list[dict]:
    return [r.data for r in db.scalars(select(TravelRequest).order_by(TravelRequest.created_at))]


# ---------- labeled sample requests (no real customers) ----------
SAMPLE_SALES = {"id": "sample-sales", "name": "Mia (sample salesperson)", "role": "SALES"}
SAMPLE_AGENT = {"id": "sample-agent", "name": "Paolo (sample agent)", "role": "AGENT"}
SAMPLES = [
    # (hours ago, name, contact, free text, form input, add-ons, steps through the workflow)
    (2, "Sample customer: Andrea", "0917 555 0101", "gusto ko pumunta London 10 days, 5 star hotel",
     {"destination": "london", "days": 10, "adults": 1, "tier": "luxury"}, ["insurance"], []),
    (30, "Sample customer: Ben", "0917 555 0102", "budget friendly London 10 days ₱80,000",
     {"destination": "london", "days": 10, "adults": 1, "tier": "budget", "budget": 80000}, [], []),
    (5, "Sample customer: Carla", "carla.sample@example.com", "budget friendly lang, Japan 5 days, 2 adults 1 kid, December",
     {"destination": "japan", "days": 5, "adults": 2, "kids": 1, "tier": "budget", "month": 12, "interests": ["theme_parks"]}, ["wifi"], ["start_offer"]),
    (20, "Sample customer: Dan", "0917 555 0104", "Seoul 4 nights kami ng asawa ko, 60k each, April",
     {"destination": "seoul", "days": 5, "adults": 2, "budget": 60000, "budget_per_person": True, "month": 4}, [], ["start_offer", "submit"]),
    (44, "Sample customer: Elle", "0917 555 0105", "Boracay isang linggo, barkada kami 6 tao, mura lang",
     {"destination": "boracay", "days": 7, "adults": 6, "tier": "budget", "month": 8}, [], ["start_offer", "submit", "request_changes"]),
    (70, "Sample customer: Franco", "0917 555 0106", "Honeymoon in Bali, 7 days, luxury villa please",
     {"destination": "bali", "days": 7, "adults": 2, "tier": "luxury", "interests": ["romance"]}, ["insurance"], ["start_offer", "submit", "approve", "send"]),
    (120, "Sample customer: Gina", "0917 555 0107", "Singapore 4 days, family of 4, Universal Studios",
     {"destination": "singapore", "days": 4, "adults": 2, "kids": 2, "tier": "mid", "interests": ["theme_parks"]}, [],
     ["start_offer", "submit", "approve", "send", "customer_accept", "mark_booked"]),
    (160, "Sample customer: Hugo", "0917 555 0108", "Dubai 5 days, 2 adults, 4 star",
     {"destination": "dubai", "days": 5, "adults": 2, "tier": "mid"}, [], ["start_offer", "submit", "approve", "send", "mark_lost"]),
    (90, "Sample customer: Isa", "0917 555 0109", "Hong Kong Disneyland 3 days, 2 adults 2 kids",
     {"destination": "hongkong", "days": 3, "adults": 2, "kids": 2, "tier": "mid", "interests": ["theme_parks"]}, [],
     ["start_offer", "submit", "approve", "send", "customer_accept"]),
    (60, "Sample customer: Jules", "0917 555 0110", "Paris 7 days, 5 star, 2 adults, December",
     {"destination": "paris", "days": 7, "adults": 2, "tier": "luxury", "month": 12}, [], ["start_offer", "submit", "decline"]),
]
NOTES = {"request_changes": "Please use a cheaper hotel area and drop one tour.",
         "decline": "Dates are fully booked with our partners; offer another month."}


def sample_staff(db: Session) -> dict:
    """Labeled sample staff (two salespeople, one agent) so the sample history has a team. Random passwords: nobody can sign in as them."""
    import secrets

    from app.core.security import hash_password
    from app.models import Role, User

    want = [("sample.sales1@example.com", "Mia (sample salesperson)", "SALES"), ("sample.sales2@example.com", "Rico (sample salesperson)", "SALES"),
            ("sample.agent@example.com", "Paolo (sample agent)", "AGENT")]
    actors = []
    for email, name, role in want:
        u = db.scalar(select(User).where(User.email == email))
        if not u:
            u = User(email=email, full_name=name, role_id=db.scalar(select(Role.id).where(Role.name == role)),
                     password_hash=hash_password(secrets.token_urlsafe(32)))
            db.add(u)
            db.flush()
        actors.append({"id": u.id, "name": u.full_name, "role": role})
    db.commit()
    return {"sales": actors[:2], "agent": actors[2]}


def seed_history(db: Session, settings: dict, people: dict) -> int:
    """About 6 months of closed sample requests (booked, lost, declined) for the owner dashboards."""
    from app.quotes.history import generate_history

    year = datetime.now(timezone.utc).year
    first = (db.get(RefCounter, year).last if db.get(RefCounter, year) else 0) + 1
    hist = generate_history(W.now_iso(), people, first, settings)
    top: dict[int, int] = {}
    for r in hist:
        db.add(to_row(None, r))
        y, n = int(r["ref"][5:9]), int(r["ref"][-4:])
        top[y] = max(top.get(y, 0), n)
    for y, n in top.items():
        row = db.get(RefCounter, y) or RefCounter(year=y, last=0)
        row.last = max(row.last or 0, n)
        db.add(row)
    db.commit()
    return len(hist)


def seed_samples(db: Session, settings: dict, people: dict | None = None) -> int:
    """Live sample requests across the whole flow (the sales queue, approvals, offers out)."""
    sales = people["sales"][0] if people else SAMPLE_SALES
    agent_actor = people["agent"] if people else SAMPLE_AGENT
    base = datetime.now(timezone.utc)
    for hours, name, contact, text, inp, addons, steps in SAMPLES:
        t0 = base - timedelta(hours=hours)
        r = create(db, customer={"name": name, "contact": contact}, raw_text=text, input=inp, addons=addons, settings=settings,
                   now=iso(t0), is_sample=True)
        for i, step in enumerate(steps):
            if step in ("approve", "request_changes", "decline"):
                actor = agent_actor
            elif step.startswith("customer_"):
                actor = {"id": "customer", "name": name, "role": "CUSTOMER"}
            else:
                actor = sales
            payload = {"note": NOTES.get(step, "")}
            if step == "mark_lost":
                payload["reason"] = "other_agency"
            r = W.apply(r, step, actor, payload, iso(t0 + timedelta(minutes=40 * (i + 1))), settings)
        to_row(db.get(TravelRequest, r["id"]), r)
        db.commit()
    return len(SAMPLES)
