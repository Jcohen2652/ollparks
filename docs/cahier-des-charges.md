# 📘 OLL PARKS — Cahier des charges

> Version 1.0 — 2026-05-01
> Document de référence pour la conception et le développement de la plateforme OLL PARKS.

---

## 1. Vision produit

OLL PARKS est une **plateforme SaaS B2B** dédiée à la prospection et à la commercialisation d'actifs immobiliers d'entreprise. Elle vise à transformer 15 ans de données opérationnelles (emails Outlook, mandats, contacts) en un **moteur d'opportunités automatisé**.

### Promesse
> Détecter, matcher et conclure plus de deals immobiliers, plus vite, en exploitant la data dormante et l'intelligence relationnelle de l'équipe.

### Indicateurs clés (KPIs cibles)
| Indicateur | Objectif 12 mois |
|---|---|
| Opportunités détectées / mois | × 5 vs baseline |
| Temps de qualification d'un lead | ÷ 3 |
| Taux de matching → visite | ≥ 25 % |
| Taux de visite → offre | ≥ 30 % |
| Off-market identifiés / trimestre | ≥ 50 |

---

## 2. Personas & cas d'usage

### 2.1 Personas internes
- **Directeur commercial** — pilote la performance, suit le pipeline global
- **Consultant senior** — gère portefeuille clients/biens, négocie les deals
- **Chargé d'affaires** — qualifie les leads, organise les visites
- **Assistant(e)** — saisit les données, génère les documents

### 2.2 Personas externes (visibles dans la base)
- **Dirigeant entreprise** (DG, DAF, DI, Resp. Expansion)
- **Propriétaire** (personne physique, SCI, foncière, family office)
- **Apporteur d'affaires** (broker, notaire, expert-comptable)

### 2.3 Cas d'usage prioritaires
1. *« Quels sont mes 10 meilleures opportunités cette semaine ? »* → dashboard scoring
2. *« Cette entreprise X a-t-elle déjà été en contact avec nous ? »* → recherche unifiée Outlook + CRM
3. *« Qui possède ce bâtiment au 12 rue de la Boétie ? »* → recherche Pappers Immo
4. *« Génère-moi un bon de visite pour le RDV de demain »* → moteur de documents
5. *« Liste-moi les entreprises de + 100 personnes qui cherchent à déménager dans le 92 »* → matching besoins/biens

---

## 3. Modules fonctionnels

### M1 — Prospection entreprises
- Connexion **LinkedIn** (Sales Navigator API ou scraping conforme)
- Enrichissement via **Pappers Entreprises** (SIREN, effectif, CA, dirigeants)
- Identification des décideurs : **DG, Direction Immobilière, Direction Expansion, DAF**
- Tagging automatique (secteur, taille, signaux de croissance)
- Import CSV / liste

### M2 — Offres immobilières
- Catalogue centralisé : **biens marché** (publics) + **off-market** (privés)
- **Mandats internes** OLL PARKS distingués
- Vente / Location / Cession de bail
- Typologies : bureaux, entrepôts, locaux d'activité, commerces, mixte
- Données techniques : surface, divisibilité, étage, parking, certifications HQE/BREEAM
- Photos, plans, documents techniques

### M3 — Matching intelligent (cerveau logiciel)
Voir section [4. Moteur de scoring](#4-moteur-de-scoring--cerveau-logiciel).

### M4 — Outlook (CRITIQUE)
- Connexion **Microsoft Graph API** (OAuth)
- Ingestion incrémentale de **15 ans d'emails**
- Extraction structurée :
  - **Contacts** (signatures, headers, threads)
  - **Entreprises** (matching par domaine email + SIREN)
  - **Besoins immobiliers** (NER + classification : surface, ville, budget, timing)
  - **Signaux faibles** (déménagement, levée de fonds, croissance, restructuration)
- Indexation **ElasticSearch** pour recherche full-text
- Scoring de chaque interaction

### M5 — Pappers Immo (propriétaires)
- Recherche par **adresse** ou **parcelle cadastrale**
- Identification :
  - Personnes physiques
  - **SCI** (gérants, associés, capital)
  - **Foncières** (lien Pappers Entreprises)
  - Family offices, fonds
- **Scoring propriétaire** : âge SCI, nb de biens, activité de cession, accessibilité
- **Détection off-market** : propriétaire dormant + bien sous-exploité = signal

### M6 — CRM
- Fiches **entreprises** (360°)
- Fiches **contacts** (timeline interactions)
- **Pipeline commercial** Kanban (lead → qualifié → visite → offre → signé)
- **Scoring leads** dynamique
- Suivi **opportunités** (besoin × bien)
- Notes, tâches, rappels

### M7 — Agenda & RDV
- Calendrier intégré (vue jour / semaine / mois)
- **Synchronisation bidirectionnelle Outlook**
- Création RDV depuis fiche contact / bien / opportunité
- Rappels automatiques (email + push)
- Préparation de RDV : briefing auto (historique, scoring, suggestions)

### M8 — Gestion des visites
- Création visite à partir d'une opportunité
- Gestion participants (prospect, propriétaire, broker)
- **Génération automatique** de :
  - **Bon de visite** (PDF signable)
  - **Dénonce propriétaire** (notification formelle)
  - **Modalités de visite** (badge accès, contact gardien, plan)
- Suivi post-visite (compte-rendu, scoring)

### M9 — Génération de documents
Moteur de templates dynamiques (DOCX/PDF) pour :
- **Offre d'acquisition**
- **Offre de prise à bail**
- **Lettre d'intention (LOI)**
- **Mandat** (vente, recherche, gestion)
- **Courrier propriétaire** (approche off-market)

Données injectées automatiquement :
- Société (raison sociale, SIREN, siège, capital, dirigeant)
- Actif (référence, adresse, surface, prix/loyer)
- Conditions financières (dépôt garantie, franchise, indexation)
- Délais (signature promesse, acte authentique, prise d'effet bail)

### M10 — Connexion VISIAL QIE
- Synchronisation des **actifs** (référentiel commun)
- Récupération des **données techniques** (DPE, rapports d'expertise)
- Suivi des **dossiers** (étape de transaction)
- Garantie de **cohérence** entre les deux bases (résolution conflits)

---

## 4. Moteur de scoring — Cerveau logiciel

### 4.1 Fonctions atomiques

```python
score_asset(besoin, bien)            # typologie, qualité, état → 0-15
score_geo(besoin, bien)              # adéquation géographique → 0-20
score_surface_budget(besoin, bien)   # fit surface + budget       → 0-20
score_timing(besoin, bien)           # disponibilité ↔ urgence    → 0-15
score_signals(besoin)                # signaux business           → 0-10
score_history(history)               # antécédents relationnels   → 0-10
score_contact(contact)               # qualité du contact         → 0-10
penalties(besoin, bien, contact)     # malus (dossier froid, etc) → 0-30
```

### 4.2 Score final

```python
def calculate_final_score(besoin, bien, contact, history) -> tuple[int, dict]:
    parts = {
        "asset":          score_asset(besoin, bien),
        "geo":            score_geo(besoin, bien),
        "surface_budget": score_surface_budget(besoin, bien),
        "timing":         score_timing(besoin, bien),
        "signals":        score_signals(besoin),
        "history":        score_history(history),
        "contact":        score_contact(contact),
    }
    base = sum(parts.values())          # max 100
    final = max(0, min(100, base - penalties(besoin, bien, contact)))
    return final, parts

def recommend_action(score: int) -> str:
    if score >= 80: return "appel_immediat"      # 🔥 priorité absolue
    if score >= 60: return "envoi_fiche"          # 📧 push commercial
    if score >= 40: return "qualification"        # 🔍 à creuser
    return "veille"                                # 👀 monitoring
```

### 4.3 Boucle d'apprentissage
Chaque opportunité passée (gagnée/perdue) alimente un **dataset d'entraînement**. Itération 2 : remplacement progressif des poids fixes par un modèle ML (gradient boosting) calibré sur l'historique.

---

## 5. Architecture technique

### 5.1 Stack

| Couche | Techno | Justification |
|---|---|---|
| **Frontend** | Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui | DX moderne, SSR, écosystème |
| **Cartographie** | Mapbox GL JS | Rendu vectoriel performant + heatmaps |
| **API principale** | Python 3.11 + FastAPI | Async, typage Pydantic, idéal pour intégrations API |
| **Workers async** | Node.js + BullMQ (Redis) | Microsoft Graph SDK natif, parallélisme I/O |
| **DB transactionnelle** | PostgreSQL 16 + PostGIS | Géo-requêtes, JSONB, fiabilité |
| **Search** | ElasticSearch 8 | Full-text + agrégations sur les emails |
| **Cache / queue** | Redis 7 | Sessions, rate-limiting, file de jobs |
| **Stockage fichiers** | S3-compatible (Scaleway / R2) | Documents générés, pièces jointes Outlook |
| **Auth** | Auth0 ou Clerk | SSO Microsoft pour l'équipe |
| **Observabilité** | Grafana + Loki + Sentry | Logs, métriques, erreurs |
| **CI/CD** | GitHub Actions + Docker | Déploiement reproductible |

### 5.2 Topologie

```
┌────────────────┐      ┌──────────────────┐
│  Next.js (Vercel) │◄────►│  FastAPI (REST)  │
└────────────────┘      └────────┬─────────┘
                                  │
            ┌─────────────────────┼─────────────────────┐
            ▼                     ▼                     ▼
     ┌──────────┐         ┌──────────────┐      ┌─────────────┐
     │PostgreSQL│         │ElasticSearch │      │   Redis     │
     └──────────┘         └──────────────┘      └──────┬──────┘
                                                       │
                                              ┌────────▼────────┐
                                              │ Workers Node    │
                                              │ - Outlook sync  │
                                              │ - Pappers sync  │
                                              │ - VISIAL sync   │
                                              │ - Doc generator │
                                              └────────┬────────┘
                                                       │
                          ┌────────────┬───────────────┼──────────────┐
                          ▼            ▼               ▼              ▼
                  Microsoft Graph  Pappers API   VISIAL QIE       LinkedIn
```

### 5.3 APIs externes

| API | Usage | Auth | Quota à anticiper |
|---|---|---|---|
| **Microsoft Graph** | Mails, calendrier, contacts | OAuth 2.0 (app + delegated) | 10 000 req / 10 min / app |
| **Pappers Entreprises** | SIREN, dirigeants, financiers | API key | Selon plan (≥ 50k/mois) |
| **Pappers Immo** | Propriétaires, parcelles | API key | Idem |
| **VISIAL QIE** | Actifs, dossiers | À spécifier (REST/SOAP ?) | À auditer |
| **Mapbox** | Géocodage + tiles | Token | 100k geocoding/mois (gratuit) |
| **LinkedIn** | Enrichissement contacts | Sales Navigator + scraping conforme | Strict — prévoir rate limit fort |

---

## 6. Modèle de données

### 6.1 Tables principales (cf. [`db/schema.sql`](../db/schema.sql))

| Table | Rôle | Volumétrie estimée 12 mois |
|---|---|---|
| `entreprises` | Sociétés prospectées | 50 000 |
| `contacts` | Personnes (issues Outlook + LinkedIn + Pappers) | 200 000 |
| `biens` | Catalogue offres immobilières | 5 000 actifs |
| `besoins` | Demandes clients | 2 000 actifs |
| `proprietaires` | Détenteurs (SCI, foncières, etc.) | 30 000 |
| `opportunites` | Matching besoin × bien (scoré) | 100 000 |
| `visites` | RDV physiques sur biens | 3 000 |
| `documents` | Docs générés | 10 000 |
| `interactions` | Emails, appels, RDV (timeline CRM) | 5 millions (15 ans Outlook) |
| `rdv` | Agenda | 20 000 |

### 6.2 Index critiques
- `interactions(occurred_at DESC)` — timeline rapide
- `interactions(outlook_msg_id)` — idempotence import
- `biens` (PostGIS GIST sur `geom`) — recherche spatiale
- `opportunites(score DESC)` — top opportunités
- `contacts(email)` — dédoublonnage

---

## 7. Sécurité & conformité

### 7.1 RGPD
- **Base légale** : intérêt légitime (B2B) + consentement (newsletters)
- **DPO** désigné, registre des traitements tenu à jour
- **Droit à l'oubli** : soft-delete + purge à 36 mois sur contacts inactifs
- **Anonymisation** des emails non identifiants après 5 ans (à valider juridiquement)
- **Hébergement UE** obligatoire (Scaleway, OVH ou AWS Paris)

### 7.2 Sécurité technique
- TLS 1.3 partout, HSTS
- Secrets en **vault** (Doppler / AWS Secrets Manager)
- Pas de hard-delete (cf. règle interne : tout = soft-cancel)
- Audit log immuable des accès aux données sensibles (propriétaires)
- 2FA obligatoire pour tous les comptes internes
- Backup PostgreSQL chiffré quotidien + restauration testée mensuellement

### 7.3 RBAC
| Rôle | Lecture | Écriture | Admin |
|---|---|---|---|
| **Admin** | Tout | Tout | ✅ |
| **Directeur** | Tout | Tout | ❌ |
| **Consultant** | Son portefeuille + biens publics | Son portefeuille | ❌ |
| **Chargé d'affaires** | Pipeline assigné | Pipeline assigné | ❌ |
| **Lecteur** | Lecture seule | ❌ | ❌ |

---

## 8. Roadmap & jalons

### Phase 0 — Bootstrap (S1-S2)
- [x] Repo + architecture
- [x] Cahier des charges
- [ ] Choix infra (Vercel + Scaleway ?)
- [ ] Maquettes Figma

### Phase 1 — Fondations (S3-S6)
- [ ] Schéma PostgreSQL complet + seed
- [ ] API FastAPI : auth, CRUD entreprises/contacts/biens
- [ ] Frontend Next.js : layout + 3 écrans (entreprises, biens, opportunités)
- [ ] Moteur de matching v1 (poids fixes)

### Phase 2 — Outlook (S7-S10) 🔥 critique
- [ ] OAuth Microsoft Graph
- [ ] Ingestion historique 15 ans (job batch)
- [ ] Indexation ElasticSearch
- [ ] Extraction NER (contacts, entreprises, besoins)
- [ ] UI explorateur emails

### Phase 3 — Pappers + propriétaires (S11-S12)
- [ ] Intégration Pappers Entreprises
- [ ] Intégration Pappers Immo
- [ ] UI fiches propriétaires + scoring

### Phase 4 — Visites + documents (S13-S15)
- [ ] Module visites (création, participants)
- [ ] Moteur de templates DOCX/PDF
- [ ] Génération bon de visite, dénonce, LOI

### Phase 5 — Agenda + VISIAL (S16-S18)
- [ ] Sync calendrier Outlook bidirectionnelle
- [ ] Connexion VISIAL QIE (à cadrer techniquement)

### Phase 6 — Industrialisation (S19-S20)
- [ ] Dashboards KPI
- [ ] ML scoring (remplacement poids fixes)
- [ ] Tests E2E
- [ ] Mise en prod

---

## 9. Risques identifiés

| Risque | Impact | Mitigation |
|---|---|---|
| API VISIAL QIE non documentée | 🔴 Élevé | Audit dès S1, prévoir intégration manuelle de fallback |
| Volume Outlook (15 ans, GB de data) | 🟠 Moyen | Ingestion incrémentale + ES dimensionné dès le départ |
| LinkedIn ToS / scraping | 🟠 Moyen | Privilégier Sales Navigator API officielle |
| RGPD sur emails 15 ans | 🟠 Moyen | Validation juridique avant ingestion massive |
| Coût Pappers à l'échelle | 🟡 Faible | Cache agressif (24-48h) + dédoublonnage |
| Adoption interne | 🟠 Moyen | Onboarding personnalisé + sponsor exécutif |

---

## 10. Livrables

- ✅ Architecture cible documentée
- ✅ Schéma SQL initial
- ⬜ API REST OpenAPI/Swagger
- ⬜ UI Next.js (dashboard + 10 modules)
- ⬜ Moteur de matching (Python)
- ⬜ Module Outlook (ingestion + extraction)
- ⬜ Module Pappers (entreprises + immo)
- ⬜ Module CRM (pipeline + 360°)
- ⬜ Module agenda (sync Outlook)
- ⬜ Module visites + documents
- ⬜ Connexion VISIAL QIE
- ⬜ Documentation utilisateur + admin
- ⬜ Tests automatisés (unit + E2E)
- ⬜ Mise en production

---

*Fin du document — version 1.0*
