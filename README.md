# OLL PARKS — Plateforme immobilière B2B

SaaS de prospection, matching et gestion commerciale d'actifs immobiliers d'entreprise.

> 🌐 **Landing publique** : https://770lab.com/oll-parks/
> 📦 **Repo (privé)** : https://github.com/770lab/oll-parks

## 🏗️ Stack actuelle

- **DB** : Supabase PostgreSQL 16 + PostGIS + pg_cron
- **Auth** : Supabase Auth (email/password, OAuth, RLS)
- **API** : Supabase Edge Functions (Deno + TypeScript)
- **Storage** : Supabase Storage (PDFs générés)
- **Frontend** : Next.js 15 + TypeScript + Tailwind + `@supabase/ssr`
- **Cartographie** : Mapbox GL
- **Déploiement front** : Vercel (one-click)
- **Déploiement back** : tout Supabase, rien à héberger ailleurs

## 📚 Documentation

- 📘 [Cahier des charges](docs/cahier-des-charges.md)
- 🏗️ [Architecture](docs/architecture.md)
- 🔌 [API Reference](docs/api.md)
- 🗄️ [Supabase setup](supabase/README.md)
- 📄 [Cahier des charges DOCX](docs/OLL_PARKS_CAHIER_FINAL_COMPLET.docx)

## ✅ Modules livrés (Supabase Edge Functions)

| Module | Edge Function | Endpoint |
|---|---|---|
| 🎯 **Matching** (cerveau) | `matching` | `POST /functions/v1/matching` |
| ✉️ **Outlook sync** | `outlook-sync` | `POST /functions/v1/outlook-sync` |
| 🔍 **Pappers enrich** | `pappers-enrich` | `POST /functions/v1/pappers-enrich` |
| 🔑 **Pappers propriétaires** | `pappers-proprietaires` | `POST /functions/v1/pappers-proprietaires` |
| 📄 **Documents** | `document-generate` | `GET/POST /functions/v1/document-generate` |

Pour la lecture (entreprises, contacts, biens, besoins, opportunités, RDV…), le frontend utilise `@supabase/supabase-js` directement (pas besoin d'Edge Function).

## 🚀 Démarrage

### 1. Config

```bash
git clone https://github.com/770lab/oll-parks.git
cd oll-parks
cp .env.example .env.local
# Éditer .env.local avec tes clés Supabase
```

### 2. Base de données (déjà fait pour `aqltsbshosdbxwrnotui`)

```bash
# Pousser les 3 migrations + seed
DATABASE_URL=postgresql://... python3 scripts/db_push.py
```

Sinon via Supabase CLI :
```bash
supabase link --project-ref aqltsbshosdbxwrnotui
supabase db push
```

### 3. Edge Functions

```bash
# Installer la CLI Supabase
brew install supabase/tap/supabase

# Déployer
supabase functions deploy matching
supabase functions deploy outlook-sync
supabase functions deploy pappers-enrich
supabase functions deploy pappers-proprietaires
supabase functions deploy document-generate

# Définir les secrets côté Edge Functions
supabase secrets set \
  MICROSOFT_CLIENT_ID=xxx \
  MICROSOFT_CLIENT_SECRET=xxx \
  MICROSOFT_TENANT_ID=xxx \
  PAPPERS_API_KEY=xxx
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev    # → http://localhost:3000
```

## 🧠 Cerveau logiciel — moteur de matching

8 fonctions atomiques (chacune testée), portées en TypeScript :

```typescript
calculateFinalScore(besoin, bien, contact, history)
  → score [0..100] + détail par dimension
  → recommendAction(score) ∈ {appel_immediat, envoi_fiche, qualification, veille}
```

Voir [`supabase/functions/_shared/matching.ts`](supabase/functions/_shared/matching.ts).

## 🔐 Sécurité — RLS (Row-Level Security)

Hiérarchie des rôles (table `user_profiles.role`) :

| Rôle | SELECT | INSERT/UPDATE | DELETE |
|---|---|---|---|
| `lecteur` | ✅ | ❌ | ❌ |
| `charge` | ✅ | ✅ | ❌ |
| `consultant` | ✅ | ✅ | ❌ |
| `directeur` | ✅ | ✅ | ❌ |
| `admin` | ✅ | ✅ | ✅ |

Toutes les tables ont RLS activé — un user non-admin ne peut JAMAIS supprimer.

## 📁 Structure

```
oll-parks/
├── frontend/              # Next.js 15 (UI commerciale)
│   └── src/
│       ├── app/           # Pages (dashboard, entreprises, biens, matching…)
│       ├── components/    # Sidebar, BiensMap, ui/
│       ├── lib/
│       │   ├── supabase/  # Clients Supabase (browser + server)
│       │   └── api.ts     # Helper invoke functions
│       └── middleware.ts  # Refresh tokens + protection routes
├── supabase/              # Backend
│   ├── config.toml        # Config CLI
│   ├── migrations/        # SQL versionnées (init + RLS + seed)
│   ├── functions/         # Edge Functions Deno/TS
│   │   ├── _shared/       # Helpers (cors, supabase, matching, extract, graph, pappers, templates)
│   │   ├── matching/
│   │   ├── outlook-sync/
│   │   ├── pappers-enrich/
│   │   ├── pappers-proprietaires/
│   │   └── document-generate/
│   └── README.md
├── scripts/
│   └── db_push.py         # Push migrations sans CLI Supabase (juste psycopg)
├── docs/                  # Cahier des charges, architecture, API
├── backend-legacy/        # Ancien backend FastAPI (référence)
├── docker-compose.legacy.yml
├── Makefile.legacy
├── .env.example
└── README.md
```

## 🧪 Tests

Le code Python (`backend-legacy/tests/`) reste valide pour valider les algorithmes.
Pour les Edge Functions Deno : `deno test supabase/functions/_shared/` (à enrichir).

## 🚧 Reste à faire

- Pages Outlook / Visites / Documents migrées vers Supabase (en cours)
- pg_cron jobs : sync Outlook quotidien + Pappers hebdo
- VISIAL QIE : à câbler dans une Edge Function dédiée
- Mapbox carte des biens (composant déjà créé, à vérifier en preview)
- Déploiement Vercel du frontend
- Tests Deno
- Auth OAuth (Google / Microsoft) en plus du email/password
