import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.deps import audit, current_user, user_perms
from app.core.security import (create_access_token, hash_password, hash_token, new_reset_token,
                               validate_password_strength, verify_password)
from app.db import get_db
from app.models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])
log = logging.getLogger(__name__)
_failed: dict[str, list[datetime]] = {}


class LoginIn(BaseModel):
    email: EmailStr
    password: str


def me_out(u: User) -> dict:
    return {"id": u.id, "email": u.email, "full_name": u.full_name, "role": u.role.name, "permissions": sorted(user_perms(u))}


@router.post("/login")
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
    key = body.email.lower()
    now = datetime.now(timezone.utc)
    recent = [t for t in _failed.get(key, []) if now - t < timedelta(minutes=15)]
    if len(recent) >= 5:
        raise HTTPException(429, "Too many failed attempts. Try again in 15 minutes.")
    user = db.scalar(select(User).where(User.email == key))
    if not user or not user.is_active or not verify_password(body.password, user.password_hash):
        _failed[key] = recent + [now]
        audit(db, None, "login_failed", "user", "", {"email": key}, request)
        raise HTTPException(401, "Incorrect email or password")
    _failed.pop(key, None)
    user.last_login_at = now
    db.commit()
    audit(db, user, "login", "user", user.id, {}, request)
    return {"access_token": create_access_token(user.id, user.role.name), "token_type": "bearer", "user": me_out(user)}


@router.get("/me")
def me(user: User = Depends(current_user)):
    return me_out(user)


class ChangeIn(BaseModel):
    current_password: str
    new_password: str


@router.post("/change-password")
def change_password(body: ChangeIn, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(400, "Current password is incorrect")
    if err := validate_password_strength(body.new_password):
        raise HTTPException(400, err)
    user.password_hash = hash_password(body.new_password)
    db.commit()
    audit(db, user, "password_changed", "user", user.id, {}, request)
    return {"ok": True}


class ForgotIn(BaseModel):
    email: EmailStr


@router.post("/forgot-password")
def forgot(body: ForgotIn, request: Request, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if user and user.is_active:
        raw, hashed = new_reset_token()
        user.reset_token_hash, user.reset_token_expires = hashed, datetime.now(timezone.utc) + timedelta(minutes=30)
        db.commit()
        # No email is sent from this server: the Owner can also reset passwords in Team. In development the code is logged.
        if get_settings().environment != "production":
            log.warning("DEV ONLY - password reset token for %s: %s", user.email, raw)
        audit(db, user, "password_reset_requested", "user", user.id, {}, request)
    return {"ok": True, "message": "If the account exists, reset instructions were sent."}


class ResetIn(BaseModel):
    email: EmailStr
    token: str
    new_password: str


@router.post("/reset-password")
def reset(body: ResetIn, request: Request, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    exp = user.reset_token_expires if user else None
    if exp and exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if not user or not user.reset_token_hash or user.reset_token_hash != hash_token(body.token) or not exp or exp < datetime.now(timezone.utc):
        raise HTTPException(400, "Invalid or expired reset code")
    if err := validate_password_strength(body.new_password):
        raise HTTPException(400, err)
    user.password_hash, user.reset_token_hash, user.reset_token_expires = hash_password(body.new_password), None, None
    db.commit()
    audit(db, user, "password_reset", "user", user.id, {}, request)
    return {"ok": True}
