"""
Extraction structurée à partir des emails Outlook.

Approche v1 : règles regex + listes (rapide, déterministe, sans dépendance ML lourde).
Approche v2 : remplacer chaque extracteur par un modèle (spaCy fr-core-news + LLM small).
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# ---------------------------------------------------------------------------
# Signature parser
# ---------------------------------------------------------------------------

PHONE_RE = re.compile(r"(?:\+33\s?|0)\s?[1-9](?:[\s.-]?\d{2}){4}")
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
URL_RE = re.compile(r"https?://[^\s]+")

# Marqueurs de début de signature : ligne avec --, "Cordialement", "Bien à vous", etc.
SIG_MARKERS = [
    "--",
    "—",
    "cordialement",
    "bien à vous",
    "bien cordialement",
    "salutations",
    "best regards",
    "kind regards",
    "regards",
]


@dataclass
class Signature:
    nom_prenom: str | None
    poste: str | None
    societe: str | None
    email: str | None
    telephone: str | None
    site_web: str | None


def parse_signature(body: str) -> Signature:
    """
    Heuristique simple : isole le bas du mail (≈ 8 dernières lignes non vides),
    extrait téléphone, email, URL, et tente de deviner nom/poste/société.
    """
    if not body:
        return Signature(None, None, None, None, None, None)

    lines = [ln.strip() for ln in body.splitlines() if ln.strip()]
    # Tronque au marqueur de signature s'il existe
    sig_start = None
    for i, ln in enumerate(lines):
        low = ln.lower()
        if any(low.startswith(m) for m in SIG_MARKERS):
            sig_start = i + 1
            break
    candidates = lines[sig_start:] if sig_start is not None else lines[-8:]

    phone = next((PHONE_RE.search(ln).group(0) for ln in candidates if PHONE_RE.search(ln)), None)
    email = next((EMAIL_RE.search(ln).group(0) for ln in candidates if EMAIL_RE.search(ln)), None)
    url = next((URL_RE.search(ln).group(0) for ln in candidates if URL_RE.search(ln)), None)

    # Heuristique nom/prénom : 1ère ligne courte (≤ 40 chars) avec capitales
    nom = next(
        (
            ln
            for ln in candidates
            if 4 <= len(ln) <= 40
            and any(c.isupper() for c in ln)
            and not PHONE_RE.search(ln)
            and not EMAIL_RE.search(ln)
            and not URL_RE.search(ln)
        ),
        None,
    )

    # Heuristique société : ligne avec "SAS", "SA", "SARL", "Group", "Holding"
    societe_keywords = ("SAS", "SA", "SARL", "SCI", "Group", "Holding", "International")
    societe = next(
        (ln for ln in candidates if any(kw in ln for kw in societe_keywords)), None
    )

    # Heuristique poste : ligne avec "Director", "Directeur", "Manager", etc.
    poste_keywords = ("Director", "Directeur", "Directrice", "Manager", "Head", "CEO", "COO", "CFO", "Chargé", "Resp.", "Responsable")
    poste = next(
        (ln for ln in candidates if any(kw in ln for kw in poste_keywords)), None
    )

    return Signature(
        nom_prenom=nom, poste=poste, societe=societe, email=email, telephone=phone, site_web=url
    )


# ---------------------------------------------------------------------------
# Domain → entreprise mapping
# ---------------------------------------------------------------------------

GENERIC_DOMAINS = {
    "gmail.com", "hotmail.com", "hotmail.fr", "outlook.com", "outlook.fr",
    "yahoo.com", "yahoo.fr", "free.fr", "wanadoo.fr", "orange.fr", "laposte.net",
    "live.fr", "me.com", "icloud.com", "proton.me", "protonmail.com",
}


def extract_company_from_email(email: str) -> str | None:
    """
    Retourne le nom de domaine principal si ce n'est pas un mail générique.
    'sophie.martin@loreal.com' -> 'loreal'
    'jean@gmail.com'           -> None
    """
    if not email or "@" not in email:
        return None
    domain = email.split("@", 1)[1].lower().strip()
    if domain in GENERIC_DOMAINS:
        return None
    parts = domain.split(".")
    # heuristique : prendre la 1ère partie significative
    candidate = parts[0]
    if candidate in {"mail", "contact", "info", "hello"}:
        candidate = parts[1] if len(parts) > 1 else candidate
    return candidate


# ---------------------------------------------------------------------------
# Property need extraction
# ---------------------------------------------------------------------------

SURFACE_RE = re.compile(r"(\d{2,5})\s*(?:m²|m2|metres?\s*carres?|sqm)", re.IGNORECASE)
# Fourchettes "X à Y m²", "X-Y m²", "X/Y m²", "X to Y m²" — l'unité ne suit que le 2ème nombre.
SURFACE_RANGE_RE = re.compile(
    r"(\d{2,5})\s*(?:à|a|-|–|—|/|to)\s*(\d{2,5})\s*(?:m²|m2|metres?\s*carres?|sqm)",
    re.IGNORECASE,
)
BUDGET_RE = re.compile(
    r"(\d{1,4}(?:[\s.,]\d{3})*(?:[.,]\d+)?)\s*(?:k€|K€|M€|m€|€|euros?|EUR)",
    re.IGNORECASE,
)
TIMING_KEYWORDS = {
    "immediat": ["urgent", "immédiat", "asap", "tout de suite", "rapidement"],
    "3 mois": ["3 mois", "trois mois", "trimestre"],
    "6 mois": ["6 mois", "six mois", "semestre"],
    "1 an": ["1 an", "un an", "année", "fin d'année"],
}
TYPOLOGIE_KEYWORDS = {
    "bureaux": ["bureaux", "bureau", "openspace", "open-space", "tertiaire"],
    "entrepot": ["entrepôt", "entrepot", "logistique", "stockage", "warehouse"],
    "commerce": ["commerce", "boutique", "magasin", "retail", "pop-up"],
    "locaux_activite": ["locaux d'activité", "locaux d activite", "locaux mixtes"],
}
ZONE_RE = re.compile(
    r"\b(paris|lyon|marseille|toulouse|bordeaux|lille|nantes|strasbourg|nice|rennes|montpellier|"
    r"\d{2,5})\b",
    re.IGNORECASE,
)


@dataclass
class PropertyNeed:
    typologie: str | None
    surface_min: int | None
    surface_max: int | None
    budget_max: int | None
    timing: str | None
    zones: list[str]


def _parse_budget(raw: str) -> int | None:
    """'1 500 K€' -> 1500000 ; '12 M€' -> 12000000 ; '500 €' -> 500"""
    if not raw:
        return None
    text = raw.lower().replace(" ", "").replace(",", ".")
    multiplier = 1
    if "m€" in text or "m€" in text:
        multiplier = 1_000_000
        num_str = re.sub(r"[^\d.]", "", text)
    elif "k€" in text:
        multiplier = 1_000
        num_str = re.sub(r"[^\d.]", "", text)
    else:
        num_str = re.sub(r"[^\d.]", "", text)
    try:
        return int(float(num_str) * multiplier)
    except (ValueError, TypeError):
        return None


def extract_property_need(text: str) -> PropertyNeed:
    if not text:
        return PropertyNeed(None, None, None, None, None, [])
    low = text.lower()

    # Typologie
    typologie = None
    for typ, keywords in TYPOLOGIE_KEYWORDS.items():
        if any(k in low for k in keywords):
            typologie = typ
            break

    # Surface : on cherche d'abord une fourchette explicite ("200 à 400 m²"),
    # sinon on retombe sur les nombres isolés suivis de l'unité.
    surface_min: int | None = None
    surface_max: int | None = None
    if (rng := SURFACE_RANGE_RE.search(text)):
        a, b = int(rng.group(1)), int(rng.group(2))
        surface_min, surface_max = min(a, b), max(a, b)
    else:
        surfaces = [int(m.group(1)) for m in SURFACE_RE.finditer(text)]
        if surfaces:
            surface_min = min(surfaces)
            surface_max = max(surfaces) if len(surfaces) > 1 else None

    # Budget
    budget_matches = [m.group(0) for m in BUDGET_RE.finditer(text)]
    budgets = [_parse_budget(b) for b in budget_matches if _parse_budget(b)]
    budget_max = max(budgets) if budgets else None

    # Timing
    timing = None
    for label, keywords in TIMING_KEYWORDS.items():
        if any(k in low for k in keywords):
            timing = label
            break

    # Zones
    zones = list({z.lower() for z in ZONE_RE.findall(text)})

    return PropertyNeed(
        typologie=typologie,
        surface_min=surface_min,
        surface_max=surface_max,
        budget_max=budget_max,
        timing=timing,
        zones=zones,
    )


# ---------------------------------------------------------------------------
# Business signals
# ---------------------------------------------------------------------------

SIGNAL_PATTERNS = {
    "demenagement":   ["déménag", "demenag", "relocation", "nouveau site", "nouveaux locaux"],
    "levee_de_fonds": ["levée de fonds", "levee de fonds", "série a", "série b", "fundraising", "round"],
    "croissance":     ["embauche", "recrutement massif", "ouverture", "expansion", "scale"],
    "restructuration": ["restructuration", "fermeture", "plan social", "réduction"],
}


def extract_business_signals(text: str) -> list[str]:
    """Retourne la liste des signaux faibles détectés dans le texte."""
    if not text:
        return []
    low = text.lower()
    return [signal for signal, patterns in SIGNAL_PATTERNS.items() if any(p in low for p in patterns)]
