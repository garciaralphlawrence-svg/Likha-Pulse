"""Dashboard, sample rates, staff, users, settings and activity log."""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import audit, require
from app.core.security import hash_password, validate_password_strength
from app.db import get_db
from app.models import AuditLog, Role, User
from app.quotes import views
from app.quotes.engine import CATALOG
from app.quotes.workflow import now_iso
from app.services.requests import all_requests
from app.services.settings_service import quote_settings, set_setting, validate_quote_settings

router = APIRouter(prefix="/api", tags=["management"])
RoleName = Literal["ADMIN", "AGENT", "SALES"]


@router.get("/dashboard")
def dashboard(user: User = Depends(require("dashboard.view")), db: Session = Depends(get_db)):
    return views.dashboard(all_requests(db), now_iso(), quote_settings(db))


@router.get("/catalog")
def catalog(user: User = Depends(require("catalog.view"))):
    """The sample rates the AI uses (replace backend/app/quotes/catalog.json with PAPH's real rates)."""
    return CATALOG


@router.get("/staff")
def staff(user: User = Depends(require("requests.view")), db: Session = Depends(get_db)):
    """Active staff, for assigning requests."""
    rows = db.scalars(select(User).where(User.is_active.is_(True)).order_by(User.full_name))
    return [{"id": u.id, "name": u.full_name, "role": u.role.name} for u in rows]


# ---------- users ----------
class UserIn(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=120)
    role: RoleName
    password: str


class UserPatch(BaseModel):
    full_name: str | None = Field(None, min_length=2, max_length=120)
    role: RoleName | None = None
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
    if u.id == user.id and (body.is_active is False or (body.role and body.role != "ADMIN")):
        raise HTTPException(400, "You cannot turn off or demote your own account")
    changed = {}
    if body.full_name:
        u.full_name = changed["full_name"] = body.full_name
    if body.role:
        u.role_id = db.scalar(select(Role.id).where(Role.name == body.role))
        changed["role"] = body.role
    if body.is_active is not None:
        u.is_active = changed["is_active"] = body.is_active
    if body.password:
        if err := validate_password_strength(body.password):
            raise HTTPException(400, err)
        u.password_hash = hash_password(body.password)
        changed["password"] = "reset"
    db.commit()
    audit(db, user, "user_updated", "user", u.id, changed, request)
    db.refresh(u)
    return user_out(u)


# ---------- settings ----------
@router.get("/settings")
def get_settings_(user: User = Depends(require("requests.view")), db: Session = Depends(get_db)):
    """Quotation terms. Every staff member can read them (they shape the offer); only the Owner can change them."""
    return quote_settings(db)


@router.put("/settings")
def put_settings(value: dict, request: Request, user: User = Depends(require("settings.manage")), db: Session = Depends(get_db)):
    try:
        clean = validate_quote_settings({**quote_settings(db), **value})
    except ValueError as e:
        raise HTTPException(400, str(e))
    merged = set_setting(db, "quotes", clean)
    audit(db, user, "settings_changed", "setting", "quotes", clean, request)
    return merged


# ---------- activity ----------
@router.get("/audit")
def audit_logs(page: int = 1, action: str | None = None, user: User = Depends(require("audit.view")), db: Session = Depends(get_db)):
    q = select(AuditLog).order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
    if action:
        q = q.where(AuditLog.action == action)
    rows = db.scalars(q.limit(50).offset((max(page, 1) - 1) * 50)).all()
    return [{"id": r.id, "actor": r.actor_email, "action": r.action, "entity": r.entity, "entity_id": r.entity_id,
             "details": r.details, "created_at": r.created_at.isoformat()} for r in rows]
