import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class RdvBase(BaseModel):
    titre: str | None = None
    debut: datetime
    fin: datetime
    lieu: str | None = None
    contact_id: uuid.UUID | None = None
    entreprise_id: uuid.UUID | None = None
    bien_id: uuid.UUID | None = None
    rappel_minutes: int = 30


class RdvCreate(RdvBase):
    pass


class RdvUpdate(BaseModel):
    statut: str | None = None
    titre: str | None = None
    debut: datetime | None = None
    fin: datetime | None = None


class RdvRead(RdvBase):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    statut: str
    outlook_event_id: str | None
