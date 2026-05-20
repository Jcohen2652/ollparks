"""Tests d'auth via TestClient."""

from api.models import User
from api.services.auth import hash_password


def test_login_then_me(client, db_session):
    user = User(
        email="t@x.fr",
        password_hash=hash_password("secret"),
        role="admin",
    )
    db_session.add(user)
    db_session.commit()

    # OAuth2PasswordRequestForm = form-encoded
    r = client.post(
        "/auth/login",
        data={"username": "t@x.fr", "password": "secret"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["role"] == "admin"
    assert body["access_token"]

    # /me avec le token
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200
    assert me.json()["email"] == "t@x.fr"


def test_login_wrong_password(client, db_session):
    user = User(email="t2@x.fr", password_hash=hash_password("good"), role="lecteur")
    db_session.add(user)
    db_session.commit()

    r = client.post(
        "/auth/login",
        data={"username": "t2@x.fr", "password": "BAD"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert r.status_code == 401


def test_me_without_token(client):
    r = client.get("/auth/me")
    assert r.status_code == 401
