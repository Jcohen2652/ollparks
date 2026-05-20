import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class EntrepriseBase(BaseModel):
    raison_sociale: str
    siren: str | None = Field(default=None, max_length=9)
    secteur: str | None = None
    effectif: int | None = None
    ca: Decimal | None = None
    site_web: str | None = None
    linkedin_url: str | None = None
    pappers_id: str | None = None
    score: int = 0


class EntrepriseCreate(EntrepriseBase):
    pass


class EntrepriseUpdate(BaseModel):
    raison_sociale: str | None = None
    secteur: str | None = None
    effectif: int | None = None
    ca: Decimal | None = None
    site_web: str | None = None
    linkedin_url: str | None = None
    score: int | None = None


class EntrepriseRead(EntrepriseBase):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
