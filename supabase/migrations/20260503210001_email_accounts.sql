-- ================================================================
-- email_accounts : comptes mail connectés (OAuth) par utilisateur OLL PARKS
-- ================================================================
-- Stockage des tokens d'accès aux mailboxes externes (Gmail, Outlook).
-- ⚠️ Les tokens sont en clair dans la colonne pour la simplicité.
-- En prod stricte on les passerait par pgsodium / Supabase Vault.
-- Pour OLL PARKS (équipe restreinte, RLS limite l'accès au propriétaire + admin),
-- c'est acceptable.

CREATE TABLE public.email_accounts (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- À qui cette boîte appartient (au sein de l'app OLL PARKS)
    owner_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Provider et identifiant externe
    provider             TEXT NOT NULL CHECK (provider IN ('gmail', 'outlook')),
    email                TEXT NOT NULL,
    external_user_id     TEXT,  -- "me" pour Gmail, UPN pour Microsoft
    -- OAuth tokens
    access_token         TEXT NOT NULL,
    refresh_token        TEXT NOT NULL,
    token_expires_at     TIMESTAMPTZ NOT NULL,
    scopes               TEXT[],
    -- État de la synchronisation
    last_sync_at         TIMESTAMPTZ,
    last_sync_history_id TEXT,  -- Gmail historyId (sync incrémentale)
    last_sync_stats      JSONB, -- { fetched, new_messages, new_contacts, new_besoins, ... }
    sync_status          TEXT NOT NULL DEFAULT 'idle'
                         CHECK (sync_status IN ('idle','running','error','paused')),
    sync_error           TEXT,
    -- RGPD : trace du consentement
    consent_given_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    consent_given_by     UUID REFERENCES auth.users(id),
    consent_text         TEXT,    -- texte exact du consentement affiché
    -- Soft-delete (jamais hard delete cf. règle Yoann)
    revoked_at           TIMESTAMPTZ,
    -- Timestamps
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (owner_id, provider, email)
);

CREATE INDEX idx_email_accounts_owner ON public.email_accounts(owner_id);
CREATE INDEX idx_email_accounts_email ON public.email_accounts(email);

-- Trigger updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.email_accounts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ================================================================
-- RLS : chaque user voit ses propres comptes ; admin voit tout
-- ================================================================
ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner read email_accounts" ON public.email_accounts
    FOR SELECT USING (owner_id = auth.uid() OR public.is_admin());

CREATE POLICY "owner write email_accounts" ON public.email_accounts
    FOR ALL USING (owner_id = auth.uid() OR public.is_admin())
    WITH CHECK (owner_id = auth.uid() OR public.is_admin());

-- ================================================================
-- Lien interactions/besoins → email_account source (pour traçabilité)
-- ================================================================
ALTER TABLE public.interactions
    ADD COLUMN IF NOT EXISTS email_account_id UUID REFERENCES public.email_accounts(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS gmail_msg_id TEXT,
    ADD COLUMN IF NOT EXISTS gmail_thread_id TEXT;

CREATE INDEX IF NOT EXISTS idx_interactions_gmail_msg ON public.interactions(gmail_msg_id);
CREATE INDEX IF NOT EXISTS idx_interactions_account ON public.interactions(email_account_id);

ALTER TABLE public.besoins
    ADD COLUMN IF NOT EXISTS source_interaction_id UUID REFERENCES public.interactions(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS confidence_score INT;  -- 0-100, score de confiance "is_demande_immo"

CREATE INDEX IF NOT EXISTS idx_besoins_source_interaction ON public.besoins(source_interaction_id);
