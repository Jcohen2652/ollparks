import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.db import get_db
from api.models import Contact, Entreprise, Interaction, Opportunite

router = APIRouter(prefix="/crm", tags=["crm"])


class EntrepriseDetail(BaseModel):
    entreprise: dict[str, Any]
    contacts: list[dict[str, Any]]
    besoins: list[dict[str, Any]]
    interactions_count: int
    last_interaction_at: str | None
    opportunites_count: int


class PipelineColumn(BaseModel):
    statut: str
    items: list[dict[str, Any]]


@router.get("/entreprises/{entreprise_id}", response_model=EntrepriseDetail)
def fiche_entreprise(entreprise_id: uuid.UUID, db: Session = Depends(get_db)) -> EntrepriseDetail:
    """Vue 360° d'une entreprise : fiche + contacts + besoins + interactions + opportunités."""
    from api.models import Besoin

    ent = db.get(Entreprise, entreprise_id)
    if not ent:
        raise HTTPException(status_code=404, detail="Entreprise introuvable")

    contacts = list(db.scalars(select(Contact).where(Contact.entreprise_id == entreprise_id)).all())
    besoins = list(db.scalars(select(Besoin).where(Besoin.entreprise_id == entreprise_id)).all())
    interactions = list(
        db.scalars(
            select(Interaction)
            .where(Interaction.entreprise_id == entreprise_id)
            .order_by(Interaction.occurred_at.desc())
            .limit(50)
        ).all()
    )
    besoin_ids = [b.id for b in besoins]
    opp_count = 0
    if besoin_ids:
        opp_count = (
            db.scalar(
                select(Opportunite.id).where(Opportunite.besoin_id.in_(besoin_ids)).limit(1000)
            )
            and len(list(
                db.scalars(select(Opportunite.id).where(Opportunite.besoin_id.in_(besoin_ids))).all()
            ))
        )

    return EntrepriseDetail(
        entreprise={
            "id": str(ent.id),
            "raison_sociale": ent.raison_sociale,
            "siren": ent.siren,
            "secteur": ent.secteur,
            "effectif": ent.effectif,
            "score": ent.score,
        },
        contacts=[
            {
                "id": str(c.id),
                "nom": f"{c.prenom or ''} {c.nom or ''}".strip(),
                "email": c.email,
                "poste": c.poste,
                "score": c.score,
            }
            for c in contacts
        ],
        besoins=[
            {
                "id": str(b.id),
                "typologie": b.typologie,
                "surface_min": float(b.surface_min) if b.surface_min else None,
                "surface_max": float(b.surface_max) if b.surface_max else None,
                "zones": b.zones,
                "timing": b.timing,
                "statut": b.statut,
            }
            for b in besoins
        ],
        interactions_count=len(interactions),
        last_interaction_at=interactions[0].occurred_at.isoformat() if interactions and interactions[0].occurred_at else None,
        opportunites_count=opp_count or 0,
    )


@router.get("/pipeline", response_model=list[PipelineColumn])
def pipeline(db: Session = Depends(get_db)) -> list[PipelineColumn]:
    """Pipeline commercial : opportunités groupées par statut, triées par score."""
    statuts = ["nouveau", "qualifié", "proposé", "visite", "offre", "signé", "perdu"]
    columns: list[PipelineColumn] = []
    for s in statuts:
        opps = list(
            db.scalars(
                select(Opportunite).where(Opportunite.statut == s).order_by(Opportunite.score.desc())
            ).all()
        )
        columns.append(
            PipelineColumn(
                statut=s,
                items=[
                    {
                        "id": str(o.id),
                        "besoin_id": str(o.besoin_id),
                        "bien_id": str(o.bien_id),
                        "score": o.score,
                        "action_recommandee": o.action_recommandee,
                    }
                    for o in opps
                ],
            )
        )
    return columns


class StatutUpdate(BaseModel):
    statut: str


@router.patch("/opportunites/{opp_id}/statut")
def update_opportunite_statut(
    opp_id: uuid.UUID, payload: StatutUpdate, db: Session = Depends(get_db)
) -> dict:
    opp = db.get(Opportunite, opp_id)
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunité introuvable")
    opp.statut = payload.statut
    db.commit()
    return {"ok": True, "statut": opp.statut}
