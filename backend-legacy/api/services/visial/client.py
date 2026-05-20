"""
Client VISIAL QIE — wrapper REST.

⚠️ L'API exacte de VISIAL QIE n'est pas publique : ce client définit l'interface
attendue côté OLL PARKS (à câbler sur l'API réelle au moment de l'intégration).

Endpoints supposés :
  GET  /actifs                 : liste des actifs
  GET  /actifs/{id}            : détail
  GET  /actifs/{id}/dossier    : suivi dossier transaction
  GET  /actifs/{id}/technique  : DPE, audit, expertise
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)


class VisialError(Exception):
    pass


class VisialClient:
    def __init__(self, base_url: str | None = None, api_key: str | None = None) -> None:
        from api.config import get_settings

        s = get_settings()
        self.base_url = base_url or getattr(s, "visial_qie_base_url", None) or os_env("VISIAL_QIE_BASE_URL")
        self.api_key = api_key or getattr(s, "visial_qie_api_key", None) or os_env("VISIAL_QIE_API_KEY")
        if not self.base_url or not self.api_key:
            raise VisialError("VISIAL_QIE_BASE_URL et VISIAL_QIE_API_KEY requis")

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.api_key}", "Accept": "application/json"}

    def _get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        with httpx.Client(timeout=30) as client:
            r = client.get(f"{self.base_url}{path}", headers=self._headers(), params=params)
            if r.status_code == 404:
                return {}
            if r.status_code >= 400:
                raise VisialError(f"GET {path} -> {r.status_code} {r.text[:200]}")
            return r.json()

    def list_actifs(self, page: int = 1, per_page: int = 100) -> list[dict[str, Any]]:
        data = self._get("/actifs", params={"page": page, "per_page": per_page})
        return data.get("results") or data.get("data") or data if isinstance(data, list) else []

    def get_actif(self, visial_id: str) -> dict[str, Any]:
        return self._get(f"/actifs/{visial_id}")

    def get_dossier(self, visial_id: str) -> dict[str, Any]:
        return self._get(f"/actifs/{visial_id}/dossier")

    def get_technique(self, visial_id: str) -> dict[str, Any]:
        return self._get(f"/actifs/{visial_id}/technique")


def os_env(key: str) -> str | None:
    import os
    return os.environ.get(key)
