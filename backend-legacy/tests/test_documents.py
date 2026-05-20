"""Tests des templates : champs requis + rendu HTML."""

import pytest

from api.services.documents import TEMPLATES, render_template


def test_templates_catalogue_complet():
    expected = {
        "bon_de_visite", "denonce_proprietaire", "modalites_visite",
        "offre_acquisition", "offre_prise_a_bail", "lettre_intention",
        "mandat", "courrier_proprietaire",
    }
    assert set(TEMPLATES.keys()) == expected


def test_render_bon_de_visite_minimal():
    html = render_template("bon_de_visite", {
        "date_visite": "12/05/2026 à 14h",
        "bien": {"reference": "OP-2026-001", "adresse": "15 rue de la Boétie", "ville": "Paris"},
        "prospect": {"raison_sociale": "Doctolib SAS", "contact_nom": "Julie Renard"},
    })
    assert "Bon de visite" in html
    assert "Doctolib" in html
    assert "Boétie" in html


def test_render_missing_required():
    with pytest.raises(ValueError, match="Champs requis manquants"):
        render_template("bon_de_visite", {})


def test_render_offre_acquisition():
    html = render_template("offre_acquisition", {
        "bien": {"reference": "OP-2026-002", "adresse": "8 av Hoche"},
        "prospect": {"raison_sociale": "BNP", "siren": "552081317", "contact_nom": "Pierre"},
        "prix_propose": 12_000_000,
        "delai_signature_promesse": "30 jours",
        "delai_acte_authentique": "90 jours",
    })
    assert "12 000 000" in html
    assert "BNP" in html


def test_render_courrier_proprietaire():
    html = render_template("courrier_proprietaire", {
        "proprietaire": {"nom": "SCI Le Marais"},
        "bien": {"adresse": "12 rue Vieille du Temple"},
        "agent": {"nom": "Sophie Bernard", "email": "sophie@oll-parks.fr"},
    })
    assert "SCI Le Marais" in html
    assert "Sophie Bernard" in html
