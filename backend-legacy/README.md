# Backend FastAPI — ARCHIVÉ

> ⚠️ Ce backend a été remplacé par **Supabase + Edge Functions** le 2026-05-02.
> Code conservé en référence — toute la logique a été portée en TypeScript Deno
> dans [`../supabase/functions/`](../supabase/functions/).

## Pourquoi avoir migré ?

- Plus simple à héberger (Supabase héberge tout : DB + Auth + Storage + Functions)
- Pas de Docker à maintenir
- Pas de FastAPI/Python à déployer
- RLS Postgres > RBAC custom Python
- Auth Supabase > JWT + passlib custom

## Mapping Python → TypeScript

| Module Python | Edge Function équivalente |
|---|---|
| `api/services/matching/engine.py` | `supabase/functions/_shared/matching.ts` |
| `api/services/outlook/extract.py` | `supabase/functions/_shared/extract.ts` |
| `api/services/outlook/sync.py`    | `supabase/functions/outlook-sync/index.ts` |
| `api/services/outlook/client.py`  | `supabase/functions/_shared/graph.ts` |
| `api/services/pappers/client.py`  | `supabase/functions/_shared/pappers.ts` |
| `api/services/pappers/scoring.py` | (inclus dans pappers.ts) |
| `api/services/documents/generator.py` | `supabase/functions/_shared/templates.ts` |
| `api/services/documents/templates/*.html.j2` | (inclus inline dans templates.ts) |
| `api/services/auth.py`            | Supabase Auth natif |
| `api/routers/*.py`                | Soit Edge Function, soit appel direct supabase-js |
| `api/models/*.py` (SQLAlchemy)    | `supabase/migrations/20260502000001_init.sql` |

Le code Python reste consultable pour traçabilité et pour comparer/débuguer
les ports TypeScript si besoin.

---

## Original (pour mémoire)

### Stack
- API principale : Python 3.11 + FastAPI
- Workers async : Node.js (intégrations Microsoft Graph, Pappers, VISIAL QIE)
- DB : PostgreSQL + PostGIS
- Search : ElasticSearch
- Queue : Redis + RQ (Python) ou BullMQ (Node)

### Cerveau logiciel — moteur de matching

```python
def calculate_final_score(besoin, bien, contact, history) -> tuple[int, dict]:
    scores = {
        "asset":         score_asset(besoin, bien),
        "geo":           score_geo(besoin, bien),
        "surface_budget": score_surface_budget(besoin, bien),
        "timing":        score_timing(besoin, bien),
        "signals":       score_signals(besoin),
        "history":       score_history(history),
        "contact":       score_contact(contact),
    }
    base = sum(scores.values())
    final = max(0, min(100, base - penalties(besoin, bien, contact)))
    return final, scores
```
