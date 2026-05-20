"""
Synchronisation incrémentale des emails Outlook vers la base.

Idempotence : on déduplique sur `interactions.outlook_msg_id` (UNIQUE).
Pour chaque message :
- Crée/retrouve le contact (par email)
- Crée/retrouve l'entreprise (par domaine email)
- Insère l'interaction
- Tente d'extraire un besoin immobilier (texte libre)
"""

from __future__ import annotations

import contextlib
import logging
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from api.models import Besoin, Contact, Entreprise, Interaction
from api.services.outlook.client import GraphClient
from api.services.outlook.extract import (
    extract_business_signals,
    extract_company_from_email,
    extract_property_need,
    parse_signature,
)

logger = logging.getLogger(__name__)


@dataclass
class SyncStats:
    fetched: int = 0
    new_messages: int = 0
    new_contacts: int = 0
    new_entreprises: int = 0
    new_besoins: int = 0
    skipped: int = 0


class OutlookSync:
    """Service d'ingestion. Stateless, prend une session DB en paramètre."""

    def __init__(self, db: Session, graph: GraphClient | None = None) -> None:
        self.db = db
        self.graph = graph or GraphClient()

    # ------------------------------------------------------------------
    # Orchestration
    # ------------------------------------------------------------------

    def sync_user(
        self,
        user_id: str,
        since_iso: str | None = None,
        max_messages: int = 1000,
    ) -> SyncStats:
        """Ingestion d'un mailbox. `since_iso` = '2025-01-01T00:00:00Z' pour incrémental."""
        stats = SyncStats()
        for msg in self.graph.iter_messages(user_id, since_iso=since_iso):
            stats.fetched += 1
            if self._upsert_message(msg, stats):
                pass
            if stats.fetched >= max_messages:
                break
        self.db.commit()
        return stats

    # ------------------------------------------------------------------
    # Per-message processing
    # ------------------------------------------------------------------

    def _upsert_message(self, msg: dict, stats: SyncStats) -> bool:
        """Insère une interaction si pas déjà présente. Renvoie True si nouveau."""
        outlook_id = msg.get("internetMessageId") or msg.get("id")
        if not outlook_id:
            stats.skipped += 1
            return False

        # Idempotence
        existing = self.db.scalar(
            select(Interaction).where(Interaction.outlook_msg_id == outlook_id)
        )
        if existing:
            stats.skipped += 1
            return False

        from_addr = (
            msg.get("from", {}).get("emailAddress", {}).get("address")
            if msg.get("from")
            else None
        )
        from_name = (
            msg.get("from", {}).get("emailAddress", {}).get("name")
            if msg.get("from")
            else None
        )
        body = (msg.get("body") or {}).get("content", "") or msg.get("bodyPreview", "")
        subject = msg.get("subject") or ""

        # Contact + entreprise
        contact, contact_is_new = self._upsert_contact(from_addr, from_name, body)
        if contact_is_new:
            stats.new_contacts += 1
        if contact and contact.entreprise_id is None and from_addr:
            entreprise, ent_is_new = self._upsert_entreprise_from_email(from_addr)
            if ent_is_new:
                stats.new_entreprises += 1
            if entreprise:
                contact.entreprise_id = entreprise.id

        # Interaction
        occurred_at = None
        if (raw := msg.get("receivedDateTime")):
            with contextlib.suppress(ValueError):
                occurred_at = datetime.fromisoformat(raw.replace("Z", "+00:00"))

        signals = extract_business_signals(f"{subject}\n{body}")
        interaction = Interaction(
            type="email",
            direction="in",
            contact_id=contact.id if contact else None,
            entreprise_id=contact.entreprise_id if contact else None,
            sujet=subject[:500],
            contenu=body[:10000],
            outlook_msg_id=outlook_id,
            metadata_json={"signals": signals} if signals else None,
            occurred_at=occurred_at,
        )
        self.db.add(interaction)
        stats.new_messages += 1

        # Besoin
        need = extract_property_need(f"{subject}\n{body}")
        if need.typologie or need.surface_min or need.zones:
            besoin = Besoin(
                entreprise_id=contact.entreprise_id if contact else None,
                contact_id=contact.id if contact else None,
                typologie=need.typologie,
                surface_min=need.surface_min,
                surface_max=need.surface_max,
                budget_max=need.budget_max,
                zones=need.zones or None,
                timing=need.timing,
                statut="actif",
            )
            self.db.add(besoin)
            stats.new_besoins += 1

        return True

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _upsert_contact(
        self, email: str | None, name: str | None, body: str
    ) -> tuple[Contact | None, bool]:
        if not email:
            return None, False
        contact = self.db.scalar(select(Contact).where(Contact.email == email))
        if contact:
            return contact, False
        sig = parse_signature(body)
        prenom, nom = None, None
        if name and " " in name:
            prenom, nom = name.split(" ", 1)
        elif sig.nom_prenom and " " in sig.nom_prenom:
            prenom, nom = sig.nom_prenom.split(" ", 1)
        contact = Contact(
            prenom=prenom,
            nom=nom,
            email=email,
            telephone=sig.telephone,
            poste=sig.poste,
            source="outlook",
        )
        self.db.add(contact)
        self.db.flush()  # need id for subsequent FKs
        return contact, True

    def _upsert_entreprise_from_email(self, email: str) -> tuple[Entreprise | None, bool]:
        domain_root = extract_company_from_email(email)
        if not domain_root:
            return None, False
        # heuristique : raison_sociale = domain_root capitalisé
        rs = domain_root.replace("-", " ").title()
        existing = self.db.scalar(select(Entreprise).where(Entreprise.raison_sociale == rs))
        if existing:
            return existing, False
        ent = Entreprise(raison_sociale=rs)
        self.db.add(ent)
        self.db.flush()
        return ent, True
