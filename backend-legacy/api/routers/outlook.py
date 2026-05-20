from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from api.db import get_db
from api.models import Interaction
from api.services.outlook import GraphError, OutlookSync

router = APIRouter(prefix="/outlook", tags=["outlook"])


class SyncRequest(BaseModel):
    user_id: str
    since_iso: str | None = None
    max_messages: int = 500


class SyncResponse(BaseModel):
    fetched: int
    new_messages: int
    new_contacts: int
    new_entreprises: int
    new_besoins: int
    skipped: int


class InteractionRead(BaseModel):
    id: str
    type: str | None
    direction: str | None
    sujet: str | None
    occurred_at: str | None


@router.post("/sync", response_model=SyncResponse)
def sync_outlook(payload: SyncRequest, db: Session = Depends(get_db)) -> SyncResponse:
    """Synchronise un mailbox Microsoft Graph vers la base."""
    try:
        sync = OutlookSync(db)
    except GraphError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    stats = sync.sync_user(
        user_id=payload.user_id,
        since_iso=payload.since_iso,
        max_messages=payload.max_messages,
    )
    return SyncResponse(**stats.__dict__)


@router.get("/interactions", response_model=list[InteractionRead])
def list_interactions(
    db: Session = Depends(get_db),
    contact_id: str | None = None,
    entreprise_id: str | None = None,
    limit: int = Query(default=50, le=500),
    offset: int = 0,
) -> list[InteractionRead]:
    """Timeline d'interactions (CRM) — emails + appels + RDV + notes."""
    stmt = select(Interaction).order_by(desc(Interaction.occurred_at)).limit(limit).offset(offset)
    if contact_id:
        stmt = stmt.where(Interaction.contact_id == contact_id)
    if entreprise_id:
        stmt = stmt.where(Interaction.entreprise_id == entreprise_id)
    items = list(db.scalars(stmt).all())
    return [
        InteractionRead(
            id=str(i.id),
            type=i.type,
            direction=i.direction,
            sujet=i.sujet,
            occurred_at=i.occurred_at.isoformat() if i.occurred_at else None,
        )
        for i in items
    ]
