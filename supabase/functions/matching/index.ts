// POST /functions/v1/matching
// Body : { besoin_id: string, top_n?: number }
//
// Calcule le score /100 d'un besoin contre tous les biens disponibles,
// upsert dans `opportunites`, retourne le top N trié.

import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import {
  calculateFinalScore,
  recommendAction,
} from "../_shared/matching.ts";

interface RunBody {
  besoin_id: string;
  top_n?: number;
}

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;
  if (req.method !== "POST") return jsonResponse({ error: "Méthode non autorisée" }, 405);

  let body: RunBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "JSON invalide" }, 400);
  }
  if (!body.besoin_id) return jsonResponse({ error: "besoin_id requis" }, 400);
  const topN = body.top_n ?? 10;

  const sb = getServiceClient();

  // 1. Charge le besoin
  const { data: besoin, error: e1 } = await sb
    .from("besoins")
    .select("*")
    .eq("id", body.besoin_id)
    .single();
  if (e1 || !besoin) return jsonResponse({ error: "Besoin introuvable" }, 404);

  // 2. Charge le contact (si existe)
  let contact = {};
  if (besoin.contact_id) {
    const { data: c } = await sb
      .from("contacts")
      .select("email, role_immo, score")
      .eq("id", besoin.contact_id)
      .single();
    if (c) contact = c;
  }

  // 3. Charge tous les biens disponibles
  const { data: biens, error: e3 } = await sb
    .from("biens")
    .select("id, typologie, statut, surface_m2, prix, loyer_annuel, ville, code_postal")
    .eq("statut", "disponible");
  if (e3) return jsonResponse({ error: e3.message }, 500);

  // 4. Score chaque bien
  const results = (biens ?? []).map((bien) => {
    const { score, parts } = calculateFinalScore(besoin, bien, contact);
    const action = recommendAction(score);
    return { bien_id: bien.id, score, score_detail: parts, action };
  });

  // 5. Upsert dans opportunites
  const upserts = results.map((r) => ({
    besoin_id: besoin.id,
    bien_id: r.bien_id,
    score: r.score,
    score_detail: r.score_detail,
    action_recommandee: r.action,
  }));
  if (upserts.length > 0) {
    const { error: e5 } = await sb
      .from("opportunites")
      .upsert(upserts, { onConflict: "besoin_id,bien_id" });
    if (e5) return jsonResponse({ error: e5.message }, 500);
  }

  // 6. Tri + top N
  results.sort((a, b) => b.score - a.score);
  return jsonResponse({
    besoin_id: besoin.id,
    results: results.slice(0, topN),
  });
});
