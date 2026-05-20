"""
Synchronisation des actifs VISIAL QIE → table `biens`.

Stratégie : la colonne `biens.visial_qie_id` sert de clé externe.
- Si présent : update
- Sinon : create

Résolution de conflits : VISIAL = source de vérité pour l'actif (technique).
La couche commerciale (statut, off_market, mandat_interne) reste contrôlée par OLL PARKS.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from api.models import Bien
from api.services.visial.client import VisialClient

logger = logging.getLogger(__name__)


@dataclass
class VisialSyncStats:
    fetched: int = 0
    created: int = 0
    updated: int = 0
    skipped: int = 0


class VisialSync:
    def __init__(self, db: Session, client: VisialClient | None = None) -> None:
        self.db = db
        self.client = client or VisialClient()

    def sync_all(self, max_pages: int = 10) -> VisialSyncStats:
        stats = VisialSyncStats()
        for page in range(1, max_pages + 1):
            actifs = self.client.list_actifs(page=page)
            if not actifs:
                break
            for actif in actifs:
                stats.fetched += 1
                self._upsert_actif(actif, stats)
        self.db.commit()
        return stats

    def _upsert_actif(self, actif: dict[str, Any], stats: VisialSyncStats) -> None:
        visial_id = str(actif.get("id") or actif.get("visial_id") or "")
        if not visial_id:
            stats.skipped += 1
            return

        existing = self.db.scalar(select(Bien).where(Bien.visial_qie_id == visial_id))

        # Champs métier — adapter selon le schéma réel VISIAL
        fields = {
            "reference": actif.get("reference") or actif.get("ref_interne") or visial_id,
            "typologie": (actif.get("typologie") or "").lower() or None,
            "surface_m2": actif.get("surface_utile") or actif.get("surface"),
            "adresse": actif.get("adresse"),
            "ville": actif.get("ville"),
            "code_postal": actif.get("code_postal"),
            "visial_qie_id": visial_id,
        }

        if existing:
            for k, v in fields.items():
                # On n'écrase pas les valeurs commerciales si VISIAL les renvoie nulles
                if v is not None:
                    setattr(existing, k, v)
            stats.updated += 1
        else:
            bien = Bien(**fields)
            self.db.add(bien)
            stats.created += 1
