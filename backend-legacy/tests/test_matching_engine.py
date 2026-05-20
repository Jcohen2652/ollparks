"""Tests unitaires du moteur de matching (sans DB)."""

from api.services.matching import (
    calculate_final_score,
    penalties,
    recommend_action,
    score_asset,
    score_contact,
    score_geo,
    score_signals,
    score_surface_budget,
    score_timing,
)

# ---------- score_asset ----------

def test_score_asset_match_exact():
    assert score_asset({"typologie": "bureaux"}, {"typologie": "bureaux"}) == 15


def test_score_asset_proximite():
    # bureaux ↔ mixte = proximité 0.5 → 7.5 → 8 (round)
    assert score_asset({"typologie": "bureaux"}, {"typologie": "mixte"}) == 8


def test_score_asset_inconnu():
    assert score_asset({}, {"typologie": "bureaux"}) == 5


# ---------- score_geo ----------

def test_score_geo_ville_match():
    assert score_geo({"zones": ["paris"]}, {"ville": "Paris", "code_postal": "75001"}) == 20


def test_score_geo_dpt_match():
    assert score_geo({"zones": ["92"]}, {"ville": "Levallois", "code_postal": "92300"}) == 16


def test_score_geo_no_match():
    assert score_geo({"zones": ["lyon"]}, {"ville": "Paris", "code_postal": "75001"}) == 0


def test_score_geo_no_zones():
    assert score_geo({"zones": []}, {"ville": "Paris"}) == 10


# ---------- score_surface_budget ----------

def test_score_surface_budget_full_match():
    besoin = {
        "surface_min": 100,
        "surface_max": 200,
        "budget_min": 1_000_000,
        "budget_max": 2_000_000,
    }
    bien = {"surface_m2": 150, "prix": 1_500_000}
    score = score_surface_budget(besoin, bien)
    assert 0 <= score <= 20


def test_score_surface_budget_zero_when_out():
    besoin = {"surface_min": 500, "surface_max": 800, "budget_max": 100}
    bien = {"surface_m2": 100, "prix": 5_000_000}
    assert score_surface_budget(besoin, bien) == 0


# ---------- score_timing ----------

def test_score_timing_immediat_dispo():
    assert score_timing({"timing": "immediat"}, {"statut": "disponible"}) == 15


def test_score_timing_long_terme():
    s = score_timing({"timing": "1 an"}, {"statut": "disponible"})
    assert 0 < s < 15


def test_score_timing_bien_indispo():
    s = score_timing({"timing": "immediat"}, {"statut": "vendu"})
    assert s <= 5


# ---------- score_signals ----------

def test_score_signals_actif():
    assert score_signals({"statut": "actif"}) == 10


def test_score_signals_inactif():
    assert score_signals({"statut": "perdu"}) == 0


# ---------- score_contact ----------

def test_score_contact_decideur_immo():
    c = {"email": "x@y.fr", "role_immo": "immobilier", "score": 60}
    assert score_contact(c) >= 8


def test_score_contact_vide():
    assert score_contact({}) == 0


# ---------- penalties ----------

def test_penalties_bien_vendu():
    p = penalties({"statut": "actif"}, {"statut": "vendu"}, {"email": "x@y.fr"})
    assert p == 30


def test_penalties_clean():
    p = penalties({"statut": "actif"}, {"statut": "disponible"}, {"email": "x@y.fr"})
    assert p == 0


# ---------- calculate_final_score ----------

def test_calculate_final_score_high_match():
    besoin = {
        "typologie": "bureaux",
        "surface_min": 200,
        "surface_max": 400,
        "budget_min": 800_000,
        "budget_max": 1_500_000,
        "zones": ["paris"],
        "timing": "immediat",
        "statut": "actif",
    }
    bien = {
        "typologie": "bureaux",
        "surface_m2": 300,
        "prix": 1_200_000,
        "ville": "Paris",
        "code_postal": "75008",
        "statut": "disponible",
    }
    contact = {"email": "x@y.fr", "role_immo": "immobilier", "score": 80}
    score, parts = calculate_final_score(besoin, bien, contact, {"interactions_30d": 5})
    assert score >= 70
    assert set(parts.keys()) == {
        "asset", "geo", "surface_budget", "timing", "signals", "history", "contact"
    }


def test_calculate_final_score_low_match():
    besoin = {"typologie": "commerce", "zones": ["marseille"], "statut": "perdu"}
    bien = {"typologie": "entrepot", "ville": "lille", "statut": "retiré"}
    score, _ = calculate_final_score(besoin, bien, {}, {})
    assert score == 0


def test_calculate_final_score_clamp_100():
    """Le score ne dépasse jamais 100."""
    besoin = {
        "typologie": "bureaux",
        "surface_min": 100, "surface_max": 100,
        "budget_min": 100, "budget_max": 100,
        "zones": ["paris"], "timing": "immediat", "statut": "actif",
    }
    bien = {
        "typologie": "bureaux",
        "surface_m2": 100, "prix": 100,
        "ville": "paris", "code_postal": "75001", "statut": "disponible",
    }
    contact = {"email": "a@b.fr", "role_immo": "immobilier", "score": 90}
    history = {"interactions_30d": 10, "deals_signes": 3, "last_contact_days": 1}
    score, _ = calculate_final_score(besoin, bien, contact, history)
    assert score <= 100


# ---------- recommend_action ----------

def test_recommend_action_thresholds():
    assert recommend_action(85) == "appel_immediat"
    assert recommend_action(70) == "envoi_fiche"
    assert recommend_action(50) == "qualification"
    assert recommend_action(20) == "veille"
    assert recommend_action(0) == "veille"
