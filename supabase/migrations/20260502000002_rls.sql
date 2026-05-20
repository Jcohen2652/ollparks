-- ================================================================
-- Row-Level Security policies
--
-- Modèle :
-- - Tout authentifié : SELECT sur l'essentiel (entreprises, biens, contacts, etc.)
-- - Lecteur : SELECT seulement
-- - Charge / Consultant / Directeur / Admin : INSERT/UPDATE
-- - Admin seul : DELETE et accès user_profiles
-- ================================================================

-- Active RLS sur toutes les tables métier
ALTER TABLE public.user_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entreprises        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biens              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.besoins            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proprietaires      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biens_proprietaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunites       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visites            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visites_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdv                ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- user_profiles : chacun voit son profil ; admin voit tout
-- ----------------------------------------------------------------
CREATE POLICY "self read profile" ON public.user_profiles
    FOR SELECT USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "admin write profile" ON public.user_profiles
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------
-- Helper macro : "tout authentifié peut lire ; rôle ≥ charge peut écrire"
-- ----------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'entreprises','contacts','biens','besoins',
        'proprietaires','biens_proprietaires','opportunites',
        'visites','visites_participants','documents','interactions','rdv'
    ] LOOP
        EXECUTE format('CREATE POLICY "auth read %1$s" ON public.%1$I FOR SELECT USING (auth.uid() IS NOT NULL);', t);
        EXECUTE format('CREATE POLICY "charge insert %1$s" ON public.%1$I FOR INSERT WITH CHECK (public.current_user_role() IN (''admin'',''directeur'',''consultant'',''charge''));', t);
        EXECUTE format('CREATE POLICY "charge update %1$s" ON public.%1$I FOR UPDATE USING (public.current_user_role() IN (''admin'',''directeur'',''consultant'',''charge''));', t);
        EXECUTE format('CREATE POLICY "admin delete %1$s" ON public.%1$I FOR DELETE USING (public.is_admin());', t);
    END LOOP;
END $$;
