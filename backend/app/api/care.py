"""Customer care: Facebook/Messenger messages, the Response Clock (cases), client history, suggested replies,
keyword watch, team and weekly reports, importing past messages, and the Facebook/Messenger connections."""
from typing import Literal

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import audit, require
from app.db import get_db
from app.models import CaseRecord, CustomerMessage, ReplyTemplate, SystemSetting, TravelRequest, User
from app.quotes import care as C
from app.quotes import clock as K
from app.quotes.engine import parse_request
from app.quotes.workflow import FlowError, now_iso
from app.services import care_store as store
from app.services import requests as req_store
from app.services.requests import all_requests
from app.services.settings_service import quote_settings

router = APIRouter(prefix="/api", tags=["customer care"])
RANK = {"overdue": 0, "red": 1, "orange": 2, "yellow": 3, "green": 4}


def actor_of(user: User) -> dict:
    return {"id": user.id, "name": user.full_name, "role": user.role.name}


def staff_list(db: Session) -> list[dict]:
    return [{"id": u.id, "name": u.full_name, "role": u.role.name} for u in db.scalars(select(User).where(User.is_active.is_(True)).order_by(User.full_name))]


def ref_lookup(db: Session):
    refs = {r.id: r.ref for r in db.scalars(select(TravelRequest))}
    return lambda rid: refs.get(rid)


# ---------- messages ----------
@router.get("/messages")
def messages(view: Literal["waiting", "all"] = "waiting", user: User = Depends(require("requests.view")), db: Session = Depends(get_db)):
    """waiting = no reply yet, most urgent first; all = newest first (300 max)."""
    s, now, ref_of = quote_settings(db), now_iso(), ref_lookup(db)
    vs = [C.message_view(m, now, s, ref_of) for m in store.all_messages(db)]
    if view == "waiting":
        vs = sorted([v for v in vs if v["clock"]], key=lambda v: v["clock"]["opened_at"])
        return sorted(vs, key=lambda v: RANK[v["clock"]["stage"]])
    return sorted(vs, key=lambda v: v["at"], reverse=True)[:300]


@router.post("/messages/{mid}/actions")
def message_action(mid: str, request: Request, body: dict = Body(...), user: User = Depends(require("requests.view")), db: Session = Depends(get_db)):
    action = body.get("action")
    if action not in ("reply", "open_case", "make_request"):
        raise HTTPException(400, "Unknown action.")
    row = db.execute(select(CustomerMessage).where(CustomerMessage.id == mid).with_for_update()).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "Message not found.")
    s, now, actor = quote_settings(db), now_iso(), actor_of(user)
    m = row.data
    if action == "reply":
        m = C.mark_replied(m, actor, now)
    elif action == "open_case":
        if m["case_id"] and (c := db.get(CaseRecord, m["case_id"])) and not c.resolved_at:
            raise HTTPException(400, "A case is already open for this message.")
        c = K.open_case(id=store.next_case_id(db), now=now, source="message", text=m["text"], client=m["client"], client_key=m["client_key"],
                        by=user.full_name, message_id=m["id"], owner=None if user.role.name == "ADMIN" else {"id": user.id, "name": user.full_name},
                        is_sample=m["is_sample"], s=s)
        db.add(store.case_row(None, c))
        m = {**m, "case_id": c["id"]}
    else:
        if m["request_id"]:
            raise HTTPException(400, "This message already has a quotation request.")
        where = "Messenger" if m["channel"] == "messenger" else "Facebook"
        try:
            r = req_store.create(db, customer={"name": m["client"], "contact": f"{where}: {m['client']}"}, raw_text=m["text"],
                                 input=parse_request(m["text"], now), addons=[], settings=s, now=now, is_sample=m["is_sample"])
        except FlowError as e:
            raise HTTPException(400, str(e))
        m = {**C.mark_replied(m, actor, now), "request_id": r["id"]}
    store.msg_row(row, m)
    db.commit()
    audit(db, user, f"message_{action}", "message", m["id"], {}, request)
    return C.message_view(m, now, s, ref_lookup(db))


# ---------- Response Clock ----------
@router.get("/cases")
def cases(view: Literal["open", "solved"] = "open", user: User = Depends(require("requests.view")), db: Session = Depends(get_db)):
    now = now_iso()
    assignee_of = store.request_assignees(db)
    visible = [c for c in store.all_cases(db) if store.can_see(user, c, assignee_of)]
    if view == "open":
        items = K.sort_cases([K.case_view(c, now) for c in visible if not c["resolved_at"]])
    else:
        items = sorted([K.case_view(c, now) for c in visible if c["resolved_at"]], key=lambda v: v["resolved_at"], reverse=True)[:100]
    return {"items": items, "stats": K.clock_stats(visible, now, K.add_ms(now, -90 * 86400000)), "team": staff_list(db)}


class OpenCaseIn(BaseModel):
    request_id: str | None = None
    message_id: str | None = None
    text: str = Field(min_length=1, max_length=2000)
    source: Literal["request", "message", "feedback", "manual"] = "manual"


@router.post("/cases", status_code=201)
def open_case(body: OpenCaseIn, request: Request, user: User = Depends(require("requests.view")), db: Session = Depends(get_db)):
    r = db.get(TravelRequest, body.request_id).data if body.request_id and db.get(TravelRequest, body.request_id) else None
    mrow = db.get(CustomerMessage, body.message_id) if body.message_id else None
    m = mrow.data if mrow else None
    rid, mid = (r or {}).get("id"), (m or {}).get("id")
    if any(not c["resolved_at"] and c["text"] == body.text and c["request_id"] == rid and c["message_id"] == mid for c in store.all_cases(db)):
        raise HTTPException(400, "A case is already open for this message.")
    owner = (r or {}).get("assignee") or (None if user.role.name == "ADMIN" else {"id": user.id, "name": user.full_name})
    c = K.open_case(id=store.next_case_id(db), now=now_iso(), source=body.source, text=body.text,
                    client=r["customer"]["name"] if r else m["client"] if m else "Customer",
                    client_key=C.contact_key(r["customer"]["contact"]) if r else m["client_key"] if m else "n:customer", by=user.full_name,
                    request={"id": r["id"], "ref": r["ref"]} if r else None, message_id=mid, owner=owner,
                    is_sample=r["is_sample"] if r else m["is_sample"] if m else False, s=quote_settings(db))
    db.add(store.case_row(None, c))
    if mrow:
        store.msg_row(mrow, {**m, "case_id": c["id"]})
    db.commit()
    audit(db, user, "case_opened", "case", c["id"], {"source": body.source}, request)
    return K.case_view(c, now_iso())


@router.post("/cases/{cid}/actions")
def case_action(cid: str, request: Request, body: dict = Body(...), user: User = Depends(require("requests.view")), db: Session = Depends(get_db)):
    action = str(body.get("action") or "")
    if action not in K.CASE_ACTIONS:
        raise HTTPException(400, "Unknown step.")
    row = db.execute(select(CaseRecord).where(CaseRecord.id == cid).with_for_update()).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "Case not found.")
    payload = {k: body.get(k) for k in ("note", "index", "value") if k in body}
    if action == "assign":
        target = db.get(User, str((body.get("assignee") or {}).get("id") or ""))
        if not target or not target.is_active:
            raise HTTPException(400, "Choose an active staff member.")
        payload["assignee"] = {"id": target.id, "name": target.full_name}
    c = row.data
    assignee = db.get(TravelRequest, c["request_id"]).assignee_id if c["request_id"] and db.get(TravelRequest, c["request_id"]) else None
    try:
        nxt = K.case_act(c, action, actor_of(user), payload, now_iso(), quote_settings(db), assignee)
    except K.CaseError as e:
        db.rollback()
        raise HTTPException(400, str(e))
    store.case_row(row, nxt)
    db.commit()
    audit(db, user, f"case_{action}", "case", cid, {}, request)
    return K.case_view(nxt, now_iso())


# ---------- client history ----------
@router.get("/clients/{key:path}")
def client(key: str, user: User = Depends(require("requests.view")), db: Session = Depends(get_db)):
    return C.client_history(key, all_requests(db), store.all_messages(db), store.all_cases(db), now_iso())


# ---------- suggested replies ----------
class TemplateIn(BaseModel):
    situation: str = Field(min_length=1, max_length=40)
    language: Literal["en", "tl"] = "en"
    title: str = Field(max_length=120)
    body: str = Field(max_length=2000)


@router.get("/reply-templates")
def templates(user: User = Depends(require("requests.view")), db: Session = Depends(get_db)):
    return [store.template_out(t) for t in db.scalars(select(ReplyTemplate).order_by(ReplyTemplate.situation, ReplyTemplate.language, ReplyTemplate.id))]


def _save_template(t: ReplyTemplate, body: TemplateIn, user: User) -> None:
    if not body.title.strip() or not body.body.strip():
        raise HTTPException(400, "Give the reply a title and a message.")
    if body.situation not in C.REPLY_SITUATIONS:
        raise HTTPException(400, "Choose one of the listed situations.")
    t.situation, t.language, t.title, t.body = body.situation, body.language, body.title.strip(), body.body.strip()
    t.is_default, t.updated_by = False, user.full_name


@router.post("/reply-templates", status_code=201)
def add_template(body: TemplateIn, request: Request, user: User = Depends(require("replies.manage")), db: Session = Depends(get_db)):
    t = ReplyTemplate()
    _save_template(t, body, user)
    db.add(t)
    db.commit()
    audit(db, user, "template_saved", "template", str(t.id), {}, request)
    return store.template_out(t)


@router.put("/reply-templates/{tid}")
def edit_template(tid: int, body: TemplateIn, request: Request, user: User = Depends(require("replies.manage")), db: Session = Depends(get_db)):
    t = db.get(ReplyTemplate, tid)
    if not t:
        raise HTTPException(404, "Reply not found.")
    _save_template(t, body, user)
    db.commit()
    audit(db, user, "template_saved", "template", str(t.id), {}, request)
    return store.template_out(t)


@router.delete("/reply-templates/{tid}", status_code=204)
def delete_template(tid: int, request: Request, user: User = Depends(require("replies.manage")), db: Session = Depends(get_db)):
    t = db.get(ReplyTemplate, tid)
    if not t:
        raise HTTPException(404, "Reply not found.")
    db.delete(t)
    db.commit()
    audit(db, user, "template_deleted", "template", str(tid), {}, request)
    return Response(status_code=204)


# ---------- owner reports ----------
@router.get("/keyword-watch")
def keyword_watch(days: int = Query(30, ge=1, le=365), user: User = Depends(require("owner.view")), db: Session = Depends(get_db)):
    return C.keyword_watch(all_requests(db), store.all_messages(db), quote_settings(db)["watch_words"], days, now_iso())


def _team(db: Session, months: int) -> dict:
    return C.team_report(all_requests(db), store.all_messages(db), store.all_cases(db), months, now_iso())


@router.get("/team-report")
def team_report(months: int = Query(3, ge=1, le=24), user: User = Depends(require("owner.view")), db: Session = Depends(get_db)):
    return _team(db, months)


@router.get("/team-report/csv")
def team_report_csv(months: int = Query(3, ge=1, le=24), user: User = Depends(require("owner.view")), db: Session = Depends(get_db)):
    return Response("﻿" + C.team_report_csv(_team(db, months)["rows"]), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="paph-team-report-{now_iso()[:10]}.csv"'})


@router.get("/weekly-report")
def weekly_report(user: User = Depends(require("owner.view")), db: Session = Depends(get_db)):
    return C.weekly_report(all_requests(db), store.all_messages(db), store.all_cases(db), quote_settings(db), now_iso())


@router.post("/weekly-report/send")
def weekly_send(request: Request, user: User = Depends(require("owner.view")), db: Session = Depends(get_db)):
    out = store.send_weekly(db, quote_settings(db), all_requests(db))
    audit(db, user, "weekly_report_sent" if out["sent"] else "weekly_report_logged", "report", "", out, request)
    return out


# ---------- import past messages ----------
class ImportIn(BaseModel):
    file_name: str = Field("", max_length=200)
    rows: list[dict] = Field(max_length=C.MAX_IMPORT_ROWS + 1)


@router.post("/import")
def import_rows(body: ImportIn, request: Request, user: User = Depends(require("import.manage")), db: Session = Depends(get_db)):
    """Rows {date, client, message, channel} already read from the Excel/CSV file in the browser. Names are kept as written in the file."""
    out = C.import_rows(store.all_messages(db), body.rows, now_iso(), lambda i: store.next_msg_id(db))
    for m in out["added"]:
        db.add(store.msg_row(None, m))
    db.commit()
    audit(db, user, "import", "file", body.file_name, {"imported": out["result"]["imported"]}, request)
    return out["result"]


# ---------- connections ----------
@router.get("/integrations")
def integrations(user: User = Depends(require("requests.view")), db: Session = Depends(get_db)):
    from app.integrations.platforms import REGISTRY

    state = (db.get(SystemSetting, "integrations").value if db.get(SystemSetting, "integrations") else {}) or {}
    msgs = store.all_messages(db)

    def count(code, sample=None):
        return sum(1 for m in msgs if m["channel"] == code and (sample is None or m["is_sample"] == sample))

    out = []
    for code, integ in REGISTRY.items():
        st = integ.status()
        err = (state.get(code) or {}).get("error")
        out.append({"code": code, "name": integ.name, "status": "error" if st.connected and err else "connected" if st.connected else "not_connected",
                    "detail": err or st.detail, "missing": st.missing, "required_env": integ.required_env, "docs_url": integ.docs_url,
                    "last_sync_at": (state.get(code) or {}).get("last_sync_at"), "message_count": count(code), "sample_count": count(code, True)})
    out.append({"code": "import", "name": "Imported files (Excel or CSV)", "status": "connected",
                "detail": "Always available. Past messages you import count in sentiment and reports.", "missing": [], "required_env": [], "docs_url": "",
                "last_sync_at": None, "message_count": count("import"), "sample_count": 0})
    return out


@router.post("/integrations/{code}/sync")
def sync(code: str, request: Request, user: User = Depends(require("integrations.manage")), db: Session = Depends(get_db)):
    out = store.sync_platform(db, code, quote_settings(db))
    audit(db, user, "integration_sync", "integration", code, out, request)
    return out
