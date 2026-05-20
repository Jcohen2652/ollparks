"""Fixtures pytest : SQLite in-memory pour tests d'intégration légers.

NOTE: PostGIS n'est pas dispo en SQLite. Les tests qui ont besoin de la géo
sont skippés (à exécuter avec un Postgres réel via tox/CI séparé).
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from api.db import Base, get_db
from api.main import app

# SQLite (sans PostGIS)
TEST_DB_URL = "sqlite+pysqlite:///:memory:"


@pytest.fixture(scope="session")
def engine():
    # check_same_thread=False + StaticPool : partage une unique connexion
    # in-memory entre threads (sinon FastAPI TestClient ouvre une nouvelle
    # connexion = nouvelle DB vide = "no such table: users").
    eng = create_engine(
        TEST_DB_URL,
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # SQLite : ignore les types Geometry (ils ne seront pas créés mais la table
    # sera quand même générée pour les autres colonnes via une stratégie de fallback)
    @event.listens_for(eng, "connect")
    def _enable_fk(dbapi_conn, _):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    # Tables à skipper : utilisent PostGIS (Geometry) ou ARRAY (non supportés en SQLite)
    skip_tables = {"biens", "interactions", "besoins", "opportunites", "documents"}

    # Étend transitivement : toute table avec une FK vers une table skipée doit aussi
    # être skipée, sinon SQLAlchemy plante en essayant de résoudre la FK au moment du
    # create_all (NoReferencedTableError).
    changed = True
    while changed:
        changed = False
        for table in Base.metadata.tables.values():
            if table.name in skip_tables:
                continue
            for fk in table.foreign_keys:
                if fk.column.table.name in skip_tables:
                    skip_tables.add(table.name)
                    changed = True
                    break

    safe_metadata = type(Base.metadata)()
    for table in Base.metadata.tables.values():
        if table.name not in skip_tables:
            table.to_metadata(safe_metadata)
    safe_metadata.create_all(bind=eng)
    return eng


@pytest.fixture
def db_session(engine):
    SessionTest = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    db = SessionTest()
    try:
        yield db
    finally:
        db.rollback()
        db.close()


@pytest.fixture
def client(db_session):
    def _override():
        yield db_session

    app.dependency_overrides[get_db] = _override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
