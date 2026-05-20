"""Tests unitaires de l'auth (hashing + JWT)."""

from api.services.auth import (
    create_access_token,
    decode_token,
    hash_password,
    verify_password,
)


def test_hash_and_verify():
    h = hash_password("password123")
    assert verify_password("password123", h)
    assert not verify_password("wrong", h)


def test_jwt_roundtrip():
    token = create_access_token(subject="user@oll.fr", role="admin")
    payload = decode_token(token)
    assert payload["sub"] == "user@oll.fr"
    assert payload["role"] == "admin"
    assert "exp" in payload
