"""Dashboard, insights, reports, integrations, notifications, users, settings and audit endpoints."""
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.api.common import filters_dep
from app.core.deps import audit, current_user, require
from app.core.security import hash_password, validate_password_strength
from app.db import get_db
from app.integrations.platforms import REGISTRY
from app.models import AIInsight, AuditLog, Feedback, GeneratedReport, Notification, Platform, Role, User
from app.nlp.pipeline import claude_key
from app.services import analytics, insights, reports
from app.services.filters import FeedbackFilters
from app.services.ingestion import PLATFORM_NAMES, seed_sample, sync_platform
from app.services.notifications import run_periodic_checks
from app.services.settings_service import DEFAULTS, all_settings, set_setting
from app.services.watch import clean_words

EMAIL_RE = re.compile(r"[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+")

router = APIRouter(prefix="/api", tags=["management"])

MIME = {"pdf": "application/pdf", "csv": "text/csv",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}


# ---------- dashboard ----------
@router.get("/dashboard")
def dashboard(f: FeedbackFilters = Depends(filters_dep), granularity: Literal["day", "week", "month", "year"] | None = None,
              user: User = Depends(require("dashboard.view")), db: Session = Depends(get_db)):
    data = analytics.dashboard(db, f, granularity)
    latest = db.scalar(select(AIInsight).order_by(AIInsight.created_at.desc()).limit(1))
    data["latest_insight"] = ({"id": latest.id, "summary": latest.summary, "engine": latest.engine,
                               "created_at": latest.created_at.isoformat(),
                               "period": {"from": latest.period_start.isoformat(), "to": latest.period_end.isoformat()}} if latest else None)
    return data


# ---------- insights ----------
@router.post("/insights/generate")
def generate_insight(request: Request, f: FeedbackFilters = Depends(filters_dep), user: User = Depends(require("insights.generate")),
                     db: Session = Depends(get_db)):
    ins = insights.generate(db, f, user.id)
    audit(db, user, "insight_generated", "insight", str(ins.id), {"engine": ins.engine}, request)
    return insight_out(ins)


def insight_out(i: AIInsight) -> dict:
    return {"id": i.id, "summary": i.summary, "aggregates": i.aggregates, "engine": i.engine, "filters": i.filters,
            "period": {"from": i.period_start.isoformat(), "to": i.period_end.isoformat()}, "created_at": i.created_at.isoformat()}


@router.get("/insights")
def list_insights(user: User = Depends(require("dashboard.view")), db: Session = Depends(get_db)):
    return [insight_out(i) for i in db.scalars(select(AIInsight).order_by(AIInsight.created_at.desc()).limit(20))]


# ---------- reports ----------
class ReportIn(BaseModel):
    report_type: Literal["overall", "platform", "negative", "positive", "complaints", "priority", "monthly", "insights"]
    file_format: Literal["pdf", "xlsx", "csv"]


@router.get("/reports/types")
def report_types(user: User = Depends(require("reports.view"))):
    return [{"code": k, "name": v} for k, v in reports.REPORT_TYPES.items()]


@router.post("/reports")
def create_report(body: ReportIn, request: Request, f: FeedbackFilters = Depends(filters_dep),
                  user: User = Depends(require("reports.generate")), db: Session = Depends(get_db)):
    if body.report_type == "platform" and not f.platform:
        raise HTTPException(400, "Choose a platform for the platform-specific report.")
    if body.report_type == "monthly" and not f.date_from:
        now = datetime.now(timezone.utc)
        f.date_from, f.date_to = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0), now
    rep = reports.build(db, body.report_type, body.file_format, f, user.id)
    audit(db, user, "report_generated", "report", str(rep.id), {"type": rep.report_type, "format": rep.file_format}, request)
    return report_out(rep)


def report_out(r: GeneratedReport) -> dict:
    return {"id": r.id, "report_type": r.report_type, "name": reports.REPORT_TYPES.get(r.report_type, r.report_type),
            "file_format": r.file_format, "period": {"from": r.period_start.isoformat(), "to": r.period_end.isoformat()},
            "created_at": r.created_at.isoformat()}


@router.get("/reports")
def list_reports(user: User = Depends(require("reports.view")), db: Session = Depends(get_db)):
    return [report_out(r) for r in db.scalars(select(GeneratedReport).order_by(GeneratedReport.created_at.desc()).limit(50))]


@router.get("/reports/{rid}/download")
def download_report(rid: int, user: User = Depends(require("reports.view")), db: Session = Depends(get_db)):
    r = db.get(GeneratedReport, rid)
    if not r or not Path(r.file_path).exists():
        raise HTTPException(404, "Report file not found")
    return FileResponse(r.file_path, media_type=MIME[r.file_format], filename=Path(r.file_path).name)


# ---------- integrations ----------
@router.get("/integrations")
def list_integrations(user: User = Depends(require("dashboard.view")), db: Session = Depends(get_db)):
    out = []
    counts = dict(db.execute(select(Feedback.platform_id, func.count(Feedback.id)).group_by(Feedback.platform_id)).all())
    samples = dict(db.execute(select(Feedback.platform_id, func.count(Feedback.id)).where(Feedback.is_sample.is_(True))
                              .group_by(Feedback.platform_id)).all())
    for p in db.scalars(select(Platform).where(Platform.code.in_(list(PLATFORM_NAMES))).order_by(Platform.id)):
        integ = REGISTRY.get(p.code)
        st = integ.status() if integ else None
        out.append({"code": p.code, "name": p.name, "status": p.status if (st is None or st.connected) else "not_connected",
                    "detail": p.status_detail or (st.detail if st else "Past feedback imported from Excel or CSV." if p.code == "import" else "Feedback added by staff."), "missing": st.missing if st else [],
                    "required_env": integ.required_env if integ else [], "docs_url": integ.docs_url if integ else "",
                    "last_sync_at": p.last_sync_at.isoformat() if p.last_sync_at else None,
                    "feedback_count": counts.get(p.id, 0), "sample_count": samples.get(p.id, 0)})
    return out


@router.post("/integrations/{code}/sync")
def sync(code: str, request: Request, user: User = Depends(require("integrations.manage")), db: Session = Depends(get_db)):
    if code not in REGISTRY:
        raise HTTPException(404, "Unknown integration")
    result = sync_platform(db, code)
    audit(db, user, "integration_sync", "platform", code, result, request)
    return result


@router.post("/sample-data")
def load_sample(request: Request, user: User = Depends(require("integrations.manage")), db: Session = Depends(get_db)):
    n = seed_sample(db)
    audit(db, user, "sample_data_loaded", "feedback", "", {"added": n}, request)
    return {"added": n}


@router.delete("/sample-data")
def clear_sample(request: Request, user: User = Depends(require("integrations.manage")), db: Session = Depends(get_db)):
    ids = list(db.scalars(select(Feedback.id).where(Feedback.is_sample.is_(True))))
    for fb in db.scalars(select(Feedback).where(Feedback.id.in_(ids))):
        db.delete(fb)
    db.commit()
    audit(db, user, "sample_data_deleted", "feedback", "", {"deleted": len(ids)}, request)
    return {"deleted": len(ids)}


# ---------- notifications ----------
@router.get("/notifications")
def notifications(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Notification).order_by(Notification.created_at.desc()).limit(50)).all()
    return {"unread": sum(1 for n in rows if user.id not in (n.read_by or [])),
            "items": [{"id": n.id, "kind": n.kind, "severity": n.severity, "title": n.title, "message": n.message,
                       "feedback_id": n.feedback_id, "read": user.id in (n.read_by or []), "created_at": n.created_at.isoformat()} for n in rows]}


@router.post("/notifications/{nid}/read")
def mark_read(nid: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    n = db.get(Notification, nid)
    if n and user.id not in (n.read_by or []):
        n.read_by = [*(n.read_by or []), user.id]
        db.commit()
    return {"ok": True}


@router.post("/notifications/read-all")
def mark_all(user: User = Depends(current_user), db: Session = Depends(get_db)):
    for n in db.scalars(select(Notification)):
        if user.id not in (n.read_by or []):
            n.read_by = [*(n.read_by or []), user.id]
    db.commit()
    return {"ok": True}


@router.post("/notifications/check")
def check_alerts(user: User = Depends(require("settings.manage")), db: Session = Depends(get_db)):
    return {"created": run_periodic_checks(db)}


# ---------- users ----------
class UserIn(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=120)
    role: Literal["SUPER_ADMIN", "ADMIN", "ANALYST", "VIEWER"]
    password: str


class UserPatch(BaseModel):
    full_name: str | None = None
    role: Literal["SUPER_ADMIN", "ADMIN", "ANALYST", "VIEWER"] | None = None
    is_active: bool | None = None
    password: str | None = None


def user_out(u: User) -> dict:
    return {"id": u.id, "email": u.email, "full_name": u.full_name, "role": u.role.name, "is_active": u.is_active,
            "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None, "created_at": u.created_at.isoformat()}


@router.get("/roles")
def roles(user: User = Depends(require("users.manage")), db: Session = Depends(get_db)):
    return [{"name": r.name, "description": r.description, "permissions": [p.code for p in r.permissions]} for r in db.scalars(select(Role))]


@router.get("/users")
def users(user: User = Depends(require("users.manage")), db: Session = Depends(get_db)):
    return [user_out(u) for u in db.scalars(select(User).order_by(User.created_at))]


@router.post("/users", status_code=201)
def create_user(body: UserIn, request: Request, user: User = Depends(require("users.manage")), db: Session = Depends(get_db)):
    if db.scalar(select(User).where(User.email == body.email.lower())):
        raise HTTPException(409, "A user with this email already exists")
    if err := validate_password_strength(body.password):
        raise HTTPException(400, err)
    role = db.scalar(select(Role).where(Role.name == body.role))
    u = User(email=body.email.lower(), full_name=body.full_name, role_id=role.id, password_hash=hash_password(body.password))
    db.add(u)
    db.commit()
    audit(db, user, "user_created", "user", u.id, {"email": u.email, "role": body.role}, request)
    return user_out(u)


@router.patch("/users/{uid}")
def update_user(uid: str, body: UserPatch, request: Request, user: User = Depends(require("users.manage")), db: Session = Depends(get_db)):
    u = db.get(User, uid)
    if not u:
        raise HTTPException(404, "User not found")
    if u.id == user.id and (body.is_active is False or (body.role and body.role != "SUPER_ADMIN")):
        raise HTTPException(400, "You cannot deactivate or demote your own account")
    changed = {}
    if body.full_name:
        u.full_name = changed["full_name"] = body.full_name
    if body.role:
        u.role_id = db.scalar(select(Role.id).where(Role.name == body.role)); changed["role"] = body.role
    if body.is_active is not None:
        u.is_active = changed["is_active"] = body.is_active
    if body.password:
        if err := validate_password_strength(body.password):
            raise HTTPException(400, err)
        u.password_hash = hash_password(body.password); changed["password"] = "reset"
    db.commit()
    audit(db, user, "user_updated", "user", u.id, changed, request)
    db.refresh(u)
    return user_out(u)


# ---------- settings ----------
@router.get("/settings")
def get_settings_(user: User = Depends(require("settings.manage")), db: Session = Depends(get_db)):
    s = all_settings(db)
    s["ai_provider"]["api_key_set"] = bool(claude_key(db))
    return s


@router.put("/settings/{key}")
def put_setting(key: str, value: dict, request: Request, user: User = Depends(require("settings.manage")), db: Session = Depends(get_db)):
    if key not in DEFAULTS:
        raise HTTPException(404, "Unknown setting")
    value.pop("api_key_set", None)
    if key == "sentiment_thresholds":
        lo, hi = int(value.get("negative_max", -25)), int(value.get("positive_min", 25))
        if not (-100 <= lo < hi <= 100):
            raise HTTPException(400, "negative_max must be lower than positive_min, both between -100 and 100")
    if key == "confidence_thresholds":
        mod, high = float(value.get("moderate", 0.7)), float(value.get("high", 0.9))
        if not (0 < mod < high <= 1):
            raise HTTPException(400, "moderate must be lower than high, both between 0 and 1")
    if key == "response_clock" and any(not isinstance(v, (int, float)) or v < 1 for v in value.values()):
        raise HTTPException(400, "Every response time must be at least 1.")
    if key == "keyword_watch":
        if not isinstance(value.get("words"), list):
            raise HTTPException(400, "Send the watch words as a list.")
        value = {"words": clean_words(value["words"])}
    if key == "weekly_report":
        emails = [x.strip() for x in str(value.get("recipients", "")).replace(";", ",").split(",") if x.strip()]
        if any(not EMAIL_RE.fullmatch(x) for x in emails) or len(emails) > 10:
            raise HTTPException(400, "Enter up to 10 valid email addresses, separated by commas.")
        value = {"enabled": bool(value.get("enabled", True)), "recipients": ", ".join(emails)}
    if key == "ai_provider" and value.get("provider") == "claude" and not claude_key(db):
        raise HTTPException(400, "Set ANTHROPIC_API_KEY on the server before switching to Claude.")
    merged = set_setting(db, key, value)
    audit(db, user, "setting_changed", "setting", key, value, request)
    return merged


# ---------- audit ----------
@router.get("/audit")
def audit_logs(page: int = 1, action: str | None = None, user: User = Depends(require("audit.view")), db: Session = Depends(get_db)):
    q = select(AuditLog).order_by(AuditLog.created_at.desc())
    if action:
        q = q.where(AuditLog.action == action)
    rows = db.scalars(q.limit(50).offset((max(page, 1) - 1) * 50)).all()
    return [{"id": r.id, "actor": r.actor_email, "action": r.action, "entity": r.entity, "entity_id": r.entity_id,
             "details": r.details, "ip": r.ip, "created_at": r.created_at.isoformat()} for r in rows]
