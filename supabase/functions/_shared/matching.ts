// Cerveau logiciel — moteur de matching offre × demande.
// Port direct du code Python (backend/api/services/matching/engine.py).
// Score final /100 = somme des scores partiels - pénalités, clamped [0,100].

export interface Besoin {
  typologie?: string | null;
  surface_min?: number | string | null;
  surface_max?: number | string | null;
  budget_min?: number | string | null;
  budget_max?: number | string | null;
  zones?: string[] | null;
  timing?: string | null;
  statut?: string | null;
}

export interface Bien {
  typologie?: string | null;
  statut?: string | null;
  surface_m2?: number | string | null;
  prix?: number | string | null;
  loyer_annuel?: number | string | null;
  ville?: string | null;
  code_postal?: string | null;
}

export interface Contact {
  email?: string | null;
  role_immo?: string | null;
  score?: number | null;
}

export interface History {
  interactions_30d?: number;
  deals_signes?: number;
  last_contact_days?: number;
}

export interface ScoreParts {
  asset: number;
  geo: number;
  surface_budget: number;
  timing: number;
  signals: number;
  history: number;
  contact: number;
}

const toNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : null;
};

const intervalOverlapRatio = (
  aMin: number | null,
  aMax: number | null,
  bMin: number | null,
  bMax: number | null,
): number => {
  if (aMin === null && aMax === null) return 1.0;
  if (bMin === null && bMax === null) return 0.0;
  const aLo = aMin ?? bMin;
  const aHi = aMax ?? bMax;
  const bLo = bMin ?? bMax;
  const bHi = bMax ?? bMin;
  if (aLo === null || aHi === null || bLo === null || bHi === null) return 0.0;
  const interLo = Math.max(aLo, bLo);
  const interHi = Math.min(aHi, bHi);
  if (interHi < interLo) return 0.0;
  const span = Math.max(aHi - aLo, bHi - bLo, 1.0);
  return (interHi - interLo) / span;
};

const TYPO_PROXIMITE: Record<string, number> = {
  "bureaux|mixte": 0.5,
  "entrepot|locaux_activite": 0.7,
  "locaux_activite|entrepot": 0.7,
  "commerce|mixte": 0.4,
};

export function scoreAsset(b: Besoin, i: Bien): number {
  const bt = (b.typologie ?? "").toLowerCase();
  const bn = (i.typologie ?? "").toLowerCase();
  if (!bt || !bn) return 5;
  if (bt === bn) return 15;
  return Math.round(15 * (TYPO_PROXIMITE[`${bt}|${bn}`] ?? 0));
}

export function scoreGeo(b: Besoin, i: Bien): number {
  const zones = b.zones ?? [];
  if (!zones.length) return 10;
  const ville = (i.ville ?? "").toLowerCase();
  const cp = (i.code_postal ?? "").substring(0, 2);
  for (const z of zones) {
    const zl = z.toLowerCase();
    if (zl === ville) return 20;
    if (zl === (i.code_postal ?? "")) return 18;
    if (zl.length === 2 && zl === cp) return 16;
  }
  return 0;
}

export function scoreSurfaceBudget(b: Besoin, i: Bien): number {
  const surf = Math.round(
    10 * intervalOverlapRatio(
      toNum(b.surface_min), toNum(b.surface_max),
      toNum(i.surface_m2), toNum(i.surface_m2),
    ),
  );
  const prix = toNum(i.prix) ?? toNum(i.loyer_annuel);
  const bud = Math.round(
    10 * intervalOverlapRatio(
      toNum(b.budget_min), toNum(b.budget_max),
      prix, prix,
    ),
  );
  return surf + bud;
}

const TIMING_URGENCE: Record<string, number> = {
  immediat: 1.0, "3 mois": 0.8, "6 mois": 0.6, "1 an": 0.4,
};

export function scoreTiming(b: Besoin, i: Bien): number {
  const urg = TIMING_URGENCE[(b.timing ?? "").toLowerCase()] ?? 0.5;
  const dispo = i.statut === "disponible" ? 1.0 : 0.3;
  return Math.round(15 * urg * dispo);
}

export function scoreSignals(b: Besoin): number {
  return b.statut === "actif" ? 10 : 0;
}

export function scoreHistory(h: History): number {
  let s = 0;
  if ((h.interactions_30d ?? 0) >= 3) s += 4;
  if ((h.deals_signes ?? 0) >= 1) s += 4;
  if ((h.last_contact_days ?? 9999) <= 7) s += 2;
  return Math.min(10, s);
}

export function scoreContact(c: Contact): number {
  if (!c) return 0;
  let s = 0;
  if (c.email) s += 3;
  const role = (c.role_immo ?? "").toLowerCase();
  if (["immobilier", "expansion", "dg"].includes(role)) s += 4;
  s += Math.min(3, Math.floor((c.score ?? 0) / 30));
  return Math.min(10, s);
}

export function penalties(b: Besoin, i: Bien, c: Contact): number {
  let p = 0;
  if (!c?.email) p += 10;
  if (i.statut === "vendu" || i.statut === "retiré") p += 30;
  if (b.statut !== "actif") p += 15;
  return Math.min(30, p);
}

export function calculateFinalScore(
  besoin: Besoin,
  bien: Bien,
  contact: Contact = {},
  history: History = {},
): { score: number; parts: ScoreParts } {
  const parts: ScoreParts = {
    asset: scoreAsset(besoin, bien),
    geo: scoreGeo(besoin, bien),
    surface_budget: scoreSurfaceBudget(besoin, bien),
    timing: scoreTiming(besoin, bien),
    signals: scoreSignals(besoin),
    history: scoreHistory(history),
    contact: scoreContact(contact),
  };
  const base = Object.values(parts).reduce((a, b) => a + b, 0);
  const score = Math.max(0, Math.min(100, base - penalties(besoin, bien, contact)));
  return { score, parts };
}

export function recommendAction(score: number): string {
  if (score >= 80) return "appel_immediat";
  if (score >= 60) return "envoi_fiche";
  if (score >= 40) return "qualification";
  return "veille";
}
