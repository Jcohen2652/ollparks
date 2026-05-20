-- ================================================================
-- OLL PARKS — Migration initiale Supabase
-- 11 tables + extensions + RLS + triggers
-- ================================================================

-- Extensions Supabase (postgis = géo, pg_cron = sync auto)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ================================================================
-- USERS — pont avec auth.users de Supabase
-- ================================================================
-- On ne stocke PAS le password : Supabase Auth gère ça.
-- Cette table contient juste les infos métier (rôle, nom).
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nom       TEXT,
    role      TEXT NOT NULL DEFAULT 'lecteur'
              CHECK (role IN ('admin','directeur','consultant','charge','lecteur')),
    actif     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger : à chaque création d'utilisateur dans auth.users, créer un profil
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO public.user_profiles (id, nom)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nom', NEW.email));
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Helper : rôle de l'utilisateur courant
CREATE OR REPLACE FUNCTION public.current_user_role() RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT role FROM public.user_profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$ SELECT public.current_user_role() = 'admin'; $$;

-- ================================================================
-- ENTREPRISES
-- ================================================================
CREATE TABLE public.entreprises (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    siren           VARCHAR(9) UNIQUE,
    raison_sociale  TEXT NOT NULL,
    secteur         TEXT,
    effectif        INT,
    ca              NUMERIC(15,2),
    site_web        TEXT,
    linkedin_url    TEXT,
    pappers_id      TEXT,
    score           INT NOT NULL DEFAULT 0,
    owner_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_entreprises_siren ON public.entreprises(siren);
CREATE INDEX idx_entreprises_score ON public.entreprises(score DESC);

-- ================================================================
-- CONTACTS
-- ================================================================
CREATE TABLE public.contacts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entreprise_id   UUID REFERENCES public.entreprises(id) ON DELETE SET NULL,
    prenom          TEXT,
    nom             TEXT,
    email           TEXT,
    telephone       TEXT,
    poste           TEXT,
    role_immo       TEXT,
    linkedin_url    TEXT,
    score           INT NOT NULL DEFAULT 0,
    source          TEXT,
    owner_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_contacts_email ON public.contacts(email);
CREATE INDEX idx_contacts_entreprise ON public.contacts(entreprise_id);

-- ================================================================
-- BIENS
-- ================================================================
CREATE TABLE public.biens (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference       TEXT UNIQUE,
    typologie       TEXT,
    statut          TEXT NOT NULL DEFAULT 'disponible',
    transaction     TEXT,
    surface_m2      NUMERIC(10,2),
    prix            NUMERIC(15,2),
    loyer_annuel    NUMERIC(15,2),
    adresse         TEXT,
    ville           TEXT,
    code_postal     VARCHAR(10),
    pays            TEXT NOT NULL DEFAULT 'France',
    geom            GEOMETRY(Point, 4326),
    off_market      BOOLEAN NOT NULL DEFAULT FALSE,
    mandat_interne  BOOLEAN NOT NULL DEFAULT FALSE,
    visial_qie_id   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_biens_geom ON public.biens USING GIST(geom);
CREATE INDEX idx_biens_typologie ON public.biens(typologie);
CREATE INDEX idx_biens_statut ON public.biens(statut);

-- ================================================================
-- BESOINS
-- ================================================================
CREATE TABLE public.besoins (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entreprise_id   UUID REFERENCES public.entreprises(id) ON DELETE CASCADE,
    contact_id      UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    typologie       TEXT,
    transaction     TEXT,
    surface_min     NUMERIC(10,2),
    surface_max     NUMERIC(10,2),
    budget_min      NUMERIC(15,2),
    budget_max      NUMERIC(15,2),
    zones           TEXT[],
    timing          TEXT,
    statut          TEXT NOT NULL DEFAULT 'actif',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_besoins_entreprise ON public.besoins(entreprise_id);
CREATE INDEX idx_besoins_statut ON public.besoins(statut);

-- ================================================================
-- PROPRIÉTAIRES
-- ================================================================
CREATE TABLE public.proprietaires (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type              TEXT,
    nom               TEXT NOT NULL,
    siren             VARCHAR(9),
    pappers_id        TEXT,
    score             INT NOT NULL DEFAULT 0,
    contact_principal UUID REFERENCES public.contacts(id),
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.biens_proprietaires (
    bien_id         UUID REFERENCES public.biens(id) ON DELETE CASCADE,
    proprietaire_id UUID REFERENCES public.proprietaires(id) ON DELETE CASCADE,
    quote_part      NUMERIC(5,2),
    PRIMARY KEY (bien_id, proprietaire_id)
);

-- ================================================================
-- OPPORTUNITÉS (matching)
-- ================================================================
CREATE TABLE public.opportunites (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    besoin_id          UUID NOT NULL REFERENCES public.besoins(id) ON DELETE CASCADE,
    bien_id            UUID NOT NULL REFERENCES public.biens(id) ON DELETE CASCADE,
    score              INT,
    score_detail       JSONB,
    statut             TEXT NOT NULL DEFAULT 'nouveau',
    action_recommandee TEXT,
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    updated_at         TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(besoin_id, bien_id)
);
CREATE INDEX idx_opportunites_score ON public.opportunites(score DESC NULLS LAST);
CREATE INDEX idx_opportunites_statut ON public.opportunites(statut);

-- ================================================================
-- VISITES
-- ================================================================
CREATE TABLE public.visites (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bien_id           UUID REFERENCES public.biens(id),
    opportunite_id    UUID REFERENCES public.opportunites(id),
    date_visite       TIMESTAMPTZ,
    statut            TEXT NOT NULL DEFAULT 'planifiée',
    bon_de_visite_url TEXT,
    denonce_url       TEXT,
    modalites_url     TEXT,
    notes             TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.visites_participants (
    visite_id   UUID REFERENCES public.visites(id) ON DELETE CASCADE,
    contact_id  UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
    role        TEXT,
    PRIMARY KEY (visite_id, contact_id)
);

-- ================================================================
-- DOCUMENTS
-- ================================================================
CREATE TABLE public.documents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type            TEXT,
    bien_id         UUID REFERENCES public.biens(id),
    entreprise_id   UUID REFERENCES public.entreprises(id),
    opportunite_id  UUID REFERENCES public.opportunites(id),
    storage_path    TEXT,
    template_id     TEXT,
    payload         JSONB,
    statut          TEXT NOT NULL DEFAULT 'brouillon',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- INTERACTIONS (timeline CRM = emails + appels + notes)
-- ================================================================
CREATE TABLE public.interactions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type            TEXT,
    direction       TEXT,
    contact_id      UUID REFERENCES public.contacts(id),
    entreprise_id   UUID REFERENCES public.entreprises(id),
    bien_id         UUID REFERENCES public.biens(id),
    sujet           TEXT,
    contenu         TEXT,
    outlook_msg_id  TEXT UNIQUE,
    metadata        JSONB,
    occurred_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_interactions_contact ON public.interactions(contact_id);
CREATE INDEX idx_interactions_entreprise ON public.interactions(entreprise_id);
CREATE INDEX idx_interactions_occurred ON public.interactions(occurred_at DESC);

-- ================================================================
-- AGENDA / RDV
-- ================================================================
CREATE TABLE public.rdv (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    titre             TEXT,
    debut             TIMESTAMPTZ,
    fin               TIMESTAMPTZ,
    lieu              TEXT,
    contact_id        UUID REFERENCES public.contacts(id),
    entreprise_id     UUID REFERENCES public.entreprises(id),
    bien_id           UUID REFERENCES public.biens(id),
    outlook_event_id  TEXT UNIQUE,
    rappel_minutes    INT NOT NULL DEFAULT 30,
    statut            TEXT NOT NULL DEFAULT 'planifié',
    created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_rdv_debut ON public.rdv(debut);

-- ================================================================
-- TRIGGER updated_at automatique
-- ================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'user_profiles','entreprises','contacts','biens','besoins',
        'proprietaires','opportunites','visites','documents','rdv'
    ] LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS set_updated_at ON public.%I;
            CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', t, t);
    END LOOP;
END $$;
