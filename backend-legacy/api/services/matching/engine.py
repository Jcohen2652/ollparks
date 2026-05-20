"""
Cerveau logiciel — moteur de matching offre / demande.

Score final /100 = somme des scores partiels - pénalités, clamped [0, 100].

Poids fixes en v1 (calibrables). En v2, les poids deviendront un modèle ML
entraîné sur l'historique des opportunités gagnées/perdues.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _to_float(v: Any) -> float | None:
    if v is None:
        return None
    if isinstance(v, Decimal):
        return float(v)
    return float(v)


def _interval_overlap_ratio(
    a_min: float | None, a_max: float | None, b_min: float | None, b_max: float | None
) -> float:
    """
    Ratio de recouvrement [0..1] entre l'intervalle besoin [a_min, a_max]
    et l'intervalle bien (point unique) ou [b_min, b_max].
    """
    if a_min is None and a_max is None:
        return 1.0  # aucun critère = pas de contrainte
    if b_min is None and b_max is None:
        return 0.0
    a_lo = a_min if a_min is not None else b_min
    a_hi = a_max if a_max is not None else b_max
    b_lo = b_min if b_min is not None else b_max
    b_hi = b_max if b_max is not None else b_min
    if a_lo is None or a_hi is None or b_lo is None or b_hi is None:
        return 0.0
    inter_lo = max(a_lo, b_lo)
    inter_hi = min(a_hi, b_hi)
    if inter_hi < inter_lo:
        return 0.0
    span = max(a_hi - a_lo, b_hi - b_lo, 1.0)
    return (inter_hi - inter_lo) / span


# ---------------------------------------------------------------------------
# Fonctions atomiques de scoring
# Plages : valeurs maximales documentées dans le cahier des charges (§4.1).
# ---------------------------------------------------------------------------

# Bonus typologie : +5 si match exact, sinon proximité.
_TYPO_PROXIMITE = {
    ("bureaux", "mixte"): 0.5,
    ("entrepot", "locaux_activite"): 0.7,
    ("locaux_activite", "entrepot"): 0.7,
    ("commerce", "mixte"): 0.4,
}


def score_asset(besoin: dict, bien: dict) -> int:
    """0-15 : adéquation typologie / qualité."""
    bt = (besoin.get("typologie") or "").lower()
    bn = (bien.get("typologie") or "").lower()
    if not bt or not bn:
        return 5  # neutre
    if bt == bn:
        return 15
    proximite = _TYPO_PROXIMITE.get((bt, bn), 0.0)
    return int(round(15 * proximite))


def score_geo(besoin: dict, bien: dict) -> int:
    """0-20 : adéquation géographique (zones besoin contiennent ville/CP du bien)."""
    zones = besoin.get("zones") or []
    if not zones:
        return 10  # neutre si pas de critère
    ville = (bien.get("ville") or "").lower()
    cp_complet = (bien.get("code_postal") or "")
    dpt = cp_complet[:2]
    for z in zones:
        zlow = z.lower()
        if zlow == ville:
            return 20
        # Match code postal complet (ex: "92300" == "92300")
        if zlow == cp_complet:
            return 18
        # Match département seul (ex: "92" == dpt)
        if len(zlow) == 2 and zlow == dpt:
            return 16
    return 0


def score_surface_budget(besoin: dict, bien: dict) -> int:
    """0-20 : fit surface (10) + budget (10)."""
    # Surface
    surf_score = int(
        round(
            10
            * _interval_overlap_ratio(
                _to_float(besoin.get("surface_min")),
                _to_float(besoin.get("surface_max")),
                _to_float(bien.get("surface_m2")),
                _to_float(bien.get("surface_m2")),
            )
        )
    )
    # Budget
    bien_prix = _to_float(bien.get("prix")) or _to_float(bien.get("loyer_annuel"))
    bud_score = int(
        round(
            10
            * _interval_overlap_ratio(
                _to_float(besoin.get("budget_min")),
                _to_float(besoin.get("budget_max")),
                bien_prix,
                bien_prix,
            )
        )
    )
    return surf_score + bud_score


_TIMING_URGENCE = {"immediat": 1.0, "3 mois": 0.8, "6 mois": 0.6, "1 an": 0.4}


def score_timing(besoin: dict, bien: dict) -> int:
    """0-15 : urgence du besoin × disponibilité du bien."""
    urgence = _TIMING_URGENCE.get((besoin.get("timing") or "").lower(), 0.5)
    dispo = 1.0 if bien.get("statut") == "disponible" else 0.3
    return int(round(15 * urgence * dispo))


def score_signals(besoin: dict) -> int:
    """0-10 : signaux business (statut actif, info récente, etc.)."""
    if besoin.get("statut") != "actif":
        return 0
    return 10


def score_history(history: dict) -> int:
    """
    0-10 : antécédents relationnels.
    history = {"interactions_30d": int, "deals_signes": int, "last_contact_days": int}
    """
    base = 0
    if history.get("interactions_30d", 0) >= 3:
        base += 4
    if history.get("deals_signes", 0) >= 1:
        base += 4
    last = history.get("last_contact_days", 9999)
    if last <= 7:
        base += 2
    return min(10, base)


def score_contact(contact: dict) -> int:
    """0-10 : qualité du contact (rôle, score CRM, présence email)."""
    if not contact:
        return 0
    base = 0
    if contact.get("email"):
        base += 3
    role = (contact.get("role_immo") or "").lower()
    if role in ("immobilier", "expansion", "dg"):
        base += 4
    base += min(3, (contact.get("score", 0) // 30))
    return min(10, base)


def penalties(besoin: dict, bien: dict, contact: dict) -> int:
    """0-30 : malus cumulés (dossier froid, pas de contact, etc.)."""
    p = 0
    if not contact or not contact.get("email"):
        p += 10
    if bien.get("statut") in ("vendu", "retiré"):
        p += 30
    if besoin.get("statut") != "actif":
        p += 15
    return min(30, p)


# ---------------------------------------------------------------------------
# Score final + recommandation
# ---------------------------------------------------------------------------

def calculate_final_score(
    besoin: dict, bien: dict, contact: dict | None = None, history: dict | None = None
) -> tuple[int, dict[str, int]]:
    contact = contact or {}
    history = history or {}
    parts = {
        "asset":          score_asset(besoin, bien),
        "geo":            score_geo(besoin, bien),
        "surface_budget": score_surface_budget(besoin, bien),
        "timing":         score_timing(besoin, bien),
        "signals":        score_signals(besoin),
        "history":        score_history(history),
        "contact":        score_contact(contact),
    }
    base = sum(parts.values())
    final = max(0, min(100, base - penalties(besoin, bien, contact)))
    return final, parts


def recommend_action(score: int) -> str:
    if score >= 80:
        return "appel_immediat"
    if score >= 60:
        return "envoi_fiche"
    if score >= 40:
        return "qualification"
    return "veille"
