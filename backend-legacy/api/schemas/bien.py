import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class BienBase(BaseModel):
    reference: str | None = None
    typologie: str | None = None
    statut: str = "disponible"
    transaction: str | None = None
    surface_m2: Decimal | None = None
    prix: Decimal | None = None
    loyer_annuel: Decimal | None = None
    adresse: str | None = None
    ville: str | None = None
    code_postal: str | None = None
    pays: str = "France"
    off_market: bool = False
    mandat_interne: bool = False
    visial_qie_id: str | None = None
    lat: float | None = None
    lon: float | None = None


class BienCreate(BienBase):
    pass


class BienUpdate(BaseModel):
    statut: str | None = None
    prix: Decimal | None = None
    loyer_annuel: Decimal | None = None
    surface_m2: Decimal | None = None
    off_market: bool | None = None


class BienRead(BienBase):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
