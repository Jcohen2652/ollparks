// Extracteurs structurés sur le contenu d'un email — port direct du Python.

const PHONE_RE = /(?:\+33\s?|0)\s?[1-9](?:[\s.-]?\d{2}){4}/;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const URL_RE = /https?:\/\/[^\s]+/;

const SIG_MARKERS = [
  "--", "—", "cordialement", "bien à vous", "bien cordialement",
  "salutations", "best regards", "kind regards", "regards",
];

export interface Signature {
  nom_prenom?: string | null;
  poste?: string | null;
  societe?: string | null;
  email?: string | null;
  telephone?: string | null;
  site_web?: string | null;
}

export function parseSignature(body: string): Signature {
  if (!body) return {};
  const lines = body.split("\n").map((s) => s.trim()).filter(Boolean);
  let sigStart = -1;
  for (let i = 0; i < lines.length; i++) {
    const low = lines[i].toLowerCase();
    if (SIG_MARKERS.some((m) => low.startsWith(m))) {
      sigStart = i + 1;
      break;
    }
  }
  const candidates = sigStart >= 0 ? lines.slice(sigStart) : lines.slice(-8);
  const phone = candidates.map((ln) => PHONE_RE.exec(ln)?.[0]).find(Boolean) ?? null;
  const email = candidates.map((ln) => EMAIL_RE.exec(ln)?.[0]).find(Boolean) ?? null;
  const url = candidates.map((ln) => URL_RE.exec(ln)?.[0]).find(Boolean) ?? null;
  const nom = candidates.find((ln) =>
    ln.length >= 4 && ln.length <= 40
    && /[A-Z]/.test(ln)
    && !PHONE_RE.test(ln) && !EMAIL_RE.test(ln) && !URL_RE.test(ln)
  ) ?? null;
  const societeKw = ["SAS", "SA", "SARL", "SCI", "Group", "Holding", "International"];
  const societe = candidates.find((ln) => societeKw.some((kw) => ln.includes(kw))) ?? null;
  const posteKw = ["Director", "Directeur", "Directrice", "Manager", "Head", "CEO", "COO", "CFO", "Chargé", "Resp.", "Responsable"];
  const poste = candidates.find((ln) => posteKw.some((kw) => ln.includes(kw))) ?? null;
  return { nom_prenom: nom, poste, societe, email, telephone: phone, site_web: url };
}

const GENERIC_DOMAINS = new Set([
  "gmail.com", "hotmail.com", "hotmail.fr", "outlook.com", "outlook.fr",
  "yahoo.com", "yahoo.fr", "free.fr", "wanadoo.fr", "orange.fr", "laposte.net",
  "live.fr", "me.com", "icloud.com", "proton.me", "protonmail.com",
]);

export function extractCompanyFromEmail(email: string): string | null {
  if (!email || !email.includes("@")) return null;
  const domain = email.split("@")[1].toLowerCase().trim();
  if (GENERIC_DOMAINS.has(domain)) return null;
  const parts = domain.split(".");
  let candidate = parts[0];
  if (["mail", "contact", "info", "hello"].includes(candidate)) {
    candidate = parts[1] ?? candidate;
  }
  return candidate;
}

const SURFACE_RANGE_RE = /(\d{2,5})\s*(?:à|a|-|–|—|\/|to)\s*(\d{2,5})\s*(?:m²|m2|metres?\s*carres?|sqm)/i;
const SURFACE_RE = /(\d{2,5})\s*(?:m²|m2|metres?\s*carres?|sqm)/gi;
const BUDGET_RE = /(\d{1,4}(?:[\s.,]\d{3})*(?:[.,]\d+)?)\s*(k€|K€|M€|m€|€|euros?|EUR)/gi;
const ZONE_RE = /\b(paris|lyon|marseille|toulouse|bordeaux|lille|nantes|strasbourg|nice|rennes|montpellier|\d{2,5})\b/gi;

const TIMING: Record<string, string[]> = {
  immediat: ["urgent", "immédiat", "asap", "tout de suite", "rapidement"],
  "3 mois": ["3 mois", "trois mois", "trimestre"],
  "6 mois": ["6 mois", "six mois", "semestre"],
  "1 an": ["1 an", "un an", "année", "fin d'année"],
};

const TYPOLOGIE: Record<string, string[]> = {
  bureaux: ["bureaux", "bureau", "openspace", "open-space", "tertiaire"],
  entrepot: ["entrepôt", "entrepot", "logistique", "stockage", "warehouse"],
  commerce: ["commerce", "boutique", "magasin", "retail", "pop-up"],
  locaux_activite: ["locaux d'activité", "locaux d activite", "locaux mixtes"],
};

export interface PropertyNeed {
  typologie: string | null;
  surface_min: number | null;
  surface_max: number | null;
  budget_max: number | null;
  timing: string | null;
  zones: string[];
}

function parseBudget(raw: string, suffix: string): number | null {
  const sfx = suffix.toLowerCase();
  let mult = 1;
  if (sfx.includes("m€")) mult = 1_000_000;
  else if (sfx.includes("k€")) mult = 1_000;
  const num = parseFloat(raw.replace(/[\s,]/g, ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(num) ? Math.round(num * mult) : null;
}

export function extractPropertyNeed(text: string): PropertyNeed {
  if (!text) return { typologie: null, surface_min: null, surface_max: null, budget_max: null, timing: null, zones: [] };
  const low = text.toLowerCase();

  let typologie: string | null = null;
  for (const [t, kw] of Object.entries(TYPOLOGIE)) {
    if (kw.some((k) => low.includes(k))) { typologie = t; break; }
  }

  let surface_min: number | null = null, surface_max: number | null = null;
  const rng = SURFACE_RANGE_RE.exec(text);
  if (rng) {
    const a = parseInt(rng[1], 10), b = parseInt(rng[2], 10);
    surface_min = Math.min(a, b); surface_max = Math.max(a, b);
  } else {
    const surfaces: number[] = [];
    let m;
    SURFACE_RE.lastIndex = 0;
    while ((m = SURFACE_RE.exec(text))) surfaces.push(parseInt(m[1], 10));
    if (surfaces.length) {
      surface_min = Math.min(...surfaces);
      surface_max = surfaces.length > 1 ? Math.max(...surfaces) : null;
    }
  }

  const budgets: number[] = [];
  let bm;
  BUDGET_RE.lastIndex = 0;
  while ((bm = BUDGET_RE.exec(text))) {
    const b = parseBudget(bm[1], bm[2]);
    if (b !== null) budgets.push(b);
  }
  const budget_max = budgets.length ? Math.max(...budgets) : null;

  let timing: string | null = null;
  for (const [t, kw] of Object.entries(TIMING)) {
    if (kw.some((k) => low.includes(k))) { timing = t; break; }
  }

  const zonesSet = new Set<string>();
  let zm;
  ZONE_RE.lastIndex = 0;
  while ((zm = ZONE_RE.exec(text))) zonesSet.add(zm[1].toLowerCase());

  return { typologie, surface_min, surface_max, budget_max, timing, zones: [...zonesSet] };
}

const SIGNAL_PATTERNS: Record<string, string[]> = {
  demenagement: ["déménag", "demenag", "relocation", "nouveau site", "nouveaux locaux"],
  levee_de_fonds: ["levée de fonds", "levee de fonds", "série a", "série b", "fundraising", "round"],
  croissance: ["embauche", "recrutement massif", "ouverture", "expansion", "scale"],
  restructuration: ["restructuration", "fermeture", "plan social", "réduction"],
};

export function extractBusinessSignals(text: string): string[] {
  if (!text) return [];
  const low = text.toLowerCase();
  return Object.entries(SIGNAL_PATTERNS)
    .filter(([_, p]) => p.some((kw) => low.includes(kw)))
    .map(([s]) => s);
}
