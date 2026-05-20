"""
Client Pappers API (Entreprises + Immo).

Doc : https://www.pappers.fr/api/documentation
Cache léger via lru_cache pour les méthodes idempotentes (à remplacer par Redis en prod).
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Any

import httpx

from api.config import get_settings

logger = logging.getLogger(__name__)

PAPPERS_BASE = "https://api.pappers.fr/v2"
PAPPERS_IMMO_BASE = "https://api.pappers.fr/immo/v1"  # endpoint indicatif, à adapter selon l'offre


class PappersError(Exception):
    pass


class PappersClient:
    def __init__(self, api_key: str | None = None, timeout: int = 20) -> None:
        s = get_settings()
        self.api_key = api_key or s.pappers_api_key
        if not self.api_key:
            raise PappersError("PAPPERS_API_KEY manquante")
        self.timeout = timeout

    def _get(self, base: str, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        params = {**(params or {}), "api_token": self.api_key}
        with httpx.Client(timeout=self.timeout) as client:
            r = client.get(f"{base}{path}", params=params)
            if r.status_code == 404:
                return {}
            if r.status_code >= 400:
                raise PappersError(f"GET {path} -> {r.status_code} {r.text[:300]}")
            return r.json()

    # ----- Entreprises -----

    def entreprise(self, siren: str) -> dict[str, Any]:
        """Fiche entreprise complète (dirigeants, financiers, dépôts, etc.)."""
        return self._get(PAPPERS_BASE, "/entreprise", {"siren": siren})

    def search_entreprises(self, query: str, per_page: int = 10) -> dict[str, Any]:
        return self._get(PAPPERS_BASE, "/recherche", {"q": query, "par_page": per_page})

    def dirigeants(self, siren: str) -> list[dict[str, Any]]:
        data = self.entreprise(siren)
        return data.get("representants", []) or data.get("dirigeants", []) or []

    # ----- Immo -----

    def search_immo(
        self,
        adresse: str | None = None,
        code_postal: str | None = None,
        ville: str | None = None,
        per_page: int = 20,
    ) -> dict[str, Any]:
        """Recherche d'un bien dans la base Pappers Immo."""
        params: dict[str, Any] = {"par_page": per_page}
        if adresse:
            params["adresse"] = adresse
        if code_postal:
            params["code_postal"] = code_postal
        if ville:
            params["ville"] = ville
        return self._get(PAPPERS_IMMO_BASE, "/recherche", params)

    def proprietaires_par_adresse(
        self, adresse: str, code_postal: str, ville: str | None = None
    ) -> list[dict[str, Any]]:
        """
        Identifie les propriétaires d'un bien à partir de son adresse.
        Retourne une liste normalisée [{type, nom, siren, pappers_id, raw}].
        """
        data = self.search_immo(adresse=adresse, code_postal=code_postal, ville=ville)
        results: list[dict[str, Any]] = []
        for hit in data.get("resultats", []) or []:
            for prop in hit.get("proprietaires", []) or []:
                p_type = "physique"
                if prop.get("siren"):
                    p_type = "sci" if "SCI" in (prop.get("denomination") or "").upper() else "foncière"
                results.append(
                    {
                        "type": p_type,
                        "nom": prop.get("denomination") or prop.get("nom_complet"),
                        "siren": prop.get("siren"),
                        "pappers_id": prop.get("id"),
                        "raw": prop,
                    }
                )
        return results


# ----- Cache wrapper léger (optionnel) -----

@lru_cache(maxsize=512)
def get_entreprise_cached(siren: str) -> dict[str, Any]:
    return PappersClient().entreprise(siren)
