import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class OpportuniteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    besoin_id: uuid.UUID
    bien_id: uuid.UUID
    score: int | None
    score_detail: dict[str, Any] | None
    statut: str
    action_recommandee: str | None
    created_at: datetime
    updated_at: datetime


class MatchRequest(BaseModel):
    """Compute matching for a given besoin against all available biens."""

    besoin_id: uuid.UUID
    top_n: int = 10


class MatchResultItem(BaseModel):
    bien_id: uuid.UUID
    score: int
    score_detail: dict[str, int]
    action: str


class MatchResponse(BaseModel):
    besoin_id: uuid.UUID
    results: list[MatchResultItem]
