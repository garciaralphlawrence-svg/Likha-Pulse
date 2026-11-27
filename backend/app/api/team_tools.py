"""Team tools: client history, suggested replies, keyword watch, team response report, weekly report and import."""
from __future__ import annotations

import base64
import binascii
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.common import client_label, feedback_out
from app.api.feedback import detail_out
from app.core.deps import audit, require
from app.db import get_db
from app.models import Feedback, ReplyTemplate, User
from app.services import cases as C
from app.services import importer, replies, team_report, weekly_report
from app.services.watch import hits, watch_words

router = APIRouter(prefix="/api", tags=["team tools"])


# ---------- client history ----------
def client_verdict(total: int, pos: int, neg: int, open_cases: int) -> str:
    if open_cases:
        return f"{open_cases} open case{'s' if open_cases > 1 else ''}: reply to this traveler first."
    if neg > pos:
        return "Mostly unhappy so far. Handle with extra care."
    if total >= 3 and pos >= 2 * max(1, neg):
        return "A loyal, happy traveler. Say thank you."
    if total == 1:
        return "First message from this traveler."
    return "Mixed feelings so far."


@router.get("/clients/{ref}")
def client_history(ref: str, user: User = Depends(require("feedback.view")), db: Session = Depends(get_db)):
    if ref == "anonymous":
        raise HTTPException(404, "Messages without a client name cannot be grouped.")
    rows = db.scalars(select(Feedback).where(Feedback.author_ref == ref).order_by(Feedback.created_at.desc())).unique().all()
    if not rows:
        raise HTTPException(404, "Client not found")
    words = watch_words(db)
    labels = [r.sentiment.final_label for r in rows if r.sentiment]
    pos, neg = labels.count("positive"), labels.count("negative")
    open_cases = [r.case for r in rows if r.case and not r.case.resolved_at]
    name = next((r.author_name for r in rows if r.author_name), None)
    platforms: dict[str, int] = {}
    for r in rows:
        platforms[r.platform.name] = platforms.get(r.platform.name, 0) + 1
    return {
        "ref": ref, "name": client_label(ref, name), "total": len(rows),
        "first_seen": rows[-1].created_at.isoformat(), "last_seen": rows[0].created_at.isoformat(),
        "moods": {"positive": pos, "neutral": labels.count("neutral"), "negative": neg},
        "avg_score": round(sum(r.sentiment.score for r in rows if r.sentiment) / max(1, len(labels)), 1),
        "platforms": platforms, "verdict": client_verdict(len(rows), pos, neg, len(open_cases)),
        "feelings": [{"at": r.created_at.isoformat(), "score": r.sentiment.score if r.sentiment else 0,
                      "sentiment": r.sentiment.final_label if r.sentiment else "neutral"} for r in reversed(rows)],
        "open_cases": [C.case_out(c) for c in sorted(open_cases, key=lambda c: C.aware(c.due_at))],
        "timeline": [feedback_out(r, watch=words) for r in rows[:300]],
    }


# ---------- suggested replies ----------
class TemplateIn(BaseModel):
    situation: str = Field(min_length=2, max_length=30)
    language: Literal["en", "tl"]
    title: str = Field(min_length=2, max_length=120)
    body: str = Field(min_length=5, max_length=2000)


def _check_situation(s: str) -> None:
    if s not in replies.SITUATIONS:
        raise HTTPException(400, "Unknown situation")


@router.get("/reply-templates")
def list_templates(user: User = Depends(require("feedback.view")), db: Session = Depends(get_db)):
    rows = db.scalars(select(ReplyTemplate).order_by(ReplyTemplate.situation, ReplyTemplate.language, ReplyTemplate.id)).all()
    return {"situations": replies.SITUATIONS, "languages": replies.LANGUAGES, "items": [replies.template_out(t) for t in rows]}


@router.post("/reply-templates", status_code=201)
def add_template(body: TemplateIn, request: Request, user: User = Depends(require("feedback.manage")), db: Session = Depends(get_db)):
    _check_situation(body.situation)
    t = ReplyTemplate(**body.model_dump(), is_default=False, updated_by=user.full_name)
    db.add(t)
    db.commit()
    audit(db, user, "reply_template_added", "reply_template", str(t.id), {"title": t.title}, request)
    return replies.template_out(t)


@router.put("/reply-templates/{tid}")
def edit_template(tid: int, body: TemplateIn, request: Request, user: User = Depends(require("feedback.manage")), db: Session = Depends(get_db)):
    _check_situation(body.situation)
    t = db.get(ReplyTemplate, tid)
    if not t:
        raise HTTPException(404, "Template not found")
    for k, v in body.model_dump().items():
        setattr(t, k, v)
    t.updated_by, t.updated_at = user.full_name, datetime.now(timezone.utc)
    db.commit()
    audit(db, user, "reply_template_edited", "reply_template", str(t.id), {"title": t.title}, request)
    return replies.template_out(t)


@router.delete("/reply-templates/{tid}")
def delete_template(tid: int, request: Request, user: User = Depends(require("feedback.manage")), db: Session = Depends(get_db)):
    t = db.get(ReplyTemplate, tid)
    if not t:
        raise HTTPException(404, "Template not found")
    db.delete(t)
    db.commit()
    audit(db, user, "reply_template_deleted", "reply_template", str(tid), {"title": t.title}, request)
    return {"deleted": tid}


@router.get("/feedback/{fid}/replies")
def suggested_replies(fid: str, user: User = Depends(require("feedback.view")), db: Session = Depends(get_db)):
    fb = db.get(Feedback, fid)
    if not fb:
        raise HTTPException(404, "Feedback not found")
    return replies.suggest(db, fb)


@router.post("/feedback/{fid}/replied")
def mark_replied(fid: str, request: Request, user: User = Depends(require("feedback.manage")), db: Session = Depends(get_db)):
    """The team replied (in Messenger or on Facebook). Records the first reply time and who handled it."""
    fb = db.get(Feedback, fid)
    if not fb:
        raise HTTPException(404, "Feedback not found")
    now = datetime.now(timezone.utc)
    fb.first_reply_at = fb.first_reply_at or now
    fb.handled_by_id = fb.handled_by_id or user.id
    if fb.case and not fb.case.first_reply_at:
        fb.case.first_reply_at = now
        C.add_update(fb.case, "reply", "Replied to the traveler", user.full_name)
    db.commit()
    audit(db, user, "feedback_replied", "feedback", fb.id, {}, request)
    db.refresh(fb)
    return detail_out(db, fb)


# ---------- keyword watch ----------
@router.get("/keyword-watch")
def keyword_watch(days: int = Query(90, ge=1, le=730), user: User = Depends(require("feedback.view")), db: Session = Depends(get_db)):
    words = watch_words(db)
    since = datetime.now(timezone.utc) - timedelta(days=days)
    matches = []
    if words:
        # narrow in SQL first (any word anywhere), then apply the word-start rule
        q = select(Feedback).where(Feedback.created_at >= since, or_(*[Feedback.content.ilike(f"%{w}%") for w in words])).order_by(Feedback.created_at.desc())
        for fb in db.scalars(q).unique().all():
            found = hits(fb.content, words)
            if found:
                matches.append(feedback_out(fb, watch=words))
    counts = {w: 0 for w in words}
    for m in matches:
        for w in m["watch_hits"]:
            counts[w] += 1
    return {"words": words, "days": days, "total": len(matches), "counts": [{"word": w, "count": n} for w, n in counts.items()],
            "items": matches[:300]}


# ---------- team response report ----------
@router.get("/team-report")
def get_team_report(months: int = Query(6, ge=1, le=24), user: User = Depends(require("reports.view")), db: Session = Depends(get_db)):
    return team_report.report(db, months)


@router.get("/team-report/csv")
def team_report_csv(request: Request, months: int = Query(6, ge=1, le=24), user: User = Depends(require("reports.view")), db: Session = Depends(get_db)):
    audit(db, user, "team_report_exported", "report", "team", {"months": months}, request)
    return Response(team_report.to_csv(db, months), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="team-response-report-{datetime.now():%Y-%m-%d}.csv"'})


# ---------- weekly report ----------
@router.get("/weekly-report")
def weekly_preview(user: User = Depends(require("reports.view")), db: Session = Depends(get_db)):
    d = weekly_report.preview(db)
    d["html"] = weekly_report.to_html(d)
    return d


@router.post("/weekly-report/send")
def weekly_send(request: Request, user: User = Depends(require("settings.manage")), db: Session = Depends(get_db)):
    r = weekly_report.send_weekly(db, force=True)
    audit(db, user, "weekly_report_sent", "report", "weekly", {"sent": r["sent"], "detail": r["detail"]}, request)
    return r


# ---------- import past feedback ----------
class ParseIn(BaseModel):
    file_name: str = Field(min_length=1, max_length=200)
    content_base64: str = Field(min_length=4, max_length=14_000_000)  # about 10 MB


class ImportIn(BaseModel):
    file_name: str = Field("", max_length=200)
    rows: list[dict[str, str | None]] = Field(min_length=1, max_length=importer.MAX_ROWS)


@router.post("/import/parse")
def import_parse(body: ParseIn, user: User = Depends(require("feedback.manage"))):
    try:
        data = base64.b64decode(body.content_base64, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(400, "The file could not be read.")
    try:
        return importer.parse_file(body.file_name, data)
    except importer.ImportFileError as e:
        raise HTTPException(400, str(e))


@router.post("/import")
def import_run(body: ImportIn, request: Request, user: User = Depends(require("feedback.manage")), db: Session = Depends(get_db)):
    try:
        result = importer.import_rows(db, [{k: (v or "") for k, v in r.items() if k in importer.FIELDS} for r in body.rows])
    except importer.ImportFileError as e:
        raise HTTPException(400, str(e))
    audit(db, user, "feedback_imported", "feedback", "", {"file": body.file_name, "imported": result["imported"],
                                                          "duplicates": result["duplicates"], "skipped": result["skipped_count"]}, request)
    return result


@router.get("/import/template.csv")
def import_template(user: User = Depends(require("feedback.view"))):
    return Response(importer.SAMPLE_CSV, media_type="text/csv", headers={"Content-Disposition": 'attachment; filename="likha-pulse-import-template.csv"'})
