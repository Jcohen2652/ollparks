# API Reference — OLL PARKS

L'API expose **Swagger UI** (interactive) sur `http://localhost:8000/docs` et le **schéma OpenAPI** sur `/openapi.json`.

## Conventions

- Authentification : `Authorization: Bearer <JWT>` (sauf `/auth/login`, `/health`).
- Erreurs HTTP : `400` validation, `401` non auth, `403` rôle insuffisant, `404` introuvable, `409` conflit, `503` service externe down.
- Pagination : `?limit=50&offset=0` (max 200).

## Endpoints par module

### Auth
| Méthode | Path | Description | Rôle requis |
|---|---|---|---|
| POST | `/auth/login` | OAuth2 password flow → JWT | — |
| POST | `/auth/register` | Crée un user | admin |
| GET | `/auth/me` | Profil courant | authentifié |

### Entreprises
| Méthode | Path | Description |
|---|---|---|
| GET | `/entreprises?q=&secteur=&limit=&offset=` | Liste avec recherche |
| POST | `/entreprises` | Création |
| GET | `/entreprises/{id}` | Détail |
| PATCH | `/entreprises/{id}` | Mise à jour |

### Contacts
`GET/POST/GET/PATCH /contacts` — filtre par `entreprise_id`.

### Biens
`GET/POST/GET/PATCH /biens` — filtres `typologie, statut, off_market, surface_min, surface_max`.
- `GET /biens/geojson?statut=disponible` — FeatureCollection pour la carte Mapbox.

### Besoins
`GET/POST/GET/PATCH /besoins` — filtre par `entreprise_id, statut`.

### Opportunités
`GET /opportunites?besoin_id=&bien_id=&min_score=` — listing scoré.

### Matching (cerveau)
`POST /matching/run` body `{besoin_id, top_n}` → calcule + persiste les opportunités, renvoie le top.

### Outlook
| Path | Description |
|---|---|
| `POST /outlook/sync` | Ingestion Microsoft Graph d'un mailbox |
| `GET /outlook/interactions` | Timeline d'interactions |

### Pappers
| Path | Description |
|---|---|
| `POST /pappers/entreprises/{id}/enrichir` | Enrichit (effectif, CA, dirigeants) |
| `POST /pappers/biens/{id}/proprietaires` | Identifie les propriétaires d'un bien |
| `GET /pappers/proprietaires?min_score=` | Listing |

### Visites
| Path | Description |
|---|---|
| `GET/POST /visites` | Listing + création |
| `GET /visites/{id}` | Détail |
| `GET /visites/{id}/documents/{type}?format=pdf|html|docx` | Génère bon_de_visite, denonce, modalites_visite |

### Documents
| Path | Description |
|---|---|
| `GET /documents/templates` | Catalogue (8 templates) |
| `POST /documents/generate` | Génère depuis JSON |

### Agenda
| Path | Description |
|---|---|
| `GET /agenda?debut=&fin=&contact_id=` | RDV dans une fenêtre |
| `POST /agenda` | Création |
| `PATCH /agenda/{id}` | Update |
| `POST /agenda/sync-outlook?user_id=` | Sync calendrier Microsoft |

### VISIAL QIE
| Path | Description |
|---|---|
| `POST /visial/sync?max_pages=` | Sync actifs VISIAL → biens |
| `GET /visial/actifs/{visial_id}` | Proxy fiche VISIAL |

### CRM
| Path | Description |
|---|---|
| `GET /crm/entreprises/{id}` | Fiche 360° (entreprise + contacts + besoins + KPIs) |
| `GET /crm/pipeline` | Kanban groupé par statut |
| `PATCH /crm/opportunites/{id}/statut` | Change le statut |

## Exemples curl

```bash
# Login
curl -X POST http://localhost:8000/auth/login \
  -d "username=admin@oll.fr&password=secret" \
  -H "Content-Type: application/x-www-form-urlencoded"

# Lancer un matching
TOKEN="<jwt>"
curl -X POST http://localhost:8000/matching/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"besoin_id":"ccccccc1-1111-1111-1111-111111111111","top_n":5}'

# Générer un bon de visite PDF
curl http://localhost:8000/visites/<UUID>/documents/bon_de_visite?format=pdf \
  -H "Authorization: Bearer $TOKEN" \
  -o bon.pdf
```
