def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert "app" in body


def test_openapi_includes_modules(client):
    r = client.get("/openapi.json")
    assert r.status_code == 200
    paths = set(r.json()["paths"].keys())
    # Sanity check : les principaux endpoints sont enregistrés
    expected_substrings = [
        "/health",
        "/entreprises",
        "/contacts",
        "/biens",
        "/besoins",
        "/opportunites",
        "/matching/run",
        "/outlook/sync",
        "/pappers/proprietaires",
        "/visites",
        "/documents/templates",
        "/agenda",
        "/visial/sync",
        "/auth/login",
        "/crm/pipeline",
    ]
    for sub in expected_substrings:
        assert any(sub in p for p in paths), f"Endpoint manquant : {sub}"
