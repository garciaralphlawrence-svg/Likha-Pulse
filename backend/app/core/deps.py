from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db import get_db
from app.models import AuditLog, User

bearer = HTTPBearer(auto_error=False)


def current_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)) -> User:
    if not creds:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        payload = decode_token(creds.credentials)
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired or invalid. Please log in again.")
    user = db.get(User, payload.get("sub"))
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account not found or inactive")
    return user


def user_perms(user: User) -> set[str]:
    return {p.code for p in user.role.permissions}


def require(*perms: str):
    def dep(user: User = Depends(current_user)) -> User:
        missing = [p for p in perms if p not in user_perms(user)]
        if missing:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Missing permission: {', '.join(missing)}")
        return user
    return dep


def audit(db: Session, user: User | None, action: str, entity: str = "", entity_id: str = "", details: dict | None = None,
          request: Request | None = None) -> None:
    db.add(AuditLog(actor_id=user.id if user else None, actor_email=user.email if user else "system", action=action,
                    entity=entity, entity_id=str(entity_id), details=details or {},
                    ip=(request.client.host if request and request.client else "")))
    db.commit()
