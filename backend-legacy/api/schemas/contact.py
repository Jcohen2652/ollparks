import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ContactBase(BaseModel):
    entreprise_id: uuid.UUID | None = None
    prenom: str | None = None
    nom: str | None = None
    email: str | None = None
    telephone: str | None = None
    poste: str | None = None
    role_immo: str | None = None
    linkedin_url: str | None = None
    score: int = 0
    source: str | None = None


class ContactCreate(ContactBase):
    pass


class ContactUpdate(BaseModel):
    prenom: str | None = None
    nom: str | None = None
    email: str | None = None
    telephone: str | None = None
    poste: str | None = None
    role_immo: str | None = None
    score: int | None = None


class ContactRead(ContactBase):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
