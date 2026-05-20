import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.db import get_db
from api.models import Opportunite
from api.schemas.opportunite import OpportuniteRead

router = APIRouter(prefix="/opportunites", tags=["opportunites"])


@router.get("", response_model=list[OpportuniteRead])
def list_opportunites(
    db: Session = Depends(get_db),
    besoin_id: uuid.UUID | None = None,
    bien_id: uuid.UUID | None = None,
    min_score: int | None = None,
    limit: int = Query(default=50, le=200),
    offset: int = 0,
) -> list[Opportunite]:
    stmt = select(Opportunite).order_by(Opportunite.score.desc().nullslast())
    if besoin_id:
        stmt = stmt.where(Opportunite.besoin_id == besoin_id)
    if bien_id:
        stmt = stmt.where(Opportunite.bien_id == bien_id)
    if min_score is not None:
        stmt = stmt.where(Opportunite.score >= min_score)
    return list(db.scalars(stmt.offset(offset).limit(limit)).all())
