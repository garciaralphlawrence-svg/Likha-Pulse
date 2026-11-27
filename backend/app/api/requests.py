"""Staff side: the sales queue, approvals, one request in full, and every workflow step (with an audit trail)."""
from typing import Literal

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import audit, require
from app.db import get_db
from app.models import TravelRequest, User
from app.quotes import views
from app.quotes import workflow as W
from app.services.requests import all_requests, to_row
from app.services.settings_service import quote_settings

router = APIRouter(prefix="/api/requests", tags=["requests"])
STAFF_ACTIONS = {a for a, spec in W.ACTIONS.items() if "CUSTOMER" not in spec["roles"]}


def actor_of(user: User) -> dict:
    return {"id": user.id, "name": user.full_name, "role": user.role.name}


@router.get("")
def list_requests(view: Literal["queue", "approval", "open", "closed", "all"] = "queue",
                  user: User = Depends(require("requests.view")), db: Session = Depends(get_db)):
    return views.list_view(all_requests(db), view, W.now_iso(), quote_settings(db))


@router.get("/{rid}")
def get_request(rid: str, user: User = Depends(require("requests.view")), db: Session = Depends(get_db)):
    row = db.get(TravelRequest, rid)
    if not row:
        raise HTTPException(404, "Request not found")
    return views.detail(row.data, user.role.name, quote_settings(db), W.now_iso())


@router.post("/{rid}/actions")
def act(rid: str, request: Request, body: dict = Body(...), user: User = Depends(require("requests.view")), db: Session = Depends(get_db)):
    """One workflow step, e.g. {"action": "submit"} or {"action": "save_offer", "lines": [...], "discount": 0}.
    The workflow checks the role (SALES drafts, AGENT approves, ADMIN both) and returns a plain 400 message when a step is not allowed."""
    action = str(body.get("action") or "")
    if action not in STAFF_ACTIONS:
        raise HTTPException(400, "Unknown action.")
    row = db.execute(select(TravelRequest).where(TravelRequest.id == rid).with_for_update()).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "Request not found")
    settings, now = quote_settings(db), W.now_iso()
    payload = {k: v for k, v in body.items() if k != "action"}
    if action == "assign":
        target = payload.get("assignee") or {}
        u = db.get(User, str(target.get("id") or ""))
        if not u or not u.is_active:
            raise HTTPException(400, "Choose an active staff member.")
        payload["assignee"] = {"id": u.id, "name": u.full_name}
    try:
        data = W.apply(row.data, action, actor_of(user), payload, now, settings)
    except W.FlowError as e:
        db.rollback()
        raise HTTPException(400, str(e))
    to_row(row, data)
    db.commit()
    last = data["events"][-1]
    audit(db, user, f"request_{action}", "request", data["ref"], {"from": last["from"], "to": last["to"], "note": last["note"][:300]}, request)
    return views.detail(data, user.role.name, settings, now)
