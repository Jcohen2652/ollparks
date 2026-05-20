// POST /functions/v1/pappers-enrich
// Body : { entreprise_id: string }
// Enrichit une entreprise (effectif, CA, dirigeants) à partir de son SIREN.

import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { PappersClient, PappersError } from "../_shared/pappers.ts";

Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;
  if (req.method !== "POST") return jsonResponse({ error: "Méthode non autorisée" }, 405);

  const { entreprise_id } = await req.json().catch(() => ({}));
  if (!entreprise_id) return jsonResponse({ error: "entreprise_id requis" }, 400);

  const sb = getServiceClient();
  const { data: ent } = await sb.from("entreprises").select("*").eq("id", entreprise_id).single();
  if (!ent || !ent.siren) return jsonResponse({ error: "Entreprise sans SIREN" }, 400);

  let client: PappersClient;
  try { client = PappersClient.fromEnv(); }
  catch (e) { return jsonResponse({ error: (e as Error).message }, 503); }

  const data: any = await client.entreprise(ent.siren);
  if (!data || !data.siren) return jsonResponse({ error: "SIREN inconnu sur Pappers" }, 404);

  await sb.from("entreprises").update({
    raison_sociale: data.denomination ?? ent.raison_sociale,
    effectif: data.effectif ?? ent.effectif,
    ca: data.chiffre_affaires ?? ent.ca,
    pappers_id: data.id ? String(data.id) : ent.pappers_id,
  }).eq("id", entreprise_id);

  return jsonResponse({
    ok: true,
    siren: ent.siren,
    dirigeants: (data.representants ?? []).slice(0, 10),
  });
});
