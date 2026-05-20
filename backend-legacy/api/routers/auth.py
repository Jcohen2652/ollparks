from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.db import get_db
from api.models import User
from api.services.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    require_role,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    email: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    nom: str | None = None
    role: str = "lecteur"


class UserOut(BaseModel):
    email: str
    nom: str | None
    role: str
    actif: bool


@router.post("/login", response_model=TokenResponse)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)) -> TokenResponse:
    user = db.scalar(select(User).where(User.email == form.username))
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Identifiants invalides")
    if not user.actif:
        raise HTTPException(status_code=401, detail="Compte désactivé")
    token = create_access_token(subject=user.email, role=user.role)
    return TokenResponse(access_token=token, role=user.role, email=user.email)


@router.post("/register", response_model=UserOut, status_code=201)
def register(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
) -> UserOut:
    """Création d'un compte utilisateur (admin uniquement)."""
    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing:
        raise HTTPException(status_code=409, detail="Email déjà utilisé")
    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        nom=payload.nom,
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserOut(email=user.email, nom=user.nom, role=user.role, actif=user.actif)


@router.get("/me", response_model=UserOut)
def me(current: User = Depends(get_current_user)) -> UserOut:
    return UserOut(email=current.email, nom=current.nom, role=current.role, actif=current.actif)
