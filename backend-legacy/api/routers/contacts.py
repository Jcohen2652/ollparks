import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.db import get_db
from api.models import Contact
from api.schemas.contact import ContactCreate, ContactRead, ContactUpdate

router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.get("", response_model=list[ContactRead])
def list_contacts(
    db: Session = Depends(get_db),
    entreprise_id: uuid.UUID | None = None,
    q: str | None = None,
    limit: int = Query(default=50, le=200),
    offset: int = 0,
) -> list[Contact]:
    stmt = select(Contact).order_by(Contact.score.desc(), Contact.nom)
    if entreprise_id:
        stmt = stmt.where(Contact.entreprise_id == entreprise_id)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            (Contact.nom.ilike(like))
            | (Contact.prenom.ilike(like))
            | (Contact.email.ilike(like))
        )
    stmt = stmt.offset(offset).limit(limit)
    return list(db.scalars(stmt).all())


@router.post("", response_model=ContactRead, status_code=status.HTTP_201_CREATED)
def create_contact(payload: ContactCreate, db: Session = Depends(get_db)) -> Contact:
    entity = Contact(**payload.model_dump())
    db.add(entity)
    db.commit()
    db.refresh(entity)
    return entity


@router.get("/{contact_id}", response_model=ContactRead)
def get_contact(contact_id: uuid.UUID, db: Session = Depends(get_db)) -> Contact:
    entity = db.get(Contact, contact_id)
    if entity is None:
        raise HTTPException(status_code=404, detail="Contact introuvable")
    return entity


@router.patch("/{contact_id}", response_model=ContactRead)
def update_contact(
    contact_id: uuid.UUID,
    payload: ContactUpdate,
    db: Session = Depends(get_db),
) -> Contact:
    entity = db.get(Contact, contact_id)
    if entity is None:
        raise HTTPException(status_code=404, detail="Contact introuvable")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(entity, key, value)
    db.commit()
    db.refresh(entity)
    return entity
