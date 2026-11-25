"""First-run setup: roles, permissions, platforms, first Super Admin and (optionally) labeled sample data."""
import logging

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.rbac import PERMISSIONS, ROLES
from app.core.security import hash_password
from app.models import Feedback, Permission, Role, User
from app.services.ingestion import ensure_platforms, seed_sample

log = logging.getLogger(__name__)


def ensure_rbac(db: Session) -> None:
    perms = {p.code: p for p in db.scalars(select(Permission))}
    for code, desc in PERMISSIONS.items():
        if code not in perms:
            perms[code] = Permission(code=code, description=desc)
            db.add(perms[code])
    db.flush()
    for name, (desc, codes) in ROLES.items():
        role = db.scalar(select(Role).where(Role.name == name))
        if not role:
            role = Role(name=name, description=desc)
            db.add(role)
        role.permissions = [perms[c] for c in codes]
    db.commit()


def ensure_superadmin(db: Session) -> None:
    s = get_settings()
    if db.scalar(select(func.count(User.id))):
        return
    if not s.superadmin_password:
        log.warning("No users exist. Set SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD in .env and restart to create the first account.")
        return
    role = db.scalar(select(Role).where(Role.name == "SUPER_ADMIN"))
    db.add(User(email=s.superadmin_email.lower(), full_name=s.superadmin_name, role_id=role.id,
                password_hash=hash_password(s.superadmin_password)))
    db.commit()
    log.info("Created Super Admin %s", s.superadmin_email)


def bootstrap(db: Session) -> None:
    ensure_rbac(db)
    ensure_platforms(db)
    ensure_superadmin(db)
    if get_settings().seed_sample_data and not db.scalar(select(func.count(Feedback.id))):
        n = seed_sample(db)
        log.info("Loaded %s labeled sample feedback items (no platform connected yet).", n)
