"""Response Clock API: list cases with their deadlines and act on them (assign, reply, playbook steps, notes, solve)."""
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import audit, require
from app.db import get_db
from app.models import Case, User
from app.services import cases as C

router = APIRouter(prefix="/api", tags=["response clock"])


@router.get("/cases")
def list_cases(view: Literal["open", "solved", "all"] = "open", user: User = Depends(require("feedback.view")), db: Session = Depends(get_db)):
    open_ = db.scalars(select(Case).where(Case.resolved_at.is_(None)).order_by(Case.due_at)).unique().all() if view != "solved" else []
    solved = db.scalars(select(Case).where(Case.resolved_at.is_not(None)).order_by(Case.resolved_at.desc()).limit(150)).unique().all() if view != "open" else []
    return {"items": [C.case_out(c) for c in [*open_, *solved]], "stats": C.stats(db), "team": [u.full_name for u in C.team(db)]}


class ActionIn(BaseModel):
    kind: Literal["assign", "reply", "step", "note", "solve", "reopen", "traveling"]
    assignee: str | None = Field(None, max_length=120)
    text: str | None = Field(None, max_length=1000)
    index: int | None = Field(None, ge=0)
    value: bool | None = None


@router.post("/cases/{fid}/actions")
def case_action(fid: str, body: ActionIn, request: Request, user: User = Depends(require("feedback.manage")), db: Session = Depends(get_db)):
    c = db.get(Case, fid)
    if not c:
        raise HTTPException(404, "Case not found")
    by, now = user.full_name, datetime.now(timezone.utc)
    if body.kind == "assign":
        u = next((x for x in C.team(db) if x.full_name == body.assignee), None) if body.assignee else None
        if body.assignee and not u:
            raise HTTPException(400, "Unknown team member")
        c.assignee_id = u.id if u else None
        C.add_update(c, "assigned", f"Assigned to {u.full_name}" if u else "Unassigned", by)
    elif body.kind == "reply":
        c.first_reply_at = c.first_reply_at or now
        C.add_update(c, "reply", (body.text or "").strip() or "Replied to the traveler", by)
    elif body.kind == "step":
        steps = [dict(s) for s in (c.steps or [])]
        if body.index is None or body.index >= len(steps):
            raise HTTPException(400, "Step not found")
        steps[body.index]["done"] = not steps[body.index]["done"]
        c.steps = steps
        C.add_update(c, "step", f"{'Done' if steps[body.index]['done'] else 'Not done'}: {steps[body.index]['text']}", by)
    elif body.kind == "note":
        if not (body.text or "").strip():
            raise HTTPException(400, "Write a note first.")
        C.add_update(c, "note", body.text.strip(), by)
    elif body.kind == "solve":
        C.solve(c, by, (body.text or "").strip())
        c.feedback.action_status, c.feedback.resolved_at = "resolved", c.resolved_at
    elif body.kind == "reopen":
        C.reopen(c, by)
        c.feedback.action_status, c.feedback.resolved_at = "pending_action", None
    elif body.kind == "traveling":
        c.traveling_now = bool(body.value)
        C.add_update(c, "traveling", "Marked: traveler is on the trip now" if c.traveling_now else "Marked: traveler is not on a trip", by)
    db.commit()
    audit(db, user, f"case_{body.kind}", "feedback", fid, body.model_dump(exclude_none=True), request)
    db.refresh(c)
    return C.case_out(c)
