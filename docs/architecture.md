# Architecture OLL PARKS

## Vue topologique

```
┌──────────────────┐          ┌──────────────────────┐
│  Next.js 15      │ ◄──REST──┤  FastAPI (Python 3.11)│
│  + Tailwind      │  /api    │  + SQLAlchemy 2       │
│  + Mapbox GL     │          │  + Pydantic v2         │
└──────────────────┘          └──────────┬────────────┘
                                          │
        ┌─────────────────────────────────┼──────────────────────────────┐
        │                                 │                              │
        ▼                                 ▼                              ▼
┌──────────────┐               ┌────────────────┐              ┌───────────────┐
│ PostgreSQL 16│               │ ElasticSearch 8│              │   Redis 7     │
│  + PostGIS   │               │ (emails index) │              │ (queue+cache) │
└──────────────┘               └────────────────┘              └───────┬───────┘
                                                                       │
                                                              ┌────────▼────────┐
                                                              │ Workers Node.js │
                                                              │ - Outlook sync  │
                                                              │ - Pappers sync  │
                                                              │ - VISIAL sync   │
                                                              │ - Doc generator │
                                                              └────────┬────────┘
                                                                       │
                ┌──────────────────┬─────────────────────┬──────────────┴──┐
                ▼                  ▼                     ▼                 ▼
        Microsoft Graph     Pappers API           VISIAL QIE         LinkedIn API
        (Mail+Calendar)     (Entreprises+Immo)    (Actifs+Dossiers)  (Sales Nav)
```

## Couches

| Couche | Rôle |
|---|---|
| **Frontend** (Next.js) | UI commerciale, dashboard, kanban, carte, génération de docs |
| **API** (FastAPI) | Endpoints REST, validation, auth, orchestration |
| **Services** | Logique métier (matching, extracteurs Outlook, scoring Pappers, génération docs) |
| **Modèles** | SQLAlchemy 2 typed (10 tables + users) |
| **Workers** | Jobs asynchrones (sync emails, sync VISIAL, génération batch) |
| **DB** | Postgres + PostGIS (géo) + JSONB (payloads) |
| **Cache** | Redis (sessions JWT en option, queue BullMQ) |
| **Search** | ElasticSearch (full-text emails 15 ans) |

## Flux clés

### 1. Sync Outlook → CRM
```
User clique "Sync Outlook"
  → POST /outlook/sync
  → MSAL acquire_token_for_client
  → /users/{id}/messages (Graph)
  → Pour chaque message:
     - dedupe sur outlook_msg_id
     - upsert contact (parse_signature)
     - upsert entreprise (extract_company_from_email)
     - insert interaction
     - extract_property_need → si match → insert besoin
  → Frontend rafraîchit timeline
```

### 2. Matching besoin × biens
```
User sélectionne un besoin
  → POST /matching/run {besoin_id, top_n}
  → Pour chaque bien disponible:
     - calculate_final_score (8 fonctions)
     - upsert opportunite (besoin_id, bien_id) avec score+detail+action
  → Tri par score desc
  → Retourne top N + actions recommandées
```

### 3. Génération de bon de visite
```
User clique "📄 Bon de visite" sur une visite
  → GET /visites/{id}/documents/bon_de_visite?format=pdf
  → Backend récupère bien + contact + entreprise
  → Construit data dict (bien.adresse, prospect.raison_sociale, …)
  → Jinja render bon_de_visite.html.j2
  → WeasyPrint render PDF
  → Réponse Content-Type: application/pdf
```

### 4. Identification propriétaires
```
User clique "Identifier propriétaire" sur un bien
  → POST /pappers/biens/{id}/proprietaires
  → Pappers Immo /recherche par adresse+CP
  → Pour chaque proprio retourné:
     - dedupe par siren (puis nom)
     - score_proprietaire (SCI ancienne + multi-actifs + email)
     - upsert proprietaires + biens_proprietaires
  → Retour : liste avec scores
```

## Décisions techniques

### Pourquoi FastAPI + SQLAlchemy 2 + Pydantic v2 ?
- Typing fort end-to-end (mypy passable)
- OpenAPI auto-généré (Swagger UI sur /docs)
- Async ready (workers BullMQ communicants)
- Écosystème mature (Alembic pour les migs, GeoAlchemy2 pour PostGIS)

### Pourquoi Next.js 15 App Router + RSC ?
- Server Components → moins de JS client
- Streaming + Suspense
- File-based routing → simplicité
- Compatible Vercel pour déploiement (build privé OK)

### Pourquoi un moteur de matching à poids fixes en v1 ?
- Explicabilité (chaque score est traçable, justifiable au commercial)
- Pas de dataset d'entraînement initial
- Itération facile (tweak des poids = code review)
- v2 : remplacement par modèle ML calibré sur historique deals

### Pourquoi PostGIS plutôt que géohash custom ?
- Géo-requêtes spatiales natives (`ST_DWithin`, `ST_Contains`)
- Index GIST hyper rapide
- Standard de fait
- Compatible avec QGIS et tous les outils SIG

## Modules à étendre en Phase 2 (post-MVP)

- **Sales intelligence LinkedIn** : enrichissement profils via Sales Navigator API
- **NER avancée** : remplacer regex par spaCy fr-core-news + LLM (extraction besoins)
- **ML scoring** : entraîner gradient boosting sur historique opportunités
- **Webhooks Pappers** : alertes sur changements de dirigeants/SCI
- **OCR documents** : ingestion automatique de baux scannés
- **Mobile** : PWA pour les commerciaux en RDV
