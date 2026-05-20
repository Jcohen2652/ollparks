"""
Client Microsoft Graph (OAuth client_credentials).

Auth : flow application (server-to-server). Permissions Graph requises (Application) :
- Mail.Read
- Calendars.Read
- Contacts.Read
- User.Read.All
"""

from __future__ import annotations

import logging
from typing import Any
from urllib.parse import urlencode

import httpx
import msal

from api.config import get_settings

logger = logging.getLogger(__name__)

GRAPH_BASE = "https://graph.microsoft.com/v1.0"
SCOPES = ["https://graph.microsoft.com/.default"]


class GraphError(Exception):
    pass


class GraphClient:
    """
    Petit wrapper requêtes Graph + gestion token.
    Utilise MSAL (ConfidentialClientApplication) pour l'OAuth.
    """

    def __init__(self) -> None:
        s = get_settings()
        if not (s.microsoft_tenant_id and s.microsoft_client_id and s.microsoft_client_secret):
            raise GraphError(
                "Microsoft credentials manquantes (MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET)"
            )
        self._app = msal.ConfidentialClientApplication(
            client_id=s.microsoft_client_id,
            client_credential=s.microsoft_client_secret,
            authority=f"https://login.microsoftonline.com/{s.microsoft_tenant_id}",
        )
        self._token: str | None = None

    def _acquire_token(self) -> str:
        result = self._app.acquire_token_silent(SCOPES, account=None)
        if not result:
            result = self._app.acquire_token_for_client(scopes=SCOPES)
        if not result or "access_token" not in result:
            raise GraphError(f"Impossible d'obtenir un token Graph: {result}")
        self._token = result["access_token"]
        return self._token

    def _headers(self) -> dict[str, str]:
        token = self._token or self._acquire_token()
        return {"Authorization": f"Bearer {token}", "Accept": "application/json"}

    def get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        url = f"{GRAPH_BASE}{path}"
        if params:
            url = f"{url}?{urlencode(params, doseq=True)}"
        with httpx.Client(timeout=30) as client:
            r = client.get(url, headers=self._headers())
            if r.status_code == 401:
                self._acquire_token()
                r = client.get(url, headers=self._headers())
            if r.status_code >= 400:
                raise GraphError(f"GET {path} -> {r.status_code} {r.text[:300]}")
            return r.json()

    def iter_messages(
        self,
        user_id: str,
        since_iso: str | None = None,
        top: int = 100,
    ):
        """
        Itère les messages d'un mailbox. Pagination via @odata.nextLink.
        """
        select = ",".join([
            "id",
            "subject",
            "from",
            "toRecipients",
            "receivedDateTime",
            "bodyPreview",
            "body",
            "internetMessageId",
        ])
        params: dict[str, Any] = {
            "$select": select,
            "$top": str(top),
            "$orderby": "receivedDateTime desc",
        }
        if since_iso:
            params["$filter"] = f"receivedDateTime ge {since_iso}"

        path: str | None = f"/users/{user_id}/messages"
        first = True
        while path:
            data = self.get(path, params=params if first else None) if first else self._raw_get(path)
            first = False
            yield from data.get("value", [])
            path = data.get("@odata.nextLink")
            if path and path.startswith(GRAPH_BASE):
                path = path[len(GRAPH_BASE):]

    def _raw_get(self, full_url: str) -> dict[str, Any]:
        # full_url is already an absolute Graph URL
        with httpx.Client(timeout=30) as client:
            r = client.get(full_url, headers=self._headers())
            if r.status_code >= 400:
                raise GraphError(f"GET {full_url} -> {r.status_code}")
            return r.json()
