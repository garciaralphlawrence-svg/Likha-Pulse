"""Owner-only dashboards (permission owner.view = ADMIN): briefing, customer sentiment, team performance, revenue and margin."""
from typing import Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.deps import require
from app.db import get_db
from app.models import User
from app.quotes.owner import owner_report, voices_csv
from app.quotes.workflow import now_iso
from app.services.care_store import all_cases, all_messages
from app.services.requests import all_requests
from app.services.settings_service import quote_settings

router = APIRouter(prefix="/api/owner", tags=["owner"])
RangeQ = Literal["30", "90", "year", "all"]


def _report(db: Session, rng: str, destination: str, salesperson: str) -> dict:
    return owner_report(all_requests(db), {"range": rng, "destination": destination, "salesperson": salesperson}, now_iso(),
                        {"messages": all_messages(db), "cases": all_cases(db), "settings": quote_settings(db)})


@router.get("")
def report(range: RangeQ = "90", destination: str = Query("", max_length=40), salesperson: str = Query("", max_length=64),
           user: User = Depends(require("owner.view")), db: Session = Depends(get_db)):
    return _report(db, range, destination, salesperson)


@router.get("/voices.csv")
def voices(range: RangeQ = "90", destination: str = Query("", max_length=40), salesperson: str = Query("", max_length=64),
           user: User = Depends(require("owner.view")), db: Session = Depends(get_db)):
    """Every customer message with its sentiment, for Excel."""
    rep = _report(db, range, destination, salesperson)
    return Response("﻿" + voices_csv(rep["voices"]), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="paph-customer-voices-{now_iso()[:10]}.csv"'})
