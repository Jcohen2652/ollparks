import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class BesoinBase(BaseModel):
    entreprise_id: uuid.UUID | None = None
    contact_id: uuid.UUID | None = None
    typologie: str | None = None
    transaction: str | None = None
    surface_min: Decimal | None = None
    surface_max: Decimal | None = None
    budget_min: Decimal | None = None
    budget_max: Decimal | None = None
    zones: list[str] | None = None
    timing: str | None = None
    statut: str = "actif"


class BesoinCreate(BesoinBase):
    pass


class BesoinUpdate(BaseModel):
    statut: str | None = None
    timing: str | None = None
    budget_max: Decimal | None = None


class BesoinRead(BesoinBase):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
