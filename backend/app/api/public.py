"""Customer side (no login): read a request in plain words, get the AI estimate, send it to PAPH, and track it.
Tracking needs the reference number AND the same mobile number or email, so nobody can browse other people's requests."""
import re
import time
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.deps import audit
from app.db import get_db
from app.models import TravelRequest
from app.quotes import engine as E
from app.quotes import views
from app.quotes import workflow as W
from app.services import requests as store
from app.services.settings_service import quote_settings

router = APIRouter(prefix="/api/public", tags=["public"])
NOT_FOUND = "We couldn't find a request with that reference number and contact."
CUSTOMER_ACTIONS = {a for a, spec in W.ACTIONS.items() if "CUSTOMER" in spec["roles"]}
_hits: dict[str, list[float]] = defaultdict(list)


def rate_limit(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    recent = [t for t in _hits[ip] if now - t < 60]
    if len(recent) >= get_settings().public_rate_limit:
        _hits[ip] = recent
        raise HTTPException(429, "Too many requests. Please wait a minute and try again.")
    _hits[ip] = recent + [now]


def clean_input(raw: dict | None) -> dict:
    """Only known fields with sensible values reach the engine."""
    raw = raw or {}
    out: dict = {}

    def num(k, lo, hi, cast=int):
        v = raw.get(k)
        if v is None or v == "":
            return None
        if isinstance(v, bool) or not isinstance(v, (int, float)) or not (lo <= v <= hi):
            raise HTTPException(400, f"Please check the {k.replace('_', ' ')}.")
        return cast(v)

    dest = raw.get("destination")
    out["destination"] = dest if E.dest_by_code(dest) else None
    place = raw.get("place_text")
    out["place_text"] = str(place).strip()[:80] if place else None
    out["days"] = num("days", 1, 60)
    out["adults"] = num("adults", 0, 50)
    out["kids"] = num("kids", 0, 50)
    tier = raw.get("tier")
    out["tier"] = tier if tier in E.TIERS else None
    out["budget"] = num("budget", 0, 1_000_000_000, float)
    out["budget_per_person"] = bool(raw.get("budget_per_person"))
    out["month"] = num("month", 1, 12)
    td = raw.get("travel_date")
    out["travel_date"] = td if isinstance(td, str) and re.fullmatch(r"20\d\d-\d\d-\d\d", td) else None
    out["interests"] = [i for i in (raw.get("interests") or []) if i in E.CATALOG["interests"]][:12] if isinstance(raw.get("interests"), list) else []
    return out


class ParseIn(BaseModel):
    text: str = Field(max_length=2000)


class EstimateIn(BaseModel):
    text: str | None = Field(None, max_length=2000)
    input: dict | None = None


class CustomerIn(BaseModel):
    name: str = Field(max_length=120)
    contact: str = Field(max_length=160)


class NewRequestIn(BaseModel):
    customer: CustomerIn
    raw_text: str = Field("", max_length=2000)
    input: dict
    addons: list[str] = Field(default_factory=list, max_length=40)


class CustomerActionIn(BaseModel):
    contact: str = Field(max_length=160)
    action: str
    note: str = Field("", max_length=1000)
    rating: float | None = None


@router.post("/parse")
def parse(body: ParseIn, _: None = Depends(rate_limit)):
    return E.parse_request(body.text, E.today_iso())


@router.post("/estimate")
def estimate(body: EstimateIn, _: None = Depends(rate_limit), db: Session = Depends(get_db)):
    """The AI recommendation without saving anything. Send {"text": "..."} and/or {"input": {...}} (input wins)."""
    parsed = E.parse_request(body.text, E.today_iso()) if body.text else {}
    if body.input:
        parsed = {**parsed, **{k: v for k, v in clean_input(body.input).items() if v not in (None, [])}}
    return E.recommend(parsed, W.rules_from(quote_settings(db)))


@router.post("/requests", status_code=201)
def submit(body: NewRequestIn, request: Request, _: None = Depends(rate_limit), db: Session = Depends(get_db)):
    try:
        data = store.create(db, customer=body.customer.model_dump(), raw_text=body.raw_text, input=clean_input(body.input),
                            addons=[str(a)[:40] for a in body.addons], settings=quote_settings(db))
    except W.FlowError as e:
        raise HTTPException(400, str(e))
    audit(db, None, "request_submitted", "request", data["ref"], {"destination": data["input"]["destination"]}, request)
    return {"ref": data["ref"], "contact": data["customer"]["contact"]}


def _find(db: Session, ref: str, contact: str, lock: bool = False) -> TravelRequest:
    q = select(TravelRequest).where(TravelRequest.ref == ref.strip().upper())
    row = db.execute(q.with_for_update() if lock else q).scalar_one_or_none()
    if not row or not views.contact_matches(row.contact, contact):
        raise HTTPException(404, NOT_FOUND)
    return row


@router.get("/requests/{ref}")
def track(ref: str, contact: str = Query("", max_length=160), db: Session = Depends(get_db)):
    row = _find(db, ref, contact)
    return views.public_view(row.data, quote_settings(db), W.now_iso())


@router.post("/requests/{ref}/actions")
def customer_action(ref: str, body: CustomerActionIn, request: Request, _: None = Depends(rate_limit), db: Session = Depends(get_db)):
    if body.action not in CUSTOMER_ACTIONS:
        raise HTTPException(400, "Unknown action.")
    row = _find(db, ref, body.contact, lock=True)
    settings, now = quote_settings(db), W.now_iso()
    actor = {"id": "customer", "name": row.data["customer"]["name"], "role": "CUSTOMER"}
    try:
        data = W.apply(row.data, body.action, actor, {"note": body.note, "rating": body.rating}, now, settings)
    except W.FlowError as e:
        db.rollback()
        raise HTTPException(400, str(e))
    store.to_row(row, data)
    db.commit()
    audit(db, None, f"request_{body.action}", "request", data["ref"], {"to": data["status"]}, request)
    return views.public_view(data, settings, now)
