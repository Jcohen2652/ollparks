import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.db import get_db
from api.models import Entreprise
from api.schemas.entreprise import EntrepriseCreate, EntrepriseRead, EntrepriseUpdate

router = APIRouter(prefix="/entreprises", tags=["entreprises"])


@router.get("", response_model=list[EntrepriseRead])
def list_entreprises(
    db: Session = Depends(get_db),
    q: str | None = Query(default=None, description="Recherche raison sociale / SIREN"),
    secteur: str | None = None,
    limit: int = Query(default=50, le=200),
    offset: int = 0,
) -> list[Entreprise]:
    stmt = select(Entreprise).order_by(Entreprise.score.desc(), Entreprise.raison_sociale)
    if q:
        like = f"%{q}%"
        stmt = stmt.where((Entreprise.raison_sociale.ilike(like)) | (Entreprise.siren.ilike(like)))
    if secteur:
        stmt = stmt.where(Entreprise.secteur == secteur)
    stmt = stmt.offset(offset).limit(limit)
    return list(db.scalars(stmt).all())


@router.post("", response_model=EntrepriseRead, status_code=status.HTTP_201_CREATED)
def create_entreprise(payload: EntrepriseCreate, db: Session = Depends(get_db)) -> Entreprise:
    entity = Entreprise(**payload.model_dump())
    db.add(entity)
    db.commit()
    db.refresh(entity)
    return entity


@router.get("/{entreprise_id}", response_model=EntrepriseRead)
def get_entreprise(entreprise_id: uuid.UUID, db: Session = Depends(get_db)) -> Entreprise:
    entity = db.get(Entreprise, entreprise_id)
    if entity is None:
        raise HTTPException(status_code=404, detail="Entreprise introuvable")
    return entity


@router.patch("/{entreprise_id}", response_model=EntrepriseRead)
def update_entreprise(
    entreprise_id: uuid.UUID,
    payload: EntrepriseUpdate,
    db: Session = Depends(get_db),
) -> Entreprise:
    entity = db.get(Entreprise, entreprise_id)
    if entity is None:
        raise HTTPException(status_code=404, detail="Entreprise introuvable")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(entity, key, value)
    db.commit()
    db.refresh(entity)
    return entity
