"""
Authentification : password hashing (passlib bcrypt) + JWT (python-jose).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.config import get_settings
from api.db import get_db
from api.models import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

ROLES_HIERARCHY = {
    "admin":      {"admin", "directeur", "consultant", "charge", "lecteur"},
    "directeur":  {"directeur", "consultant", "charge", "lecteur"},
    "consultant": {"consultant", "charge", "lecteur"},
    "charge":     {"charge", "lecteur"},
    "lecteur":    {"lecteur"},
}


# ---------------------------------------------------------------------------
# Hashing
# ---------------------------------------------------------------------------

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(plain, hashed)
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------

def create_access_token(subject: str, role: str) -> str:
    s = get_settings()
    expire = datetime.now(UTC) + timedelta(minutes=s.jwt_expires_minutes)
    payload = {"sub": subject, "role": role, "exp": expire}
    return jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    s = get_settings()
    return jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm])


# ---------------------------------------------------------------------------
# FastAPI dependencies
# ---------------------------------------------------------------------------

def get_current_user(
    token: str | None = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> User:
    if not token:
        raise HTTPException(status_code=401, detail="Non authentifié")
    try:
        payload = decode_token(token)
        email = payload.get("sub")
    except JWTError as e:
        raise HTTPException(status_code=401, detail="Token invalide") from e
    if not email:
        raise HTTPException(status_code=401, detail="Token sans sujet")
    user = db.scalar(select(User).where(User.email == email))
    if not user or not user.actif:
        raise HTTPException(status_code=401, detail="Utilisateur introuvable ou désactivé")
    return user


def require_role(min_role: str):
    """Dependency factory: returns a dep that raises 403 if user role too low."""

    def checker(current: User = Depends(get_current_user)) -> User:
        allowed = ROLES_HIERARCHY.get(current.role, set())
        if min_role not in allowed and current.role != min_role:
            # min_role doit être atteignable par le rôle courant
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Rôle insuffisant (requis: {min_role}, courant: {current.role})",
            )
        return current

    return checker
