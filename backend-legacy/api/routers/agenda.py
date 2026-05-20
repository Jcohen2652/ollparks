import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.db import get_db
from api.models import Rdv
from api.schemas.rdv import RdvCreate, RdvRead, RdvUpdate

router = APIRouter(prefix="/agenda", tags=["agenda"])


@router.get("", response_model=list[RdvRead])
def list_rdv(
    db: Session = Depends(get_db),
    debut: datetime | None = None,
    fin: datetime | None = None,
    contact_id: uuid.UUID | None = None,
    limit: int = Query(default=200, le=1000),
) -> list[Rdv]:
    """Liste les RDV dans une fenêtre temporelle."""
    if debut is None:
        debut = datetime.utcnow() - timedelta(days=30)
    if fin is None:
        fin = datetime.utcnow() + timedelta(days=90)
    stmt = (
        select(Rdv)
        .where(Rdv.debut >= debut, Rdv.debut <= fin)
        .order_by(Rdv.debut)
        .limit(limit)
    )
    if contact_id:
        stmt = stmt.where(Rdv.contact_id == contact_id)
    return list(db.scalars(stmt).all())


@router.post("", response_model=RdvRead, status_code=201)
def create_rdv(payload: RdvCreate, db: Session = Depends(get_db)) -> Rdv:
    rdv = Rdv(**payload.model_dump())
    db.add(rdv)
    db.commit()
    db.refresh(rdv)
    return rdv


@router.patch("/{rdv_id}", response_model=RdvRead)
def update_rdv(rdv_id: uuid.UUID, payload: RdvUpdate, db: Session = Depends(get_db)) -> Rdv:
    rdv = db.get(Rdv, rdv_id)
    if not rdv:
        raise HTTPException(status_code=404, detail="RDV introuvable")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(rdv, k, v)
    db.commit()
    db.refresh(rdv)
    return rdv


@router.post("/sync-outlook", response_model=dict)
def sync_outlook_calendar(
    user_id: str,
    days_back: int = 30,
    days_forward: int = 90,
    db: Session = Depends(get_db),
) -> dict:
    """
    Synchronisation bidirectionnelle calendrier Outlook ↔ rdv.
    v1 : ingestion Graph -> rdv (outlook_event_id pour idempotence).
    """
    from api.services.outlook import GraphClient, GraphError

    try:
        graph = GraphClient()
    except GraphError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e

    debut_iso = (datetime.utcnow() - timedelta(days=days_back)).isoformat() + "Z"
    fin_iso = (datetime.utcnow() + timedelta(days=days_forward)).isoformat() + "Z"

    data = graph.get(
        f"/users/{user_id}/calendarView",
        params={
            "startDateTime": debut_iso,
            "endDateTime": fin_iso,
            "$select": "id,subject,start,end,location",
            "$top": "100",
        },
    )

    new_count = 0
    for ev in data.get("value", []):
        ev_id = ev.get("id")
        if not ev_id:
            continue
        existing = db.scalar(select(Rdv).where(Rdv.outlook_event_id == ev_id))
        if existing:
            continue
        try:
            debut_dt = datetime.fromisoformat(ev["start"]["dateTime"])
            fin_dt = datetime.fromisoformat(ev["end"]["dateTime"])
        except (KeyError, ValueError):
            continue
        rdv = Rdv(
            titre=ev.get("subject"),
            debut=debut_dt,
            fin=fin_dt,
            lieu=(ev.get("location") or {}).get("displayName"),
            outlook_event_id=ev_id,
        )
        db.add(rdv)
        new_count += 1
    db.commit()
    return {"imported": new_count}
