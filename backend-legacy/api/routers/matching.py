
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from api.db import get_db
from api.models import Besoin, Bien, Contact, Opportunite
from api.schemas.opportunite import MatchRequest, MatchResponse, MatchResultItem
from api.services.matching import calculate_final_score, recommend_action

router = APIRouter(prefix="/matching", tags=["matching"])


def _bien_to_dict(b: Bien) -> dict:
    return {
        "id": str(b.id),
        "typologie": b.typologie,
        "statut": b.statut,
        "surface_m2": b.surface_m2,
        "prix": b.prix,
        "loyer_annuel": b.loyer_annuel,
        "ville": b.ville,
        "code_postal": b.code_postal,
    }


def _besoin_to_dict(b: Besoin) -> dict:
    return {
        "id": str(b.id),
        "typologie": b.typologie,
        "transaction": b.transaction,
        "surface_min": b.surface_min,
        "surface_max": b.surface_max,
        "budget_min": b.budget_min,
        "budget_max": b.budget_max,
        "zones": b.zones,
        "timing": b.timing,
        "statut": b.statut,
    }


@router.post("/run", response_model=MatchResponse)
def run_matching(payload: MatchRequest, db: Session = Depends(get_db)) -> MatchResponse:
    """
    Calcule le score de matching d'un besoin contre tous les biens disponibles.
    Persiste les résultats dans `opportunites` (upsert sur (besoin_id, bien_id)).
    """
    besoin = db.get(Besoin, payload.besoin_id)
    if besoin is None:
        raise HTTPException(status_code=404, detail="Besoin introuvable")

    contact = db.get(Contact, besoin.contact_id) if besoin.contact_id else None
    contact_dict = (
        {
            "email": contact.email,
            "role_immo": contact.role_immo,
            "score": contact.score,
        }
        if contact
        else {}
    )

    biens = list(db.scalars(select(Bien).where(Bien.statut == "disponible")).all())
    besoin_dict = _besoin_to_dict(besoin)

    results: list[MatchResultItem] = []
    for bien in biens:
        score, detail = calculate_final_score(besoin_dict, _bien_to_dict(bien), contact_dict)
        action = recommend_action(score)
        results.append(
            MatchResultItem(
                bien_id=bien.id, score=score, score_detail=detail, action=action
            )
        )

        # Upsert opportunite
        stmt = pg_insert(Opportunite).values(
            besoin_id=besoin.id,
            bien_id=bien.id,
            score=score,
            score_detail=detail,
            action_recommandee=action,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=["besoin_id", "bien_id"],
            set_={
                "score": score,
                "score_detail": detail,
                "action_recommandee": action,
            },
        )
        db.execute(stmt)

    db.commit()
    results.sort(key=lambda r: r.score, reverse=True)
    return MatchResponse(besoin_id=besoin.id, results=results[: payload.top_n])
