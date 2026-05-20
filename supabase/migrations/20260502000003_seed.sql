-- ================================================================
-- Seed : données de démo (idempotent via ON CONFLICT)
-- ================================================================

-- Désactive temporairement RLS pour le seed (run en service_role)
SET LOCAL session_replication_role = replica;

INSERT INTO public.entreprises (id, siren, raison_sociale, secteur, effectif, ca, score) VALUES
  ('11111111-1111-1111-1111-111111111111', '552032534', 'L''Oréal SA', 'Cosmétiques', 88000, 38000000000, 85),
  ('22222222-2222-2222-2222-222222222222', '552081317', 'BNP Paribas', 'Banque', 198000, 45000000000, 90),
  ('33333333-3333-3333-3333-333333333333', '780129987', 'Doctolib', 'SaaS Santé', 2800, 350000000, 75),
  ('44444444-4444-4444-4444-444444444444', '440048882', 'Decathlon', 'Distribution sport', 99000, 16000000000, 70),
  ('55555555-5555-5555-5555-555555555555', '438391688', 'Mistral AI', 'IA générative', 100, 30000000, 95)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.contacts (id, entreprise_id, prenom, nom, email, poste, role_immo, score, source) VALUES
  ('aaaaaaa1-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Sophie', 'Martin', 'sophie.martin@loreal.com', 'Directrice Immobilier', 'immobilier', 80, 'outlook'),
  ('aaaaaaa2-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Pierre', 'Dubois', 'pierre.dubois@bnpparibas.com', 'Resp. Expansion Tertiaire', 'expansion', 75, 'outlook'),
  ('aaaaaaa3-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'Julie', 'Renard', 'julie.renard@doctolib.com', 'COO', 'dg', 70, 'linkedin'),
  ('aaaaaaa4-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444', 'Thomas', 'Leroy', 'thomas.leroy@decathlon.com', 'Directeur Logistique', 'immobilier', 65, 'outlook'),
  ('aaaaaaa5-5555-5555-5555-555555555555', '55555555-5555-5555-5555-555555555555', 'Arthur', 'Mensch', 'arthur@mistral.ai', 'CEO', 'dg', 90, 'manuel')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.biens (id, reference, typologie, statut, transaction, surface_m2, prix, loyer_annuel, adresse, ville, code_postal, geom, off_market, mandat_interne) VALUES
  ('bbbbbbb1-1111-1111-1111-111111111111', 'OP-2026-001', 'bureaux',  'disponible', 'location', 850,  NULL,    510000,   '15 rue de la Boétie',     'Paris',       '75008', ST_SetSRID(ST_MakePoint(2.314, 48.872), 4326), false, true),
  ('bbbbbbb2-2222-2222-2222-222222222222', 'OP-2026-002', 'bureaux',  'disponible', 'vente',    1200, 12000000, NULL,    '8 avenue Hoche',          'Paris',       '75008', ST_SetSRID(ST_MakePoint(2.298, 48.876), 4326), false, true),
  ('bbbbbbb3-3333-3333-3333-333333333333', 'OP-2026-003', 'entrepot', 'disponible', 'location', 5500, NULL,    720000,   'ZA des Bruyères',         'Saint-Denis', '93200', ST_SetSRID(ST_MakePoint(2.355, 48.937), 4326), true,  false),
  ('bbbbbbb4-4444-4444-4444-444444444444', 'OP-2026-004', 'bureaux',  'disponible', 'location', 320,  NULL,    192000,   'Tour First',              'Courbevoie',  '92800', ST_SetSRID(ST_MakePoint(2.241, 48.892), 4326), false, true),
  ('bbbbbbb5-5555-5555-5555-555555555555', 'OP-2026-005', 'commerce', 'disponible', 'vente',    180,  2400000, NULL,    '42 rue Saint-Honoré',     'Paris',       '75001', ST_SetSRID(ST_MakePoint(2.343, 48.862), 4326), false, false),
  ('bbbbbbb6-6666-6666-6666-666666666666', 'OP-2026-006', 'bureaux',  'disponible', 'location', 2200, NULL,    1320000,  'Campus Cyber',            'Puteaux',     '92800', ST_SetSRID(ST_MakePoint(2.231, 48.886), 4326), true,  true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.besoins (id, entreprise_id, contact_id, typologie, transaction, surface_min, surface_max, budget_min, budget_max, zones, timing, statut) VALUES
  ('ccccccc1-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'aaaaaaa3-3333-3333-3333-333333333333', 'bureaux',  'location', 600,  1200, 400000, 800000,  ARRAY['paris','92'], 'immediat', 'actif'),
  ('ccccccc2-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555555', 'aaaaaaa5-5555-5555-5555-555555555555', 'bureaux',  'location', 200,  500,  100000, 250000,  ARRAY['paris'],      '3 mois',   'actif'),
  ('ccccccc3-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', 'aaaaaaa4-4444-4444-4444-444444444444', 'entrepot', 'location', 4000, 8000, 500000, 1000000, ARRAY['93','95'],    '6 mois',   'actif')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.interactions (type, direction, contact_id, entreprise_id, sujet, occurred_at) VALUES
  ('email', 'in',  'aaaaaaa3-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'Recherche bureaux Paris/92', NOW() - INTERVAL '2 days'),
  ('email', 'out', 'aaaaaaa3-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'Proposition OP-2026-001',     NOW() - INTERVAL '1 day'),
  ('appel', 'out', 'aaaaaaa5-5555-5555-5555-555555555555', '55555555-5555-5555-5555-555555555555', 'Brief recherche',             NOW() - INTERVAL '5 days');
