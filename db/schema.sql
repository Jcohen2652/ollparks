-- OLL PARKS — schéma PostgreSQL initial
-- v0.1 — squelette des tables principales (à enrichir au fur et à mesure)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================
-- ENTREPRISES
-- ============================================================
CREATE TABLE entreprises (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    siren           VARCHAR(9) UNIQUE,
    raison_sociale  TEXT NOT NULL,
    secteur         TEXT,
    effectif        INT,
    ca              NUMERIC(15,2),
    site_web        TEXT,
    linkedin_url    TEXT,
    pappers_id      TEXT,
    score           INT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CONTACTS
-- ============================================================
CREATE TABLE contacts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entreprise_id   UUID REFERENCES entreprises(id) ON DELETE SET NULL,
    prenom          TEXT,
    nom             TEXT,
    email           TEXT,
    telephone       TEXT,
    poste           TEXT,
    role_immo       TEXT, -- DG, immobilier, expansion, etc.
    linkedin_url    TEXT,
    score           INT DEFAULT 0,
    source          TEXT, -- outlook, linkedin, pappers, manuel...
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_entreprise ON contacts(entreprise_id);

-- ============================================================
-- BIENS (offres immobilières)
-- ============================================================
CREATE TABLE biens (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference       TEXT UNIQUE,
    typologie       TEXT, -- bureaux, entrepôt, commerce, mixte...
    statut          TEXT DEFAULT 'disponible', -- disponible, sous-offre, vendu, retiré
    transaction     TEXT, -- vente, location
    surface_m2      NUMERIC(10,2),
    prix            NUMERIC(15,2),
    loyer_annuel    NUMERIC(15,2),
    adresse         TEXT,
    ville           TEXT,
    code_postal     VARCHAR(10),
    pays            TEXT DEFAULT 'France',
    geom            GEOMETRY(Point, 4326),
    off_market      BOOLEAN DEFAULT FALSE,
    mandat_interne  BOOLEAN DEFAULT FALSE,
    visial_qie_id   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_biens_geom ON biens USING GIST(geom);
CREATE INDEX idx_biens_typologie ON biens(typologie);

-- ============================================================
-- BESOINS (demandes des entreprises)
-- ============================================================
CREATE TABLE besoins (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entreprise_id   UUID REFERENCES entreprises(id) ON DELETE CASCADE,
    contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
    typologie       TEXT,
    transaction     TEXT, -- achat, location
    surface_min     NUMERIC(10,2),
    surface_max     NUMERIC(10,2),
    budget_min      NUMERIC(15,2),
    budget_max      NUMERIC(15,2),
    zones           TEXT[], -- liste de villes/codes postaux
    timing          TEXT, -- immédiat, 3 mois, 6 mois, 1 an...
    statut          TEXT DEFAULT 'actif',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PROPRIÉTAIRES
-- ============================================================
CREATE TABLE proprietaires (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type                TEXT, -- physique, sci, foncière, autre
    nom                 TEXT NOT NULL,
    siren               VARCHAR(9),
    pappers_id          TEXT,
    score               INT DEFAULT 0,
    contact_principal   UUID REFERENCES contacts(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE biens_proprietaires (
    bien_id         UUID REFERENCES biens(id) ON DELETE CASCADE,
    proprietaire_id UUID REFERENCES proprietaires(id) ON DELETE CASCADE,
    quote_part      NUMERIC(5,2), -- en %
    PRIMARY KEY (bien_id, proprietaire_id)
);

-- ============================================================
-- OPPORTUNITÉS (matching besoin ↔ bien)
-- ============================================================
CREATE TABLE opportunites (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    besoin_id       UUID REFERENCES besoins(id) ON DELETE CASCADE,
    bien_id         UUID REFERENCES biens(id) ON DELETE CASCADE,
    score           INT, -- /100
    score_detail    JSONB, -- détail des scores partiels
    statut          TEXT DEFAULT 'nouveau', -- nouveau, qualifié, proposé, visite, offre, signé, perdu
    action_recommandee TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(besoin_id, bien_id)
);
CREATE INDEX idx_opportunites_score ON opportunites(score DESC);

-- ============================================================
-- VISITES
-- ============================================================
CREATE TABLE visites (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bien_id             UUID REFERENCES biens(id),
    opportunite_id      UUID REFERENCES opportunites(id),
    date_visite         TIMESTAMPTZ,
    statut              TEXT DEFAULT 'planifiée',
    bon_de_visite_url   TEXT,
    denonce_url         TEXT,
    modalites_url       TEXT,
    notes               TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE visites_participants (
    visite_id   UUID REFERENCES visites(id) ON DELETE CASCADE,
    contact_id  UUID REFERENCES contacts(id) ON DELETE CASCADE,
    role        TEXT, -- prospect, proprietaire, broker, autre
    PRIMARY KEY (visite_id, contact_id)
);

-- ============================================================
-- DOCUMENTS
-- ============================================================
CREATE TABLE documents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type            TEXT, -- offre_acquisition, prise_a_bail, loi, mandat, courrier_proprietaire, bon_visite
    bien_id         UUID REFERENCES biens(id),
    entreprise_id   UUID REFERENCES entreprises(id),
    opportunite_id  UUID REFERENCES opportunites(id),
    storage_url     TEXT,
    template_id     TEXT,
    payload         JSONB, -- données injectées
    statut          TEXT DEFAULT 'brouillon',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INTERACTIONS (emails, appels, RDV, notes)
-- ============================================================
CREATE TABLE interactions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type            TEXT, -- email, appel, rdv, note
    direction       TEXT, -- in, out
    contact_id      UUID REFERENCES contacts(id),
    entreprise_id   UUID REFERENCES entreprises(id),
    bien_id         UUID REFERENCES biens(id),
    sujet           TEXT,
    contenu         TEXT,
    outlook_msg_id  TEXT UNIQUE, -- pour idempotence import Outlook
    metadata        JSONB,
    occurred_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_interactions_contact ON interactions(contact_id);
CREATE INDEX idx_interactions_entreprise ON interactions(entreprise_id);
CREATE INDEX idx_interactions_occurred ON interactions(occurred_at DESC);

-- ============================================================
-- AGENDA / RDV
-- ============================================================
-- ============================================================
-- USERS (auth)
-- ============================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    nom             TEXT,
    role            TEXT NOT NULL DEFAULT 'lecteur', -- admin|directeur|consultant|charge|lecteur
    actif           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_users_email ON users(email);

CREATE TABLE rdv (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    titre               TEXT,
    debut               TIMESTAMPTZ,
    fin                 TIMESTAMPTZ,
    lieu                TEXT,
    contact_id          UUID REFERENCES contacts(id),
    entreprise_id       UUID REFERENCES entreprises(id),
    bien_id             UUID REFERENCES biens(id),
    outlook_event_id    TEXT UNIQUE,
    rappel_minutes      INT DEFAULT 30,
    statut              TEXT DEFAULT 'planifié',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
