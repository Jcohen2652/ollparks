# Supabase — OLL PARKS

## Structure

```
supabase/
├── config.toml          # Config CLI (port local, edge functions)
├── migrations/          # SQL versionnées (timestamp_name.sql)
│   ├── 20260502000001_init.sql      # Tables + extensions
│   ├── 20260502000002_rls.sql       # Row-Level Security
│   └── 20260502000003_seed.sql      # Données de démo
└── functions/           # Edge Functions Deno/TypeScript
    ├── _shared/         # Helpers partagés (db client, auth)
    ├── matching/        # Moteur de scoring
    ├── outlook-sync/    # Ingestion Microsoft Graph
    ├── pappers-enrich/  # Enrichissement entreprise
    ├── pappers-proprietaires/  # Identification propriétaires
    └── document-generate/      # Génération PDF (jsPDF)
```

## Workflow CLI

```bash
# Installer la CLI une fois (Mac)
brew install supabase/tap/supabase

# Linker au projet distant
supabase link --project-ref aqltsbshosdbxwrnotui

# Pousser les migrations
supabase db push

# Déployer les Edge Functions
supabase functions deploy matching
supabase functions deploy outlook-sync
supabase functions deploy pappers-enrich
supabase functions deploy pappers-proprietaires
supabase functions deploy document-generate

# Définir les secrets (depuis Vault)
supabase secrets set MICROSOFT_CLIENT_ID=xxx \
                     MICROSOFT_CLIENT_SECRET=xxx \
                     MICROSOFT_TENANT_ID=xxx \
                     PAPPERS_API_KEY=xxx
```

## Push depuis cette machine (sans CLI Supabase)

Le script `scripts/db_push.py` (Python + psycopg) exécute les migrations en lisant `DATABASE_URL` du `.env.local`. Utilisé pour le bootstrap initial.

## RLS — résumé

| Rôle métier | SELECT | INSERT/UPDATE | DELETE |
|---|---|---|---|
| `lecteur` | ✅ | ❌ | ❌ |
| `charge` | ✅ | ✅ | ❌ |
| `consultant` | ✅ | ✅ | ❌ |
| `directeur` | ✅ | ✅ | ❌ |
| `admin` | ✅ | ✅ | ✅ |

Définir le rôle d'un user : `UPDATE user_profiles SET role='admin' WHERE id='<uuid>';`
