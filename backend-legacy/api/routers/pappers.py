import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.db import get_db
from api.models import Bien, BienProprietaire, Entreprise, Proprietaire
from api.services.pappers import PappersClient, PappersError, score_proprietaire

router = APIRouter(prefix="/pappers", tags=["pappers"])


class EntrepriseEnrich(BaseModel):
    siren: str


class ProprietaireRead(BaseModel):
    id: uuid.UUID
    type: str | None
    nom: str
    siren: str | None
    score: int


@router.post("/entreprises/{entreprise_id}/enrichir", response_model=dict)
def enrichir_entreprise(entreprise_id: uuid.UUID, db: Session = Depends(get_db)) -> dict[str, Any]:
    """
    Enrichit une entreprise avec les données Pappers (effectif, CA, dirigeants).
    """
    entreprise = db.get(Entreprise, entreprise_id)
    if not entreprise or not entreprise.siren:
        raise HTTPException(status_code=400, detail="Entreprise sans SIREN")

    try:
        client = PappersClient()
    except PappersError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e

    data = client.entreprise(entreprise.siren)
    if not data:
        raise HTTPException(status_code=404, detail="SIREN inconnu sur Pappers")

    entreprise.raison_sociale = data.get("denomination") or entreprise.raison_sociale
    entreprise.effectif = data.get("effectif") or entreprise.effectif
    entreprise.ca = data.get("chiffre_affaires") or entreprise.ca
    entreprise.pappers_id = str(data.get("id")) if data.get("id") else entreprise.pappers_id
    db.commit()
    return {"ok": True, "siren": entreprise.siren, "dirigeants": data.get("representants", [])[:10]}


@router.post("/biens/{bien_id}/proprietaires", response_model=list[ProprietaireRead])
def identifier_proprietaires(bien_id: uuid.UUID, db: Session = Depends(get_db)) -> list[ProprietaireRead]:
    """
    Identifie les propriétaires d'un bien via Pappers Immo (recherche par adresse).
    Crée/met à jour les rows `proprietaires` + association `biens_proprietaires`.
    """
    bien = db.get(Bien, bien_id)
    if not bien or not bien.adresse or not bien.code_postal:
        raise HTTPException(status_code=400, detail="Bien sans adresse complète")

    try:
        client = PappersClient()
    except PappersError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e

    found = client.proprietaires_par_adresse(bien.adresse, bien.code_postal, bien.ville)
    out: list[ProprietaireRead] = []
    for p in found:
        if not p.get("nom"):
            continue
        # cherche existant par siren ou nom
        existing = None
        if p.get("siren"):
            existing = db.scalar(select(Proprietaire).where(Proprietaire.siren == p["siren"]))
        if existing is None:
            existing = db.scalar(select(Proprietaire).where(Proprietaire.nom == p["nom"]))
        if existing is None:
            existing = Proprietaire(
                type=p.get("type"),
                nom=p["nom"],
                siren=p.get("siren"),
                pappers_id=p.get("pappers_id"),
                score=score_proprietaire(
                    {
                        "type": p.get("type"),
                        "date_creation": (p.get("raw") or {}).get("date_creation"),
                    }
                ),
            )
            db.add(existing)
            db.flush()
        # association
        link = db.get(BienProprietaire, (bien.id, existing.id))
        if not link:
            db.add(BienProprietaire(bien_id=bien.id, proprietaire_id=existing.id))
        out.append(
            ProprietaireRead(
                id=existing.id,
                type=existing.type,
                nom=existing.nom,
                siren=existing.siren,
                score=existing.score,
            )
        )
    db.commit()
    return out


@router.get("/proprietaires", response_model=list[ProprietaireRead])
def list_proprietaires(
    db: Session = Depends(get_db),
    min_score: int = 0,
    limit: int = Query(default=50, le=200),
    offset: int = 0,
) -> list[ProprietaireRead]:
    stmt = (
        select(Proprietaire)
        .where(Proprietaire.score >= min_score)
        .order_by(Proprietaire.score.desc())
        .offset(offset)
        .limit(limit)
    )
    items = list(db.scalars(stmt).all())
    return [
        ProprietaireRead(id=p.id, type=p.type, nom=p.nom, siren=p.siren, score=p.score)
        for p in items
    ]
