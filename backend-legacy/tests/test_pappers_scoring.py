from datetime import date, timedelta

from api.services.pappers import score_proprietaire


def test_score_proprietaire_sci_ancienne():
    p = {
        "type": "sci",
        "date_creation": (date.today() - timedelta(days=365 * 25)).isoformat(),
        "nb_biens_detenus": 4,
        "dirigeants_emails": ["x@y.fr"],
        "capital": 200_000,
    }
    s = score_proprietaire(p)
    # 20 (sci) + 25 (âge max) + 20 (4*5) + 10 (email) + 5 (capital) = 80
    assert s == 80


def test_score_proprietaire_physique_basique():
    p = {"type": "physique"}
    assert score_proprietaire(p) == 0


def test_score_proprietaire_clamp_100():
    p = {
        "type": "foncière",
        "date_creation": "1900-01-01",
        "nb_biens_detenus": 1000,
        "dirigeants_emails": ["x@y.fr"],
        "capital": 10_000_000,
    }
    assert score_proprietaire(p) == 100
