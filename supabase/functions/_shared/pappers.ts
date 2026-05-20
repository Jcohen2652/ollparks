// Client minimal Pappers — Entreprises + Immo

export class PappersError extends Error {}

const PAPPERS_BASE = "https://api.pappers.fr/v2";
const PAPPERS_IMMO_BASE = "https://api.pappers.fr/immo/v1";

export class PappersClient {
  constructor(private apiKey: string) {}

  static fromEnv(): PappersClient {
    const k = Deno.env.get("PAPPERS_API_KEY");
    if (!k) throw new PappersError("PAPPERS_API_KEY manquante");
    return new PappersClient(k);
  }

  private async get(base: string, path: string, params: Record<string, string> = {}) {
    const url = new URL(`${base}${path}`);
    url.searchParams.set("api_token", this.apiKey);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const r = await fetch(url);
    if (r.status === 404) return {};
    if (!r.ok) throw new PappersError(`GET ${path}: ${r.status}`);
    return r.json();
  }

  entreprise(siren: string) {
    return this.get(PAPPERS_BASE, "/entreprise", { siren });
  }

  searchImmo(params: { adresse?: string; code_postal?: string; ville?: string; per_page?: number }) {
    const cleaned: Record<string, string> = {};
    if (params.adresse) cleaned.adresse = params.adresse;
    if (params.code_postal) cleaned.code_postal = params.code_postal;
    if (params.ville) cleaned.ville = params.ville;
    cleaned.par_page = String(params.per_page ?? 20);
    return this.get(PAPPERS_IMMO_BASE, "/recherche", cleaned);
  }

  async proprietairesParAdresse(adresse: string, codePostal: string, ville?: string) {
    const data: any = await this.searchImmo({ adresse, code_postal: codePostal, ville });
    const out: any[] = [];
    for (const hit of data.resultats ?? []) {
      for (const prop of hit.proprietaires ?? []) {
        let type = "physique";
        if (prop.siren) {
          type = (prop.denomination ?? "").toUpperCase().includes("SCI") ? "sci" : "foncière";
        }
        out.push({
          type,
          nom: prop.denomination ?? prop.nom_complet,
          siren: prop.siren ?? null,
          pappers_id: prop.id ?? null,
          raw: prop,
        });
      }
    }
    return out;
  }
}

// Scoring propriétaire — port direct du Python (avec foncière=30 / sci=20)
export function scoreProprietaire(prop: {
  type?: string | null;
  date_creation?: string | null;
  nb_biens_detenus?: number;
  capital?: number;
  dirigeants_emails?: string[];
}): number {
  let score = 0;
  if (prop.type === "foncière") score += 30;
  else if (prop.type === "sci") score += 20;
  if (prop.date_creation) {
    try {
      const dt = new Date(prop.date_creation);
      const age = Math.floor((Date.now() - dt.getTime()) / (365 * 24 * 3600 * 1000));
      score += Math.min(30, age);
    } catch { /* ignore */ }
  }
  score += Math.min(25, (prop.nb_biens_detenus ?? 0) * 5);
  if (prop.dirigeants_emails?.length) score += 10;
  if ((prop.capital ?? 0) >= 100_000) score += 5;
  return Math.min(100, Math.max(0, score));
}
