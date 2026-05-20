"""
Scoring propriétaire (0-100).

Plus le score est élevé, plus le propriétaire est qualifié comme cible
pour une approche off-market (ancienneté, multi-actifs, accessibilité).
"""

from __future__ import annotations

from datetime import date


def score_proprietaire(prop: dict) -> int:
    """
    Inputs attendus (clés optionnelles) :
    - type: 'physique' | 'sci' | 'foncière'
    - date_creation: ISO date (str)
    - nb_biens_detenus: int
    - capital: float
    - dirigeants_emails: list[str]
    """
    score = 0

    # +20 SCI / +30 foncière (cibles privilégiées off-market — la foncière
    # est plus structurée, plus de biens, donc cible encore plus prioritaire).
    if prop.get("type") == "foncière":
        score += 30
    elif prop.get("type") == "sci":
        score += 20

    # +1 pour chaque année d'âge de la SCI (max 30)
    if (raw := prop.get("date_creation")):
        try:
            age = (date.today() - date.fromisoformat(raw)).days // 365
            score += min(30, age)
        except (ValueError, TypeError):
            pass

    # +5 par bien détenu (max 25)
    nb_biens = prop.get("nb_biens_detenus", 0) or 0
    score += min(25, nb_biens * 5)

    # +10 si dirigeant joignable (email connu)
    if prop.get("dirigeants_emails"):
        score += 10

    # +5 si capital > 100k€ (sérieux)
    capital = prop.get("capital", 0) or 0
    if capital >= 100_000:
        score += 5

    return min(100, max(0, score))
