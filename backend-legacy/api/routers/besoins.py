import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.db import get_db
from api.models import Besoin
from api.schemas.besoin import BesoinCreate, BesoinRead, BesoinUpdate

router = APIRouter(prefix="/besoins", tags=["besoins"])


@router.get("", response_model=list[BesoinRead])
def list_besoins(
    db: Session = Depends(get_db),
    entreprise_id: uuid.UUID | None = None,
    statut: str | None = "actif",
    limit: int = Query(default=50, le=200),
    offset: int = 0,
) -> list[Besoin]:
    stmt = select(Besoin).order_by(Besoin.created_at.desc())
    if entreprise_id:
        stmt = stmt.where(Besoin.entreprise_id == entreprise_id)
    if statut:
        stmt = stmt.where(Besoin.statut == statut)
    return list(db.scalars(stmt.offset(offset).limit(limit)).all())


@router.post("", response_model=BesoinRead, status_code=status.HTTP_201_CREATED)
def create_besoin(payload: BesoinCreate, db: Session = Depends(get_db)) -> Besoin:
    entity = Besoin(**payload.model_dump())
    db.add(entity)
    db.commit()
    db.refresh(entity)
    return entity


@router.get("/{besoin_id}", response_model=BesoinRead)
def get_besoin(besoin_id: uuid.UUID, db: Session = Depends(get_db)) -> Besoin:
    entity = db.get(Besoin, besoin_id)
    if entity is None:
        raise HTTPException(status_code=404, detail="Besoin introuvable")
    return entity


@router.patch("/{besoin_id}", response_model=BesoinRead)
def update_besoin(
    besoin_id: uuid.UUID,
    payload: BesoinUpdate,
    db: Session = Depends(get_db),
) -> Besoin:
    entity = db.get(Besoin, besoin_id)
    if entity is None:
        raise HTTPException(status_code=404, detail="Besoin introuvable")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(entity, key, value)
    db.commit()
    db.refresh(entity)
    return entity
