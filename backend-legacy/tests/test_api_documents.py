"""Tests endpoints /documents (génération HTML, sans WeasyPrint)."""


def test_list_templates(client):
    r = client.get("/documents/templates")
    assert r.status_code == 200
    items = r.json()
    keys = {t["key"] for t in items}
    assert "bon_de_visite" in keys
    assert "offre_acquisition" in keys
    assert len(keys) == 8


def test_generate_html_offre_acquisition(client):
    payload = {
        "template": "offre_acquisition",
        "format": "html",
        "data": {
            "bien": {"reference": "OP-1", "adresse": "10 rue X"},
            "prospect": {"raison_sociale": "ACME", "siren": "123456789", "contact_nom": "Jean"},
            "prix_propose": 500_000,
            "delai_signature_promesse": "30j",
            "delai_acte_authentique": "60j",
        },
    }
    r = client.post("/documents/generate", json=payload)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/html")
    assert "ACME" in r.text
    assert "500 000" in r.text


def test_generate_missing_template(client):
    r = client.post("/documents/generate", json={"template": "nope", "data": {}, "format": "html"})
    assert r.status_code == 404
