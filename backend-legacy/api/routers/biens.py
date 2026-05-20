import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.db import get_db
from api.models import Bien
from api.schemas.bien import BienCreate, BienRead, BienUpdate

router = APIRouter(prefix="/biens", tags=["biens"])


def _to_read(bien: Bien) -> dict:
    """Convert ORM Bien to read-shape dict (extract lat/lon from geom WKB-like)."""
    data = {
        "id": bien.id,
        "reference": bien.reference,
        "typologie": bien.typologie,
        "statut": bien.statut,
        "transaction": bien.transaction,
        "surface_m2": bien.surface_m2,
        "prix": bien.prix,
        "loyer_annuel": bien.loyer_annuel,
        "adresse": bien.adresse,
        "ville": bien.ville,
        "code_postal": bien.code_postal,
        "pays": bien.pays,
        "off_market": bien.off_market,
        "mandat_interne": bien.mandat_interne,
        "visial_qie_id": bien.visial_qie_id,
        "lat": None,
        "lon": None,
        "created_at": bien.created_at,
        "updated_at": bien.updated_at,
    }
    return data


@router.get("/geojson")
def biens_geojson(
    db: Session = Depends(get_db),
    statut: str | None = "disponible",
) -> dict:
    """Retourne les biens géolocalisés au format GeoJSON FeatureCollection."""
    from sqlalchemy import text

    sql = text(
        """
        SELECT
            id, reference, typologie, statut, transaction,
            surface_m2, prix, loyer_annuel,
            adresse, ville, code_postal,
            ST_X(geom::geometry) AS lon, ST_Y(geom::geometry) AS lat,
            off_market, mandat_interne
        FROM biens
        WHERE geom IS NOT NULL
          AND (:statut IS NULL OR statut = :statut)
        """
    )
    rows = db.execute(sql, {"statut": statut}).mappings().all()
    features = []
    for r in rows:
        if r["lon"] is None or r["lat"] is None:
            continue
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [float(r["lon"]), float(r["lat"])]},
            "properties": {
                "id": str(r["id"]),
                "reference": r["reference"],
                "typologie": r["typologie"],
                "statut": r["statut"],
                "surface_m2": float(r["surface_m2"]) if r["surface_m2"] else None,
                "prix": float(r["prix"]) if r["prix"] else None,
                "loyer_annuel": float(r["loyer_annuel"]) if r["loyer_annuel"] else None,
                "adresse": f"{r['adresse']}, {r['code_postal']} {r['ville']}",
                "off_market": r["off_market"],
                "mandat_interne": r["mandat_interne"],
            },
        })
    return {"type": "FeatureCollection", "features": features}


@router.get("", response_model=list[BienRead])
def list_biens(
    db: Session = Depends(get_db),
    typologie: str | None = None,
    statut: str | None = "disponible",
    off_market: bool | None = None,
    surface_min: float | None = None,
    surface_max: float | None = None,
    limit: int = Query(default=50, le=200),
    offset: int = 0,
) -> list[dict]:
    stmt = select(Bien).order_by(Bien.created_at.desc())
    if typologie:
        stmt = stmt.where(Bien.typologie == typologie)
    if statut:
        stmt = stmt.where(Bien.statut == statut)
    if off_market is not None:
        stmt = stmt.where(Bien.off_market == off_market)
    if surface_min is not None:
        stmt = stmt.where(Bien.surface_m2 >= surface_min)
    if surface_max is not None:
        stmt = stmt.where(Bien.surface_m2 <= surface_max)
    stmt = stmt.offset(offset).limit(limit)
    return [_to_read(b) for b in db.scalars(stmt).all()]


@router.post("", response_model=BienRead, status_code=status.HTTP_201_CREATED)
def create_bien(payload: BienCreate, db: Session = Depends(get_db)) -> dict:
    data = payload.model_dump(exclude={"lat", "lon"})
    if payload.lat is not None and payload.lon is not None:
        data["geom"] = f"SRID=4326;POINT({payload.lon} {payload.lat})"
    entity = Bien(**data)
    db.add(entity)
    db.commit()
    db.refresh(entity)
    return _to_read(entity)


@router.get("/{bien_id}", response_model=BienRead)
def get_bien(bien_id: uuid.UUID, db: Session = Depends(get_db)) -> dict:
    entity = db.get(Bien, bien_id)
    if entity is None:
        raise HTTPException(status_code=404, detail="Bien introuvable")
    return _to_read(entity)


@router.patch("/{bien_id}", response_model=BienRead)
def update_bien(
    bien_id: uuid.UUID,
    payload: BienUpdate,
    db: Session = Depends(get_db),
) -> dict:
    entity = db.get(Bien, bien_id)
    if entity is None:
        raise HTTPException(status_code=404, detail="Bien introuvable")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(entity, key, value)
    db.commit()
    db.refresh(entity)
    return _to_read(entity)
