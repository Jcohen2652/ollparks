"""Tests des extracteurs Outlook (sans appel Graph)."""

from api.services.outlook import (
    extract_business_signals,
    extract_company_from_email,
    extract_property_need,
    parse_signature,
)

# ---------- extract_company_from_email ----------

def test_company_from_email_corporate():
    assert extract_company_from_email("sophie.martin@loreal.com") == "loreal"


def test_company_from_email_generic():
    assert extract_company_from_email("jean@gmail.com") is None
    assert extract_company_from_email("a@hotmail.fr") is None


def test_company_from_email_invalid():
    assert extract_company_from_email("") is None
    assert extract_company_from_email("notanemail") is None


def test_company_from_email_skip_generic_prefix():
    assert extract_company_from_email("contact@startup.io") == "startup"


# ---------- extract_property_need ----------

def test_extract_need_full():
    text = "Bonjour, nous cherchons des bureaux de 200 à 400 m² sur Paris, budget max 800 K€, urgent."
    n = extract_property_need(text)
    assert n.typologie == "bureaux"
    assert n.surface_min == 200
    assert n.surface_max == 400
    assert n.budget_max == 800_000
    assert n.timing == "immediat"
    assert "paris" in n.zones


def test_extract_need_entrepot():
    text = "Recherche entrepôt logistique 5000 m² dans le 93, livraison 6 mois."
    n = extract_property_need(text)
    assert n.typologie == "entrepot"
    assert n.surface_min == 5000
    assert n.timing == "6 mois"
    assert "93" in n.zones


def test_extract_need_empty():
    n = extract_property_need("")
    assert n.typologie is None
    assert n.zones == []


# ---------- extract_business_signals ----------

def test_signals_demenagement():
    assert "demenagement" in extract_business_signals("Nous prévoyons un déménagement T2.")


def test_signals_levee():
    assert "levee_de_fonds" in extract_business_signals("On vient de boucler notre série B.")


def test_signals_none():
    assert extract_business_signals("Bonjour, comment allez-vous ?") == []


# ---------- parse_signature ----------

def test_signature_with_marker():
    body = """Bonjour Pierre,
Pouvez-vous me confirmer la visite de demain ?
Merci

--
Sophie Martin
Directrice Immobilier
L'Oréal SA
+33 1 47 56 70 00
sophie.martin@loreal.com
https://www.loreal.com"""
    sig = parse_signature(body)
    assert sig.email == "sophie.martin@loreal.com"
    assert sig.telephone is not None
    assert "47 56" in sig.telephone or "47.56" in sig.telephone or "1" in sig.telephone
    assert sig.site_web == "https://www.loreal.com"
