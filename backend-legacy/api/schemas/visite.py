import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class VisiteCreate(BaseModel):
    bien_id: uuid.UUID
    opportunite_id: uuid.UUID | None = None
    date_visite: datetime
    notes: str | None = None
    contact_ids: list[uuid.UUID] = []


class VisiteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    bien_id: uuid.UUID | None
    date_visite: datetime | None
    statut: str
    bon_de_visite_url: str | None
    denonce_url: str | None
    modalites_url: str | None
    notes: str | None
