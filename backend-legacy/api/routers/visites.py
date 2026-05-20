import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.db import get_db
from api.models import Bien, Contact, Visite, VisiteParticipant
from api.schemas.visite import VisiteCreate, VisiteRead
from api.services.documents import DocumentGenerator

router = APIRouter(prefix="/visites", tags=["visites"])

generator = DocumentGenerator()

VISITE_DOC_TYPES = {
    "bon_de_visite": "bon_de_visite_url",
    "denonce_proprietaire": "denonce_url",
    "modalites_visite": "modalites_url",
}


@router.get("", response_model=list[VisiteRead])
def list_visites(
    db: Session = Depends(get_db),
    statut: str | None = None,
    limit: int = Query(default=50, le=200),
    offset: int = 0,
) -> list[Visite]:
    stmt = select(Visite).order_by(Visite.date_visite.desc()).offset(offset).limit(limit)
    if statut:
        stmt = stmt.where(Visite.statut == statut)
    return list(db.scalars(stmt).all())


@router.post("", response_model=VisiteRead, status_code=201)
def create_visite(payload: VisiteCreate, db: Session = Depends(get_db)) -> Visite:
    bien = db.get(Bien, payload.bien_id)
    if bien is None:
        raise HTTPException(status_code=404, detail="Bien introuvable")
    visite = Visite(
        bien_id=payload.bien_id,
        opportunite_id=payload.opportunite_id,
        date_visite=payload.date_visite,
        notes=payload.notes,
    )
    db.add(visite)
    db.flush()
    for cid in payload.contact_ids:
        contact = db.get(Contact, cid)
        if contact:
            db.add(VisiteParticipant(visite_id=visite.id, contact_id=cid, role="prospect"))
    db.commit()
    db.refresh(visite)
    return visite


@router.get("/{visite_id}", response_model=VisiteRead)
def get_visite(visite_id: uuid.UUID, db: Session = Depends(get_db)) -> Visite:
    visite = db.get(Visite, visite_id)
    if visite is None:
        raise HTTPException(status_code=404, detail="Visite introuvable")
    return visite


@router.get("/{visite_id}/documents/{doc_type}")
def render_visite_document(
    visite_id: uuid.UUID,
    doc_type: str,
    db: Session = Depends(get_db),
    format: str = "pdf",
) -> Response:
    """
    Génère un document pré-rempli pour une visite donnée.
    doc_type ∈ {bon_de_visite, denonce_proprietaire, modalites_visite}
    """
    if doc_type not in VISITE_DOC_TYPES:
        raise HTTPException(status_code=404, detail=f"doc_type inconnu : {doc_type}")
    visite = db.get(Visite, visite_id)
    if not visite:
        raise HTTPException(status_code=404, detail="Visite introuvable")
    bien = db.get(Bien, visite.bien_id) if visite.bien_id else None
    if not bien:
        raise HTTPException(status_code=400, detail="Visite sans bien associé")

    # Récupère un participant prospect (premier)
    participant = db.scalar(
        select(VisiteParticipant).where(VisiteParticipant.visite_id == visite_id)
    )
    contact = db.get(Contact, participant.contact_id) if participant else None
    prospect = {
        "raison_sociale": "—",
        "siren": None,
        "contact_nom": f"{contact.prenom or ''} {contact.nom or ''}".strip() if contact else "—",
        "contact_email": contact.email if contact else None,
    }
    if contact and contact.entreprise_id:
        from api.models import Entreprise
        ent = db.get(Entreprise, contact.entreprise_id)
        if ent:
            prospect["raison_sociale"] = ent.raison_sociale
            prospect["siren"] = ent.siren

    data = {
        "date_visite": visite.date_visite.strftime("%d/%m/%Y à %H:%M") if visite.date_visite else "—",
        "bien": {
            "reference": bien.reference,
            "adresse": bien.adresse,
            "ville": bien.ville,
            "code_postal": bien.code_postal,
            "typologie": bien.typologie,
            "surface_m2": float(bien.surface_m2) if bien.surface_m2 else None,
        },
        "prospect": prospect,
        "agent": {"nom": "OLL PARKS — Équipe commerciale", "email": "contact@oll-parks.fr"},
        "contact_gardien": "À compléter",
        "proprietaire": {"nom": "—"},
    }

    try:
        if format == "html":
            return Response(generator.render_html(doc_type, data), media_type="text/html")
        if format == "docx":
            return Response(
                generator.render_docx(doc_type, data),
                media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                headers={"Content-Disposition": f'attachment; filename="{doc_type}.docx"'},
            )
        return Response(
            generator.render_pdf(doc_type, data),
            media_type="application/pdf",
            headers={"Content-Disposition": f'inline; filename="{doc_type}.pdf"'},
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except ImportError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
