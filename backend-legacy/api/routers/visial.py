from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.db import get_db
from api.services.visial import VisialClient, VisialError, VisialSync

router = APIRouter(prefix="/visial", tags=["visial-qie"])


class SyncResponse(BaseModel):
    fetched: int
    created: int
    updated: int
    skipped: int


@router.post("/sync", response_model=SyncResponse)
def sync_visial(max_pages: int = 10, db: Session = Depends(get_db)) -> SyncResponse:
    """Sync de tous les actifs VISIAL QIE vers `biens`."""
    try:
        sync = VisialSync(db)
    except VisialError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    stats = sync.sync_all(max_pages=max_pages)
    return SyncResponse(**stats.__dict__)


@router.get("/actifs/{visial_id}", response_model=dict)
def get_actif(visial_id: str) -> dict:
    """Proxy vers VISIAL pour récupérer la fiche actif complète."""
    try:
        client = VisialClient()
    except VisialError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    data = client.get_actif(visial_id)
    if not data:
        raise HTTPException(status_code=404, detail="Actif inconnu")
    return data
